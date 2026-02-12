
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");


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

        try {
            const response = await axios.get(agent.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 5000
            });
            html = response.data;
            responseStatus = response.status;

            if (html.includes("Pardon Our Interruption") || html.includes("challenge-platform")) {
                throw new Error("Blocked by anti-bot protection");
            }

        } catch (axiosError) {
            logger.warn(`Axios failed for ${agent.url} (${axiosError.message}). Switching to Puppeteer.`);
            html = await fetchWithPuppeteer(agent.url);
        }

        const $ = cheerio.load(html);

        let isInStock = false;
        let logMessage = "";

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

        const timestamp = admin.firestore.Timestamp.now();
        const updates = {
            lastChecked: timestamp,
            lastResult: isInStock ? "IN_STOCK" : "OUT_OF_STOCK",
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

        // Update Agent Status
        await agentRef.update(updates);

        // Log the result
        // Only log if status CHANGED or it's been a while? For now log every check for transparency.
        await agentRef.collection("logs").add({
            timestamp: timestamp,
            result: isInStock ? "IN_STOCK" : "OUT_OF_STOCK",
            message: logMessage,
            httpStatus: response.status
        });

        logger.info(`Check complete for ${agentId}: ${isInStock ? "IN_STOCK" : "OUT_OF_STOCK"}`);

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
    logger.info(`Launching Puppeteer with Chromium for ${url}`);
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless
    });
    const page = await browser.newPage();

    try {
        // Optimization: Block images, fonts, styles to save bandwidth & time
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Set a realistic User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        return html;
    } finally {
        await browser.close();
    }
}
