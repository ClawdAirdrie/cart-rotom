
// GitHub Actions automatic deployment is now configured
// Merges to main will automatically trigger Cloud Functions deployment
// GitHub Actions Service Account has access to TELEGRAM_BOT_TOKEN secret

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const PuppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { encryptCardData, decryptCardData, encrypt, decrypt } = require("./cardEncryption");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Apply stealth plugin to puppeteer-core
PuppeteerExtra.use(StealthPlugin());


admin.initializeApp();
const db = admin.firestore();

exports.scheduleAgentChecks = onSchedule({
    schedule: "every 1 minutes",
    memory: "2GiB",
    timeoutSeconds: 60,
}, async (event) => {
    logger.info("Scheduler started...");
    try {
        const now = admin.firestore.Timestamp.now();
        const batchPromises = [];

        // QUERY: Find ALL documents named "agents" where status is ENABLED
        // This works across the entire DB, regardless of parent existence.
        const agentsSnapshot = await db.collectionGroup("agents")
            .where("status", "==", "ENABLED")
            .get();

        logger.info(`Found ${agentsSnapshot.size} total enabled agents.`);

        for (const doc of agentsSnapshot.docs) {
            const agent = doc.data();

            // RECOVER USER ID: The parent of an agent is the 'agents' collection, 
            // the parent of that is the User Document.
            const userId = doc.ref.parent.parent ? doc.ref.parent.parent.id : "UNKNOWN_USER";

            // Safety check for parent
            if (userId === "UNKNOWN_USER") {
                logger.warn(`Agent ${doc.id} has no valid parent user. Skipping.`);
                continue;
            }

            const lastChecked = agent.lastChecked && typeof agent.lastChecked.toDate === 'function'
                ? agent.lastChecked.toDate()
                : new Date(0);

            const freqMinutes = agent.frequency || 5;
            const nextCheck = new Date(lastChecked.getTime() + freqMinutes * 60000);

            if (now.toDate() >= nextCheck) {
                logger.info(`Agent ${doc.id} due. (User: ${userId})`);
                batchPromises.push(checkStock(userId, doc.id, agent));
            }
        }

        await Promise.all(batchPromises);
        logger.info(`Scheduler finished. Triggered ${batchPromises.length} checks.`);
    } catch (error) {
        logger.error("Error in scheduleAgentChecks:", error);
        if (error.code === 9 || error.message.includes("FAILED_PRECONDITION")) {
            logger.error("This error is likely due to a missing Firestore Index for the 'agents' collectionGroup on field 'status'. Please check the Firebase Console to create the index.");
        }
    }
});

