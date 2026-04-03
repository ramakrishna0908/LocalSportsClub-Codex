const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validateSport } = require("../constants");

const router = express.Router();

// GET /api/players — list all players (authenticated)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { sport } = req.query;
    const sportVal = sport && validateSport(sport) ? sport : "ping_pong";

    const result = await db.query(
      `SELECT p.id, p.username, p.display_name, p.role, p.default_sport, p.created_at,
              COALESCE(pr.singles_elo, 1000) AS singles_elo,
              COALESCE(pr.doubles_elo, 1000) AS doubles_elo
       FROM players p
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $1 AND pr.rating_type = 'skill'
       ORDER BY p.display_name ASC`,
      [sportVal]
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
    const { sport } = req.query;
    const sportVal = sport && validateSport(sport) ? sport : "ping_pong";

    const playerResult = await db.query(
      `SELECT id, username, display_name, email, default_sport, created_at, last_login
       FROM players WHERE id = $1`,
      [id]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Get all ratings for this player
    const ratingsResult = await db.query(
      `SELECT sport, rating_type, singles_elo, doubles_elo
       FROM player_ratings WHERE player_id = $1
       ORDER BY sport, rating_type`,
      [id]
    );

    // Get match stats filtered by sport
    const statsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE m.match_type = 'singles') AS singles_played,
         COUNT(*) FILTER (WHERE m.match_type = 'singles' AND mp.team = 'winner') AS singles_wins,
         COUNT(*) FILTER (WHERE m.match_type = 'doubles') AS doubles_played,
         COUNT(*) FILTER (WHERE m.match_type = 'doubles' AND mp.team = 'winner') AS doubles_wins
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = $1 AND m.sport = $2`,
      [id, sportVal]
    );

    res.json({
      player: playerResult.rows[0],
      ratings: ratingsResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

// PATCH /api/players/me/default-sport — update default sport
router.patch("/me/default-sport", requireAuth, async (req, res) => {
  try {
    const { sport } = req.body;
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "Invalid sport" });
    }

    await db.query(
      "UPDATE players SET default_sport = $1 WHERE id = $2",
      [sport, req.player.id]
    );

    res.json({ message: "Default sport updated", defaultSport: sport });
  } catch (err) {
    console.error("Update default sport error:", err);
    res.status(500).json({ error: "Failed to update default sport" });
  }
});

module.exports = router;
