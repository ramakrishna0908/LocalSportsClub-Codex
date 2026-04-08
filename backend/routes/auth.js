const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { generateToken, getExpiryDate, requireAuth, requireAdmin } = require("../middleware/auth");
const { VALID_SPORTS, VALID_RATING_TYPES, validateSport } = require("../constants");
const { ensurePlayerRatings } = require("../services/elo");

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { username, displayName, password, email, defaultSport, sports } = req.body;

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

    // Validate selected sports (at least one required)
    const selectedSports = (Array.isArray(sports) ? sports : []).filter(s => validateSport(s));
    if (selectedSports.length === 0) {
      return res.status(400).json({ error: "Please select at least one sport" });
    }

    const sport = defaultSport && validateSport(defaultSport) ? defaultSport
      : selectedSports[0];

    // Check existing username
    const existing = await client.query(
      "SELECT id FROM players WHERE username = $1",
      [username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Check existing email
    if (email) {
      const emailExists = await client.query(
        "SELECT id FROM players WHERE email = $1",
        [email.toLowerCase()]
      );
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }
    }

    await client.query("BEGIN");

    // Hash password and create player
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await client.query(
      `INSERT INTO players (username, display_name, email, password_hash, default_sport, last_login)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, username, display_name, email, default_sport, created_at`,
      [username.toLowerCase(), displayName.trim(), email ? email.toLowerCase() : null, passwordHash, sport]
    );

    const player = result.rows[0];

    // Record selected sports and seed ratings only for those
    for (const s of selectedSports) {
      await client.query(
        "INSERT INTO player_sports (player_id, sport) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [player.id, s]
      );
      await ensurePlayerRatings(client, [player.id], s);
    }

    // Create session
    const token = generateToken(player.id);
    await client.query(
      "INSERT INTO sessions (player_id, token, expires_at) VALUES ($1, $2, $3)",
      [player.id, token, getExpiryDate()]
    );

    await client.query("COMMIT");

    res.status(201).json({ player, token });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
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

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const result = await db.query(
      "SELECT password_hash FROM players WHERE id = $1",
      [req.player.id]
    );
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query("UPDATE players SET password_hash = $1 WHERE id = $2", [newHash, req.player.id]);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PATCH /api/auth/role — admin only: assign role to a user
router.patch("/role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { playerId, role } = req.body;

    if (!playerId || !role) {
      return res.status(400).json({ error: "playerId and role are required" });
    }
    if (!['admin', 'director', 'user'].includes(role)) {
      return res.status(400).json({ error: "role must be 'admin', 'director', or 'user'" });
    }

    const result = await db.query(
      "UPDATE players SET role = $1 WHERE id = $2 RETURNING id, username, display_name, role",
      [role, playerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json({ player: result.rows[0] });
  } catch (err) {
    console.error("Assign role error:", err);
    res.status(500).json({ error: "Failed to assign role" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const sportsResult = await db.query(
    "SELECT sport FROM player_sports WHERE player_id = $1 ORDER BY sport",
    [req.player.id]
  );
  res.json({
    player: {
      ...req.player,
      sports: sportsResult.rows.map(r => r.sport),
    },
  });
});

module.exports = router;
