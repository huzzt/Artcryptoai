const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: "*" })); // Allow all origins (set your domain in production)

// ── Rate Limiter: 10 requests per user per hour ───────────────
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. You can generate up to 10 artworks per hour. Please try again later.",
    retryAfter: "1 hour"
  },
  keyGenerator: (req) => req.ip
});

app.use("/api/generate", limiter);

// ── Health Check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Crypto Art AI Backend",
    version: "1.0.0",
    rateLimit: "10 generations per IP per hour"
  });
});

// ── Main Generate Endpoint ────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is not configured. Please contact the admin." });
  }

  const { prompt, coin, style, mood } = req.body;

  if (!coin || !style || !mood) {
    return res.status(400).json({ error: "Missing required fields: coin, style, mood" });
  }

  const aiPrompt = `You are a crypto art SVG generator. Return ONLY valid JSON, no markdown, no backticks, no preamble.

User vision: ${prompt || "a stunning, unique crypto art piece"}
Coin/Token: ${coin}
Style: ${style}
Mood: ${mood}

Return this exact JSON structure:
{
  "title": "ART TITLE IN CAPS (max 5 words)",
  "description": "Two sentences describing this art and its crypto symbolism.",
  "svgCode": "FULL SVG STRING HERE"
}

For svgCode: Write a complete SVG with viewBox='0 0 500 500'. Include <defs> with <linearGradient> and <radialGradient> elements plus one <filter> with <feGaussianBlur> for glow. Use layered geometric shapes (circles, polygons, paths with curves), a large centered coin symbol as <text> (use: ₿ for Bitcoin, Ξ for Ethereum, ◎ for Solana, Ð for Dogecoin, ₳ for Cardano, ⬡ for Polygon, ✕ for XRP, ◈ for Generic, ▲ for Avalanche), scattered particle dots, radial connecting lines. Colors by style — Cyberpunk: #05050f bg, #7c3aed+#2563eb+#00ffcc; Vaporwave: #1a0a2e bg, #c084fc+#f472b6+#67e8f9; Glitch Art: #000 bg, #00ff41+#ff0040+#0080ff; Sacred Geometry: #08081a bg, #4f46e5+#fbbf24+#c4b5fd; Pixel Art: #1a1a2e bg sharp rectangles, #e94560+#f5a623+#4ecca3; Abstract Neon: #020008 bg, #ff00ff+#00ffff+#ff6600; Futuristic: #030512 bg, #0a2a5e+#00ccff+#66ffcc; Dark Surrealism: #060202 bg, #800000+#cc2200+#ffcc00. Max 2800 chars for svgCode. No external resources. Pure SVG only.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: aiPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.content.map(i => i.text || "").join("");
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ success: true, ...parsed });

  } catch (err) {
    console.error("Generate error:", err.message);
    res.status(500).json({ error: err.message || "Failed to generate art. Please try again." });
  }
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Crypto Art AI Backend running on port ${PORT}`);
  console.log(`📡 API Key: ${ANTHROPIC_API_KEY ? "✓ Loaded" : "✗ MISSING - set ANTHROPIC_API_KEY env var"}`);
});
