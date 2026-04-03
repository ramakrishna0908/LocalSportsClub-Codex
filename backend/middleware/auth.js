const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret";
const JWT_EXPIRY = "7d";

function generateToken(playerId) {
  return jwt.sign({ id: playerId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function getExpiryDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// Middleware: require authentication
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.split(" ")[1];

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Check if session exists (not logged out)
    const session = await db.query(
      "SELECT id FROM sessions WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (session.rows.length === 0) {
      return res.status(401).json({ error: "Session expired or logged out" });
    }

    // Attach player to request
    const player = await db.query(
      "SELECT id, username, display_name, email, singles_elo, doubles_elo, default_sport, role, created_at FROM players WHERE id = $1",
      [decoded.id]
    );
    if (player.rows.length === 0) {
      return res.status(401).json({ error: "Player not found" });
    }

    req.player = player.rows[0];
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (req.player.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Middleware: require admin or director role
function requireAdminOrDirector(req, res, next) {
  if (req.player.role !== 'admin' && req.player.role !== 'director') {
    return res.status(403).json({ error: "Admin or director access required" });
  }
  next();
}

module.exports = { generateToken, getExpiryDate, requireAuth, requireAdmin, requireAdminOrDirector, JWT_SECRET };