// 2. The Worker Logic
async function checkStock(userId, agentId, agent) {
    const agentRef = db.collection("users").doc(userId).collection("agents").doc(agentId);

    try {
        let html;
        let responseStatus = 200;
        let botDetected = false;
        let usedPuppeteer = false;

        // Helper to detect WAF/bot protection
        function detectBotProtection(htmlContent) {
            const botDetectionSignatures = [
                { name: "Cloudflare", patterns: ["Pardon Our Interruption", "challenge-platform", "cf_clearance"] },
                { name: "Incapsula", patterns: ["Incapsula", "incident_id", "_Incapsula_Resource", "distil_referrer"] },
                { name: "AWS WAF", patterns: ["AWS WAF", "akamai_validation"] },
                { name: "F5 BIG-IP", patterns: ["F5 BIG-IP", "BIG-IP"] }
            ];

            for (const detector of botDetectionSignatures) {
                if (detector.patterns.some(pattern => htmlContent.includes(pattern))) {
                    return detector.name;
                }
            }
            return null;
        }

        let protectionDetected = null;
        
        try {
            const response = await axios.get(agent.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 5000
            });
            html = response.data;
            responseStatus = response.status;

            // Check if axios response is actually blocked by WAF
            protectionDetected = detectBotProtection(html);
            if (protectionDetected) {
                logger.warn(`Axios got WAF response (${protectionDetected}) for ${agent.url}. Trying Puppeteer with stealth.`);
                // Don't give up yet - try Puppeteer as fallback
            }

        } catch (axiosError) {
            logger.warn(`Axios failed for ${agent.url} (${axiosError.message}). Trying Puppeteer.`);
            protectionDetected = "CONNECTION_FAILED";
        }

        // If axios gave us a WAF response or failed, try Puppeteer
        if (protectionDetected) {
            try {
                logger.info(`Attempting Puppeteer with stealth plugin for ${agent.url}`);
                html = await fetchWithPuppeteer(agent.url);
                usedPuppeteer = true;
                
                // Check if Puppeteer also hit WAF
                const puppeteerProtection = detectBotProtection(html);
                if (puppeteerProtection) {
                    logger.warn(`Puppeteer also detected WAF (${puppeteerProtection}) for ${agent.url}`);
                    botDetected = true;
                } else {
                    logger.info(`Puppeteer successfully bypassed protection for ${agent.url}`);
                    botDetected = false;
                }
            } catch (puppeteerError) {
                logger.warn(`Puppeteer failed for ${agent.url}: ${puppeteerError.message}`);
                botDetected = true;
            }
        }

        const $ = cheerio.load(html || "");

        let isInStock = false;
        let logMessage = "";
        let checkResult = "UNKNOWN";

        // If bot detection triggered, skip stock checks
        if (botDetected) {
            checkResult = "BOT_DETECTED";
            logMessage = "Bot detection (WAF/anti-scraping) blocked access to page. Real stock status unknown.";
            logger.warn(`${logMessage} | Agent: ${agentId}`);
        } else {
            // --- CHECK LOGIC ---
            // 1. Selector Based (Advanced)
            if (agent.checkType === 'SELECTOR' && agent.selector) {
                const element = $(agent.selector);
                const text = element.text().trim();
                const value = element.val();
                const content = text || value || "";

                if (agent.condition === 'EQUALS') {
                    isInStock = content === agent.expectedValue;
                    logMessage = `Selector '${agent.selector}' content '${content}' equals '${agent.expectedValue}'`;
                } else if (agent.condition === 'NOT_EQUALS') {
                    isInStock = content !== agent.expectedValue;
                    logMessage = `Selector '${agent.selector}' content '${content}' does NOT equal '${agent.expectedValue}'`;
                } else if (agent.condition === 'CONTAINS') {
                    isInStock = content.includes(agent.expectedValue);
                    logMessage = `Selector '${agent.selector}' content '${content}' contains '${agent.expectedValue}'`;
                } else {
                    // Default: Element exists
                    isInStock = element.length > 0;
                    logMessage = `Selector '${agent.selector}' exists`;
                }
            }
            // 2. Keyword Present (Positive Match)
            else if (agent.checkType === 'KEYWORD_PRESENT') {
                const keywords = (agent.keywords || "add to cart, in stock").split(',').map(k => k.trim().toLowerCase());
                const bodyText = $("body").text().toLowerCase();

                // In stock if ANY keyword is found
                const found = keywords.find(k => bodyText.includes(k));
                isInStock = !!found;
                logMessage = found ? `Found keyword: '${found}'` : "No positive keywords found";
            }
            // 3. Keyword Missing (Negative Match - Default)
            else {
                const bodyText = $("body").text().toLowerCase();
                const outOfStockKeywords = (agent.keywords || "out of stock, sold out, currently unavailable, notify me").split(',').map(k => k.trim().toLowerCase());

                // In stock if NO negative keywords are found
                const found = outOfStockKeywords.find(k => bodyText.includes(k));
                isInStock = !found; // True if NOT found
                logMessage = found ? `Found negative keyword: '${found}'` : "No negative keywords found (Assumed In Stock)";
            }
            
            checkResult = isInStock ? "IN_STOCK" : "OUT_OF_STOCK";
        }

        const timestamp = admin.firestore.Timestamp.now();
        const updates = {
            lastChecked: timestamp,
            lastResult: checkResult,
            lastHttpStatus: responseStatus
        };

        // --- THUMBNAIL SCRAPING ---
        // If no thumbnail exists, try to grab one
        if (!agent.thumbnail) {
            let thumb = $('meta[property="og:image"]').attr('content');
            if (!thumb) thumb = $('meta[name="twitter:image"]').attr('content');
            if (!thumb) thumb = $('link[rel="image_src"]').attr('href');
            // Last resort: first decent sized image
            if (!thumb) {
                $('img').each((i, el) => {
                    const src = $(el).attr('src');
                    if (src && !src.includes('svg') && !src.includes('icon') && src.length > 10) {
                        // Basic heuristic to skip icons
                        thumb = src;
                        return false; // break
                    }
                });
            }

            if (thumb) {
                // Resolve relative URLs
                if (thumb.startsWith('/')) {
                    const u = new URL(agent.url);
                    thumb = u.origin + thumb;
                }
                updates.thumbnail = thumb;
                logger.info(`Scraped thumbnail for ${agentId}: ${thumb}`);
            }
        }

        // --- AUTO CHECKOUT ---
        // If item is in stock AND agent has auto checkout enabled with a card
        if (isInStock && agent.autoCheckout && agent.autoCheckoutCardId) {
            try {
                logger.info(`Attempting auto-checkout for agent ${agentId}`);
                
                // Fetch and decrypt payment method
                const paymentMethodDoc = await db.collection("users").doc(userId)
                    .collection("paymentMethods").doc(agent.autoCheckoutCardId).get();
                
                if (!paymentMethodDoc.exists) {
                    throw new Error("Payment method not found");
                }
                
                const encryptedCard = paymentMethodDoc.data();
                const cardData = decryptCardData(encryptedCard);
                
                // TODO: Implement actual checkout logic with Puppeteer
                // For now, just log that we would checkout
                logger.info(`Would checkout using card ending in ${cardData.last4}`);
                
                // Add checkout attempt to logs
                await agentRef.collection("logs").add({
                    timestamp: timestamp,
                    result: "CHECKOUT_ATTEMPTED",
                    message: `Auto-checkout attempted with card ending in ${cardData.last4}`,
                    httpStatus: responseStatus
                });
                
                // Mark that checkout was attempted
                updates.lastCheckoutAttempt = timestamp;
                
            } catch (checkoutError) {
                logger.error(`Auto-checkout failed for ${agentId}: ${checkoutError.message}`);
                await agentRef.collection("logs").add({
                    timestamp: timestamp,
                    result: "CHECKOUT_FAILED",
                    message: `Auto-checkout failed: ${checkoutError.message}`,
                    httpStatus: responseStatus
                });
            }
        }

        // Check if status changed
        const previousStatus = agent.lastResult;
        const statusChanged = previousStatus && previousStatus !== checkResult;

        // Update Agent Status
        await agentRef.update(updates);

        // Only fire webhooks for actual IN_STOCK/OUT_OF_STOCK, not BOT_DETECTED
        // Fire webhook if status changed or first time check
        if (checkResult !== "BOT_DETECTED" && (!previousStatus || statusChanged)) {
            await fireWebhook(userId, agentId, agent, isInStock);
        }

        // Log the result
        await agentRef.collection("logs").add({
            timestamp: timestamp,
            result: checkResult,
            message: logMessage,
            httpStatus: responseStatus
        });

        logger.info(`Check complete for ${agentId}: ${checkResult}${checkResult === "BOT_DETECTED" ? " ⚠️ " : ""}`);

        // Fire webhook if status changed (but not BOT_DETECTED)
        if (statusChanged && checkResult !== "BOT_DETECTED" && previousStatus !== "BOT_DETECTED") {
            logger.info(`Status changed for ${agentId}: ${previousStatus} → ${checkResult}`);
            await fireWebhook(userId, agentId, agent, isInStock);
        }

    } catch (error) {
        logger.error(`Failed to check url ${agent.url}: ${error.message}`);

        await agentRef.update({
            lastChecked: admin.firestore.Timestamp.now(),
            lastResult: "ERROR"
        });

        await agentRef.collection("logs").add({
            timestamp: admin.firestore.Timestamp.now(),
            result: "ERROR",
            message: error.message,
            httpStatus: error.response ? error.response.status : 0
        });
    }
}

