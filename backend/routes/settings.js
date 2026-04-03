const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /api/settings — get all settings (authenticated)
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT key, value FROM club_settings");
    const settings = {};
    result.rows.forEach((r) => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PATCH /api/settings — update a setting (admin only)
router.patch("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: "key and value are required" });
    }

    await db.query(
      `INSERT INTO club_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, value]
    );

    res.json({ message: "Setting updated", key, value });
  } catch (err) {
    console.error("Update setting error:", err);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

module.exports = router;
