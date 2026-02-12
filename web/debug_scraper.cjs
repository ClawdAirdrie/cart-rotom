
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');

const url = process.argv[2] || 'https://www.pokemoncenter.com/product/710-95846/pokemon-tcg-scarlet-and-violet-prismatic-evolutions-elite-trainer-box'; // Example URL

async function dumpHtml() {
    console.log(`Fetching ${url}...`);
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000,
            decompress: true
        });

        const html = response.data;
        console.log(`Fetched ${html.length} bytes.`);

        fs.writeFileSync('pokemon_dump.html', html);
        console.log('Saved to pokemon_dump.html');

        const $ = cheerio.load(html);
        const bodyText = $('body').text();

        const keyword = "Unavailable";
        if (bodyText.includes(keyword)) {
            console.log(`SUCCESS: Found keyword "${keyword}" in body text.`);
        } else {
            console.log(`FAILURE: Keyword "${keyword}" NOT found in body text.`);
            console.log("Body text preview:", bodyText.substring(0, 200).replace(/\s+/g, ' '));
        }

    } catch (error) {
        console.error("Error fetching URL:", error.message);
        if (error.response) {
            console.log("Status:", error.response.status);
        }
    }
}

dumpHtml();