async function fetchWithPuppeteer(url) {
    logger.info(`Launching Puppeteer with Stealth Plugin for ${url}`);
    let browser;
    
    try {
        // Launch with PuppeteerExtra + Stealth Plugin (Strategy 2)
        browser = await PuppeteerExtra.launch({
            args: chromium.args,
            defaultViewport: { width: 1920, height: 1080 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });
        
        const page = await browser.newPage();

        // Strategy 1: Enhanced Headers & Stealth Techniques
        // Set realistic viewport (important for detection)
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set realistic User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        // Set additional headers to appear like real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua': '" Not A;Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });
        
        // Masquerade as real browser (webdriver property)
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        });

        // Optimization: Block images, fonts, styles to save bandwidth & time
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate with longer timeout and wait for network idle
        // This helps with JavaScript-heavy sites
        await page.goto(url, { 
            waitUntil: 'networkidle2',  // Wait for network to be mostly idle
            timeout: 40000  // Increased timeout for slow sites
        });
        
        // Additional wait for dynamic content
        await page.waitForTimeout(1000);
        
        const html = await page.content();
        logger.info(`Successfully fetched ${url} with Puppeteer + Stealth`);
        return html;
    } catch (error) {
        logger.warn(`Puppeteer fetch failed for ${url}: ${error.message}`);
        throw new Error(`Puppeteer failed: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// ============================================
// WEBHOOK FUNCTIONS
// ============================================

/**
 * Fire webhook notification
 * @param {string} userId - User ID
 * @param {string} agentId - Agent ID
 * @param {object} agent - Agent data
 * @param {boolean} isInStock - Current stock status
 */
async function fireWebhook(userId, agentId, agent, isInStock) {
    try {
        // Fetch user's notification settings
        const userDoc = await db.collection("users").doc(userId).get();
        
        if (!userDoc.exists) {
            logger.warn(`User ${userId} not found for notification`);
            return;
        }

        const userData = userDoc.data();
        const notificationType = userData.notificationType || 'webhook';

        // Route to appropriate notification handler
        if (notificationType === 'telegram' && userData.notificationTelegram) {
            return await fireTelegram(userId, agentId, agent, isInStock, userData.notificationTelegram);
        }

        // Default to webhook
        let webhookUrl = userData.notificationWebhook;

        // Check for per-agent webhook override (future feature)
        if (agent.webhookUrl) {
            webhookUrl = agent.webhookUrl;
        }

        if (!webhookUrl) {
            logger.info(`No notification configured for user ${userId}`);
            return;
        }

        // Decrypt webhook URL
        const decryptedWebhookUrl = decrypt(webhookUrl);

        // Detect webhook type
        const webhookType = detectWebhookType(decryptedWebhookUrl);
        
        // Build payload based on webhook type
        let payload;
        const status = isInStock ? "IN_STOCK" : "OUT_OF_STOCK";
        const color = isInStock ? 0x00ff00 : 0xff0000; // Green for in stock, red for out of stock
        const statusText = isInStock ? "✅ IN STOCK" : "❌ OUT OF STOCK";
        const title = agent.alias || agent.name || "Product";

        if (webhookType === 'discord') {
            // Discord webhook format with embeds
            payload = {
                embeds: [{
                    title: title,
                    url: agent.url,
                    description: `Status: **${statusText}**`,
                    color: color,
                    thumbnail: agent.thumbnail ? { url: agent.thumbnail } : undefined,
                    fields: [
                        {
                            name: "URL",
                            value: agent.url,
                            inline: false
                        },
                        {
                            name: "Last Checked",
                            value: new Date().toLocaleString(),
                            inline: true
                        }
                    ],
                    footer: {
                        text: "Cart Rotom Stock Alert"
                    },
                    timestamp: new Date().toISOString()
                }]
            };
        } else if (webhookType === 'slack') {
            // Slack webhook format with blocks
            const blocks = [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `${statusText}: ${title}`,
                        emoji: true
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Product:* ${title}\n*Status:* ${statusText}\n*URL:* <${agent.url}|View Product>`
                    }
                }
            ];

            if (agent.thumbnail) {
                blocks[1].accessory = {
                    type: "image",
                    image_url: agent.thumbnail,
                    alt_text: title
                };
            }

            blocks.push({
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `Last checked: ${new Date().toLocaleString()}`
                    }
                ]
            });

            payload = {
                blocks: blocks,
                attachments: [{
                    color: isInStock ? "good" : "danger"
                }]
            };
        } else {
            // Generic JSON webhook
            payload = {
                agent: {
                    id: agentId,
                    name: title,
                    alias: agent.alias,
                    url: agent.url,
                    thumbnail: agent.thumbnail
                },
                status: status,
                isInStock: isInStock,
                timestamp: new Date().toISOString(),
                message: `${title} is now ${statusText}`
            };
        }

        // Send webhook
        await axios.post(decryptedWebhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        logger.info(`Webhook fired successfully for agent ${agentId} (${webhookType})`);

    } catch (error) {
        // Don't fail the agent check if webhook fails
        logger.error(`Webhook failed for agent ${agentId}: ${error.message}`);
    }
}

