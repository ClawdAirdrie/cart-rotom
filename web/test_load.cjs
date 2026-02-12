
const start = Date.now();
try {
    console.log("Attempting to require ./functions/index.js...");
    const functions = require('./functions/index.js');
    console.log("Successfully loaded index.js in " + (Date.now() - start) + "ms");
    console.log("Exports available: " + Object.keys(functions).join(", "));
} catch (e) {
    console.error("Failed to load index.js:", e);
}
