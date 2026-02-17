// Debug script to test checkStock logic locally
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const PuppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Apply stealth plugin
PuppeteerExtra.use(StealthPlugin());

// Test URL
const TEST_URL = "https://www.pokemoncenter.com/en-ca/product/10-10315-108/pokemon-tcg-mega-evolution-ascended-heroes-pokemon-center-elite-trainer-box";

// Helper to detect WAF
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

// Test axios
async function testAxios() {
    console.log("\n========== TESTING AXIOS ==========");
    try {
        const response = await axios.get(TEST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000
        });
        
        console.log("✅ Axios succeeded, status:", response.status);
        console.log("HTML length:", response.data.length);
        
        const protection = detectBotProtection(response.data);
        if (protection) {
            console.log("⚠️  WAF Detected:", protection);
            console.log("First 500 chars:", response.data.substring(0, 500));
        } else {
            console.log("✅ No WAF detected in response");
            // Check for "Unavailable"
            if (response.data.includes("Unavailable")) {
                console.log("✅ Found 'Unavailable' in page");
            } else {
                console.log("❌ 'Unavailable' NOT found in page");
            }
        }
        
        return response.data;
    } catch (err) {
        console.log("❌ Axios failed:", err.message);
        return null;
    }
}

// Test Puppeteer
async function testPuppeteer() {
    console.log("\n========== TESTING PUPPETEER + STEALTH ==========");
    let browser;
    
    try {
        console.log("Launching browser...");
        browser = await PuppeteerExtra.launch({
            args: chromium.args,
            defaultViewport: { width: 1920, height: 1080 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless
        });
        
        const page = await browser.newPage();
        
        console.log("Setting viewport and headers...");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
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
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        });
        
        console.log("Navigating to URL...");
        await page.goto(TEST_URL, { 
            waitUntil: 'networkidle2',
            timeout: 40000
        });
        
        console.log("Waiting for JavaScript...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const html = await page.content();
        console.log("✅ Puppeteer succeeded");
        console.log("HTML length:", html.length);
        
        const protection = detectBotProtection(html);
        if (protection) {
            console.log("⚠️  WAF Still Detected:", protection);
            console.log("First 500 chars:", html.substring(0, 500));
        } else {
            console.log("✅ No WAF detected in Puppeteer response");
            // Check for "Unavailable"
            if (html.includes("Unavailable")) {
                console.log("✅ Found 'Unavailable' in page");
            } else {
                console.log("❌ 'Unavailable' NOT found in page");
            }
        }
        
        return html;
    } catch (err) {
        console.log("❌ Puppeteer failed:", err.message);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Main test
async function runTests() {
    console.log("🔍 DEBUGGING POKEMON CENTER STOCK CHECK");
    console.log("URL:", TEST_URL);
    
    const axiosHtml = await testAxios();
    const puppeteerHtml = await testPuppeteer();
    
    console.log("\n========== SUMMARY ==========");
    if (!axiosHtml && !puppeteerHtml) {
        console.log("❌ Both axios and Puppeteer failed!");
    } else if (axiosHtml && !detectBotProtection(axiosHtml)) {
        console.log("✅ Axios worked and no WAF detected");
    } else if (puppeteerHtml && !detectBotProtection(puppeteerHtml)) {
        console.log("✅ Puppeteer worked and no WAF detected");
    } else {
        console.log("⚠️  Both detected WAF or both failed");
    }
}

runTests().catch(err => console.error("Test error:", err));