/**
 * Detect webhook type from URL
 * @param {string} url - Webhook URL
 * @returns {string} - Webhook type (discord, slack, generic)
 */
function detectWebhookType(url) {
    if (!url) return 'generic';
    if (url.includes('discord.com')) return 'discord';
    if (url.includes('hooks.slack.com')) return 'slack';
    return 'generic';
}

/**
 * Save webhook URL (callable function)
 */
exports.saveWebhook = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { webhookUrl } = data;
    const userId = auth.uid;

    try {
        // Encrypt webhook URL
        const encryptedWebhookUrl = webhookUrl ? encrypt(webhookUrl) : null;

        // Save to Firestore
        await db.collection("users").doc(userId).set({
            notificationWebhook: encryptedWebhookUrl,
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });

        logger.info(`Webhook URL saved for user ${userId}`);

        return { success: true, message: "Webhook URL saved successfully" };
    } catch (error) {
        logger.error(`Failed to save webhook URL for user ${userId}: ${error.message}`);
        throw new Error("Failed to save webhook URL");
    }
});

/**
 * Test webhook (callable function)
 */
exports.testWebhook = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { webhookUrl } = data;
    const userId = auth.uid;

    try {
        // Detect webhook type
        const webhookType = detectWebhookType(webhookUrl);

        // Build test payload
        let payload;
        if (webhookType === 'discord') {
            payload = {
                embeds: [{
                    title: "🧪 Test Notification",
                    description: "Your Cart Rotom webhook is working perfectly!",
                    color: 0x00aaff,
                    fields: [
                        {
                            name: "Status",
                            value: "✅ Connected",
                            inline: true
                        },
                        {
                            name: "Type",
                            value: "Discord Webhook",
                            inline: true
                        }
                    ],
                    footer: {
                        text: "Cart Rotom Stock Alert"
                    },
                    timestamp: new Date().toISOString()
                }]
            };
        } else if (webhookType === 'slack') {
            payload = {
                blocks: [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: "🧪 Test Notification",
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "*Your Cart Rotom webhook is working perfectly!*\n\n✅ Status: Connected\n🔔 Type: Slack Webhook"
                        }
                    }
                ],
                attachments: [{
                    color: "good"
                }]
            };
        } else {
            payload = {
                test: true,
                message: "Your Cart Rotom webhook is working perfectly!",
                status: "connected",
                type: "generic webhook",
                timestamp: new Date().toISOString()
            };
        }

        // Send test webhook
        await axios.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        logger.info(`Test webhook sent successfully for user ${userId} (${webhookType})`);

        return { 
            success: true, 
            message: "Test notification sent successfully",
            type: webhookType 
        };
    } catch (error) {
        logger.error(`Test webhook failed for user ${userId}: ${error.message}`);
        throw new Error(`Failed to send test notification: ${error.message}`);
    }
});

