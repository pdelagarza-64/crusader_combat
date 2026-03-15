const fs = require("fs");
const path = require("path");

const apiUrl = process.env.API_URL || "";
const outPath = path.join(__dirname, "..", "client", "config.js");
const content = `// Injected at build time (Vercel). API_URL -> Railway backend.\nwindow.API_BASE = "${apiUrl.replace(/"/g, '\\"')}";\n`;

fs.writeFileSync(outPath, content, "utf8");
console.log("Wrote client/config.js with API_BASE =", apiUrl || "(same-origin)");
