const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/leagues — create a new league
router.post("/", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, description, matchType, startDate, endDate } = req.body;

    if (!name || !matchType || !startDate || !endDate) {
      return res.status(400).json({ error: "name, matchType, startDate, and endDate are required" });
    }
    if (!["singles", "doubles"].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be 'singles' or 'doubles'" });
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ error: "endDate must be after startDate" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO leagues (name, description, match_type, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, matchType, startDate, endDate, req.player.id]
    );
    const league = result.rows[0];

    // Creator auto-joins
    await client.query(
      `INSERT INTO league_players (league_id, player_id) VALUES ($1, $2)`,
      [league.id, req.player.id]
    );

    await client.query("COMMIT");

    res.status(201).json({ league });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create league error:", err);
    res.status(500).json({ error: "Failed to create league" });
  } finally {
    client.release();
  }
});

// GET /api/leagues — list leagues with optional filters
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, matchType } = req.query;
    const conditions = [];
    const params = [];

    if (status && ["upcoming", "active", "completed"].includes(status)) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (matchType && ["singles", "doubles"].includes(matchType)) {
      params.push(matchType);
      conditions.push(`l.match_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT l.*,
         p.display_name AS created_by_name,
         (SELECT COUNT(*) FROM league_players lp WHERE lp.league_id = l.id) AS player_count
       FROM leagues l
       JOIN players p ON p.id = l.created_by
       ${whereClause}
       ORDER BY
         CASE l.status
           WHEN 'active' THEN 0
           WHEN 'upcoming' THEN 1
           WHEN 'completed' THEN 2
         END,
         l.start_date DESC`,
      params
    );

    const leagues = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      playerCount: parseInt(row.player_count),
      createdAt: row.created_at,
    }));

    res.json({ leagues });
  } catch (err) {
    console.error("List leagues error:", err);
    res.status(500).json({ error: "Failed to fetch leagues" });
  }
});

// GET /api/leagues/:id — league detail with players
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const leagueResult = await db.query(
      `SELECT l.*, p.display_name AS created_by_name
       FROM leagues l
       JOIN players p ON p.id = l.created_by
       WHERE l.id = $1`,
      [id]
    );
    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    const row = leagueResult.rows[0];

    const playersResult = await db.query(
      `SELECT p.id, p.username, p.display_name, p.singles_elo, p.doubles_elo, lp.joined_at
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       WHERE lp.league_id = $1
       ORDER BY lp.joined_at`,
      [id]
    );

    // Compute standings
    const standingsResult = await db.query(
      `SELECT
         p.id, p.display_name, p.username,
         COUNT(mp.id) FILTER (WHERE mp.team = 'winner') AS wins,
         COUNT(mp.id) FILTER (WHERE mp.team = 'loser') AS losses,
         COUNT(mp.id) AS played
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       LEFT JOIN match_players mp ON mp.player_id = p.id
         AND mp.match_id IN (SELECT m.id FROM matches m WHERE m.league_id = $1)
       WHERE lp.league_id = $1
       GROUP BY p.id
       ORDER BY
         COUNT(mp.id) FILTER (WHERE mp.team = 'winner') * 3 DESC,
         COUNT(mp.id) FILTER (WHERE mp.team = 'winner') DESC`,
      [id]
    );

    const standings = standingsResult.rows.map((s, index) => ({
      rank: index + 1,
      id: s.id,
      displayName: s.display_name,
      username: s.username,
      wins: parseInt(s.wins),
      losses: parseInt(s.losses),
      played: parseInt(s.played),
      points: parseInt(s.wins) * 3,
    }));

    // Check if current player is a member
    const isMember = playersResult.rows.some((p) => p.id === req.player.id);

    const league = {
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      players: playersResult.rows.map((p) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        singlesElo: p.singles_elo,
        doublesElo: p.doubles_elo,
        joinedAt: p.joined_at,
      })),
      standings,
      isMember,
    };

    res.json({ league });
  } catch (err) {
    console.error("League detail error:", err);
    res.status(500).json({ error: "Failed to fetch league" });
  }
});

// POST /api/leagues/:id/join
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (!["upcoming", "active"].includes(league.rows[0].status)) {
      return res.status(400).json({ error: "Cannot join a completed league" });
    }

    await db.query(
      `INSERT INTO league_players (league_id, player_id) VALUES ($1, $2)
       ON CONFLICT (league_id, player_id) DO NOTHING`,
      [id, req.player.id]
    );

    res.json({ message: "Joined league" });
  } catch (err) {
    console.error("Join league error:", err);
    res.status(500).json({ error: "Failed to join league" });
  }
});

// POST /api/leagues/:id/leave
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (league.rows[0].status === "completed") {
      return res.status(400).json({ error: "Cannot leave a completed league" });
    }

    await db.query(
      "DELETE FROM league_players WHERE league_id = $1 AND player_id = $2",
      [id, req.player.id]
    );

    res.json({ message: "Left league" });
  } catch (err) {
    console.error("Leave league error:", err);
    res.status(500).json({ error: "Failed to leave league" });
  }
});

// PATCH /api/leagues/:id/status — update league status (creator only)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (league.rows[0].created_by !== req.player.id) {
      return res.status(403).json({ error: "Only the league creator can update status" });
    }

    const validTransitions = {
      upcoming: ["active"],
      active: ["completed"],
    };
    const allowed = validTransitions[league.rows[0].status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from '${league.rows[0].status}' to '${status}'`,
      });
    }

    await db.query("UPDATE leagues SET status = $1 WHERE id = $2", [status, id]);

    res.json({ message: `League status updated to '${status}'` });
  } catch (err) {
    console.error("Update league status error:", err);
    res.status(500).json({ error: "Failed to update league status" });
  }
});

module.exports = router;