// ============================================
// PAYMENT METHOD FUNCTIONS
// ============================================

/**
 * Add payment method (callable function)
 */
exports.addPaymentMethod = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { cardNumber, cvc, expiry, cardholderName, last4, isPrepaid, balance } = data;
    const userId = auth.uid;

    try {
        // Encrypt card data
        const encryptedCard = encryptCardData({
            cardNumber,
            cvc,
            expiry,
            cardholderName,
            last4,
            isPrepaid,
            balance
        });

        // Save to Firestore
        await db.collection("users").doc(userId).collection("paymentMethods").add({
            ...encryptedCard,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });

        logger.info(`Payment method added for user ${userId}`);

        return { success: true, message: "Payment method added successfully" };
    } catch (error) {
        logger.error(`Failed to add payment method for user ${userId}: ${error.message}`);
        throw new Error("Failed to add payment method");
    }
});

/**
 * Update payment method (callable function)
 */
exports.updatePaymentMethod = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { methodId, cardNumber, cvc, expiry, cardholderName, last4, isPrepaid, balance } = data;
    const userId = auth.uid;

    try {
        // Verify ownership
        const methodRef = db.collection("users").doc(userId).collection("paymentMethods").doc(methodId);
        const methodDoc = await methodRef.get();

        if (!methodDoc.exists) {
            throw new Error("Payment method not found");
        }

        // Prepare update data
        const updateData = {
            expiry,
            cardholderName,
            isPrepaid,
            balance: isPrepaid ? balance : null,
            updatedAt: admin.firestore.Timestamp.now()
        };

        // If new card number or CVC provided, encrypt them
        if (cardNumber && cvc) {
            const encryptedCard = encryptCardData({
                cardNumber,
                cvc,
                expiry,
                cardholderName,
                last4,
                isPrepaid,
                balance
            });
            updateData.encryptedNumber = encryptedCard.encryptedNumber;
            updateData.encryptedCVC = encryptedCard.encryptedCVC;
            updateData.last4 = encryptedCard.last4;
        }

        // Update in Firestore
        await methodRef.update(updateData);

        logger.info(`Payment method updated for user ${userId}`);

        return { success: true, message: "Payment method updated successfully" };
    } catch (error) {
        logger.error(`Failed to update payment method for user ${userId}: ${error.message}`);
        throw new Error("Failed to update payment method");
    }
});

