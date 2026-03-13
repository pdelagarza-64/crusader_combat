const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, "..");
const CLIENT_DIR = path.join(ROOT_DIR, "client");
const DATA_FILE = path.join(__dirname, "leaderboard.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ scores: [] }, null, 2), "utf8");
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function handleApi(req, res) {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (parsedUrl.pathname === "/api/leaderboard" && req.method === "GET") {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { scores: [] };
    }
    data.scores.sort((a, b) => b.score - a.score);
    return sendJson(res, 200, { scores: data.scores.slice(0, 10) });
  }

  if (parsedUrl.pathname === "/api/score" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const name = String(payload.name || "").trim().slice(0, 16) || "Anonymous";
        const score = Number(payload.score) || 0;
        const survivedSeconds = Number(payload.survivedSeconds) || 0;

        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = { scores: [] };
        }
        if (!Array.isArray(data.scores)) data.scores = [];

        data.scores.push({
          name,
          score,
          survivedSeconds,
          createdAt: new Date().toISOString()
        });

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
        return sendJson(res, 201, { ok: true });
      } catch (err) {
        console.error("Failed to save score", err);
        return sendJson(res, 400, { ok: false, error: "Invalid JSON" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function handleStatic(req, res) {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(CLIENT_DIR, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname === "/index.html") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Game frontend not found. Make sure client/index.html exists.");
      } else {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      }
      return;
    }

    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  if (parsedUrl.pathname && parsedUrl.pathname.startsWith("/api/")) {
    return handleApi(req, res);
  }
  return handleStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Crusader Combat server running at http://localhost:${PORT}`);
});

