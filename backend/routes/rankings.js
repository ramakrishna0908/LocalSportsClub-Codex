const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validateSport, validateRatingType, getRatingSystem } = require("../constants");
const { getDefaultRating } = require("../services/ratingDefaults");

const router = express.Router();

// GET /api/rankings/singles
router.get("/singles", requireAuth, async (req, res) => {
  try {
    const { sport = "ping_pong", ratingType = "skill" } = req.query;

    if (!validateSport(sport)) {
      return res.status(400).json({ error: "Invalid sport" });
    }
    if (!validateRatingType(ratingType)) {
      return res.status(400).json({ error: "Invalid ratingType" });
    }

    const isUtr = getRatingSystem(sport) === "utr";
    const ratingCol = isUtr ? "singles_utr" : "singles_elo";
    const defaultVal = await getDefaultRating(sport);

    const result = await db.query(
      `SELECT
         p.id, p.username, p.display_name,
         COALESCE(pr.${ratingCol}, ${defaultVal}) AS rating,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'singles' AND m.sport = $1) AS played,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'singles' AND m.sport = $1 AND mp.team = 'winner') AS wins
       FROM players p
       JOIN player_sports ps ON ps.player_id = p.id AND ps.sport = $1
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $1 AND pr.rating_type = $2
       LEFT JOIN match_players mp ON mp.player_id = p.id
       LEFT JOIN matches m ON m.id = mp.match_id
       GROUP BY p.id, pr.${ratingCol}
       ORDER BY COALESCE(pr.${ratingCol}, ${defaultVal}) DESC`,
      [sport, ratingType]
    );

    const rankings = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      rating: isUtr ? parseFloat(row.rating) : parseInt(row.rating),
      played: parseInt(row.played),
      wins: parseInt(row.wins),
      winRate: parseInt(row.played) > 0
        ? Math.round((parseInt(row.wins) / parseInt(row.played)) * 100)
        : 0,
    }));

    res.json({ rankings, ratingSystem: isUtr ? "utr" : "elo", defaultRating: defaultVal });
  } catch (err) {
    console.error("Singles rankings error:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/doubles
router.get("/doubles", requireAuth, async (req, res) => {
  try {
    const { sport = "ping_pong", ratingType = "skill" } = req.query;

    if (!validateSport(sport)) {
      return res.status(400).json({ error: "Invalid sport" });
    }
    if (!validateRatingType(ratingType)) {
      return res.status(400).json({ error: "Invalid ratingType" });
    }

    const isUtr = getRatingSystem(sport) === "utr";
    const ratingCol = isUtr ? "doubles_utr" : "doubles_elo";
    const defaultVal = await getDefaultRating(sport);

    const result = await db.query(
      `SELECT
         p.id, p.username, p.display_name,
         COALESCE(pr.${ratingCol}, ${defaultVal}) AS rating,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'doubles' AND m.sport = $1) AS played,
         COUNT(mp.id) FILTER (WHERE m.match_type = 'doubles' AND m.sport = $1 AND mp.team = 'winner') AS wins
       FROM players p
       JOIN player_sports ps ON ps.player_id = p.id AND ps.sport = $1
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $1 AND pr.rating_type = $2
       LEFT JOIN match_players mp ON mp.player_id = p.id
       LEFT JOIN matches m ON m.id = mp.match_id
       GROUP BY p.id, pr.${ratingCol}
       ORDER BY COALESCE(pr.${ratingCol}, ${defaultVal}) DESC`,
      [sport, ratingType]
    );

    const rankings = result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      rating: isUtr ? parseFloat(row.rating) : parseInt(row.rating),
      played: parseInt(row.played),
      wins: parseInt(row.wins),
      winRate: parseInt(row.played) > 0
        ? Math.round((parseInt(row.wins) / parseInt(row.played)) * 100)
        : 0,
    }));

    res.json({ rankings, ratingSystem: isUtr ? "utr" : "elo", defaultRating: defaultVal });
  } catch (err) {
    console.error("Doubles rankings error:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

module.exports = router;