// ============================================
// TELEGRAM NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send Telegram notification
 * @param {string} userId - User ID
 * @param {string} agentId - Agent ID
 * @param {object} agent - Agent data
 * @param {boolean} isInStock - Current stock status
 * @param {object} telegramConfig - Telegram config with userId
 */
async function fireTelegram(userId, agentId, agent, isInStock, telegramConfig) {
    try {
        if (!telegramConfig.userId) {
            logger.warn(`Telegram user ID not found for user ${userId}`);
            return;
        }

        // Get Telegram bot token from Google Cloud Secret Manager
        let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!telegramBotToken) {
            telegramBotToken = await getSecret('TELEGRAM_BOT_TOKEN');
        }
        
        if (!telegramBotToken) {
            logger.error("TELEGRAM_BOT_TOKEN not configured");
            return;
        }

        const status = isInStock ? "IN STOCK ✅" : "OUT OF STOCK ❌";
        const title = agent.alias || agent.name || "Product";
        const emoji = isInStock ? "✅" : "❌";

        // Build Telegram message
        const message = `${emoji} *${title}*\n\nStatus: ${status}\n\nURL: ${agent.url}\n\nTime: ${new Date().toLocaleString()}`;

        // Send via Telegram Bot API
        const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        await axios.post(url, {
            chat_id: telegramConfig.userId,
            text: message,
            parse_mode: "Markdown"
        }, {
            timeout: 5000
        });

        logger.info(`Telegram message sent successfully for agent ${agentId}`);

    } catch (error) {
        logger.error(`Telegram notification failed for agent ${agentId}: ${error.message}`);
        // Don't fail the agent check if Telegram fails
    }
}

/**
 * Save Telegram user ID (callable function)
 */
exports.saveTelegram = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { userId: telegramUserId } = data;
    const userId = auth.uid;

    try {
        if (!telegramUserId) {
            throw new Error("Telegram user ID is required");
        }

        // Save Telegram config to Firestore
        await db.collection("users").doc(userId).set({
            notificationType: 'telegram',
            notificationTelegram: {
                userId: telegramUserId,
                connectedAt: admin.firestore.Timestamp.now()
            },
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });

        logger.info(`Telegram settings saved for user ${userId}`);

        return { success: true, message: "Telegram connected successfully" };
    } catch (error) {
        logger.error(`Failed to save Telegram settings for user ${userId}: ${error.message}`);
        throw new Error("Failed to save Telegram settings");
    }
});

/**
 * Test Telegram notification (callable function)
 */
