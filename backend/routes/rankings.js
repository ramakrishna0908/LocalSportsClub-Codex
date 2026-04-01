const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/rankings/singles
router.get("/singles", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         p.id, p.username, p.display_name, p.singles_elo as elo,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'singles') AS played,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'singles' AND mp.team = 'winner') AS wins
       FROM players p
       LEFT JOIN match_players mp ON mp.player_id = p.id
       LEFT JOIN matches m ON m.id = mp.match_id
       GROUP BY p.id
       ORDER BY p.singles_elo DESC`
    );

    const rankings = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      elo: row.elo,
      played: parseInt(row.played),
      wins: parseInt(row.wins),
      winRate: parseInt(row.played) > 0
        ? Math.round((parseInt(row.wins) / parseInt(row.played)) * 100)
        : 0,
    }));

    res.json({ rankings });
  } catch (err) {
    console.error("Singles rankings error:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/doubles
router.get("/doubles", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         p.id, p.username, p.display_name, p.doubles_elo as elo,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'doubles') AS played,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'doubles' AND mp.team = 'winner') AS wins
       FROM players p
       LEFT JOIN match_players mp ON mp.player_id = p.id
       LEFT JOIN matches m ON m.id = mp.match_id
       GROUP BY p.id
       ORDER BY p.doubles_elo DESC`
    );

    const rankings = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      elo: row.elo,
      played: parseInt(row.played),
      wins: parseInt(row.wins),
      winRate: parseInt(row.played) > 0
        ? Math.round((parseInt(row.wins) / parseInt(row.played)) * 100)
        : 0,
    }));

    res.json({ rankings });
  } catch (err) {
    console.error("Doubles rankings error:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

module.exports = router;
