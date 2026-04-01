const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { generateToken, getExpiryDate, requireAuth } = require("../middleware/auth");

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, displayName, password, email } = req.body;

    // Validation
    if (!username || username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: "Display name is required" });
    }

    // Check existing username
    const existing = await db.query(
      "SELECT id FROM players WHERE username = $1",
      [username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Check existing email
    if (email) {
      const emailExists = await db.query(
        "SELECT id FROM players WHERE email = $1",
        [email.toLowerCase()]
      );
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    // Hash password and create player
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO players (username, display_name, email, password_hash, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, username, display_name, email, singles_elo, doubles_elo, created_at`,
      [username.toLowerCase(), displayName.trim(), email ? email.toLowerCase() : null, passwordHash]
    );

    const player = result.rows[0];

    // Create session
    const token = generateToken(player.id);
    await db.query(
      "INSERT INTO sessions (player_id, token, expires_at) VALUES ($1, $2, $3)",
      [player.id, token, getExpiryDate()]
    );

    res.status(201).json({ player, token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Find player
    const result = await db.query(
      "SELECT * FROM players WHERE username = $1",
      [username.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const player = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Clean old sessions for this player
    await db.query("DELETE FROM sessions WHERE player_id = $1", [player.id]);

    // Create new session
    const token = generateToken(player.id);
    await db.query(
      "INSERT INTO sessions (player_id, token, expires_at) VALUES ($1, $2, $3)",
      [player.id, token, getExpiryDate()]
    );

    // Update last login
    await db.query("UPDATE players SET last_login = NOW() WHERE id = $1", [player.id]);

    // Return player without password_hash
    const { password_hash, ...safePlayer } = player;
    res.json({ player: safePlayer, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req, res) => {
  try {
    await db.query("DELETE FROM sessions WHERE token = $1", [req.token]);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Logout failed" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ player: req.player });
});

module.exports = router;