exports.testTelegram = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const { userId: telegramUserId } = data;
    const userId = auth.uid;

    try {
        if (!telegramUserId) {
            throw new Error("Telegram user ID is required");
        }

        // Get Telegram bot token from Google Cloud Secret Manager
        let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!telegramBotToken) {
            telegramBotToken = await getSecret('TELEGRAM_BOT_TOKEN');
        }
        
        if (!telegramBotToken) {
            throw new Error("Telegram bot not configured");
        }

        // Send test message
        const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        await axios.post(url, {
            chat_id: telegramUserId,
            text: "🧪 *Cart Rotom Test Notification*\n\nYour Telegram connection is working! ✅",
            parse_mode: "Markdown"
        }, {
            timeout: 5000
        });

        logger.info(`Test Telegram message sent successfully for user ${userId}`);

        return { success: true, message: "Test notification sent" };
    } catch (error) {
        logger.error(`Test Telegram failed for user ${userId}: ${error.message}`);
        throw new Error(`Failed to send test notification: ${error.message}`);
    }
});

/**
 * Disconnect Telegram (callable function)
 */
exports.disconnectTelegram = onCall(async (request) => {
    const { auth } = request;
    
    if (!auth) {
        throw new Error("Unauthorized");
    }

    const userId = auth.uid;

    try {
        // Remove Telegram config and reset to webhook (or no notification)
        await db.collection("users").doc(userId).set({
            notificationType: 'webhook',
            notificationTelegram: null,
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });

        logger.info(`Telegram disconnected for user ${userId}`);

        return { success: true, message: "Telegram disconnected" };
    } catch (error) {
        logger.error(`Failed to disconnect Telegram for user ${userId}: ${error.message}`);
        throw new Error("Failed to disconnect Telegram");
    }
});

/**
 * Telegram Webhook Handler
 * Receives messages from Telegram and responds to /start command
 */
exports.telegramWebhook = onRequest(async (request, response) => {
    // Only accept POST requests
    if (request.method !== 'POST') {
        return response.status(400).send('Only POST requests accepted');
    }

    try {
        const { message } = request.body;

        // Ignore if no message
        if (!message || !message.text) {
            return response.status(200).send('OK');
        }

        const chatId = message.chat.id;
        const text = message.text.trim();

        logger.info(`Received Telegram message from chat ${chatId}: ${text}`);

        // Only respond to /start command
        if (text === '/start') {
            // Get bot token from secret
            const botToken = await getSecret('TELEGRAM_BOT_TOKEN');

            // Send user their ID
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: chatId,
                text: `🎯 Your Telegram User ID:\n\n\`${chatId}\`\n\nPaste this ID into Cart Rotom Settings → Notifications → Telegram to connect your account!`,
                parse_mode: 'Markdown'
            });

            logger.info(`Sent Telegram ID to chat ${chatId}`);
        }

        // Always return 200 OK to Telegram (prevents retries)
        return response.status(200).send('OK');
    } catch (error) {
        logger.error(`Telegram webhook error: ${error.message}`);
        // Still return 200 to prevent Telegram from retrying
        return response.status(200).send('OK');
    }
});

// ============================================
// SECRETS HELPER
// ============================================

// Cache secrets in memory to avoid repeated API calls
const secretCache = {};
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get secret from Google Cloud Secret Manager
 * @param {string} secretName - Name of the secret (e.g., TELEGRAM_BOT_TOKEN, CARD_ENCRYPTION_KEY)
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(secretName) {
    // Check cache first
    if (secretCache[secretName] && secretCache[secretName].expiresAt > Date.now()) {
        return secretCache[secretName].value;
    }

    try {
        const client = new SecretManagerServiceClient();
        // Cloud Functions sets GCLOUD_PROJECT, fallback to other common env vars
        const projectId = process.env.GCLOUD_PROJECT || 
                         process.env.GCP_PROJECT || 
                         process.env.GOOGLE_CLOUD_PROJECT;
        
        if (!projectId) {
            throw new Error("Could not determine GCP project ID from environment variables (GCLOUD_PROJECT, GCP_PROJECT, GOOGLE_CLOUD_PROJECT)");
        }

        const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
        const [version] = await client.accessSecretVersion({ name });
        const secretValue = version.payload.data.toString('utf8');
        
        // Cache for TTL
        secretCache[secretName] = {
            value: secretValue,
            expiresAt: Date.now() + CACHE_TTL
        };
        
        logger.info(`Retrieved secret ${secretName} from Google Cloud Secret Manager`);
        return secretValue;
    } catch (error) {
        logger.error(`Failed to retrieve secret ${secretName}: ${error.message}`);
        throw new Error(`Failed to retrieve secret: ${secretName}`);
    }
}
