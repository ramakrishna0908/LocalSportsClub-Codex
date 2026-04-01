const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/players — list all players (authenticated)
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, display_name, singles_elo, doubles_elo, created_at
       FROM players ORDER BY display_name ASC`
    );
    res.json({ players: result.rows });
  } catch (err) {
    console.error("List players error:", err);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// GET /api/players/:id — single player profile
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const playerResult = await db.query(
      `SELECT id, username, display_name, email, singles_elo, doubles_elo, created_at, last_login
       FROM players WHERE id = $1`,
      [id]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Get match stats
    const statsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE m.match_type = 'singles') AS singles_played,
         COUNT(*) FILTER (WHERE m.match_type = 'singles' AND mp.team = 'winner') AS singles_wins,
         COUNT(*) FILTER (WHERE m.match_type = 'doubles') AS doubles_played,
         COUNT(*) FILTER (WHERE m.match_type = 'doubles' AND mp.team = 'winner') AS doubles_wins
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = $1`,
      [id]
    );

    res.json({
      player: playerResult.rows[0],
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

module.exports = router;
