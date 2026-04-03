const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { processMatchElo } = require("../services/elo");
const { processMatchUtr } = require("../services/utr");
const { validateSport, getRatingSystem } = require("../constants");

const router = express.Router();

// POST /api/matches — record a new match
router.post("/", requireAuth, async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { matchType, winners, losers, score, leagueId, sport } = req.body;

    // Validation
    if (!matchType || !["singles", "doubles"].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be 'singles' or 'doubles'" });
    }
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "sport must be 'ping_pong', 'pickleball', or 'tennis'" });
    }
    if (!winners || !losers || !winners.length || !losers.length) {
      return res.status(400).json({ error: "Winners and losers are required" });
    }
    if (matchType === "singles" && (winners.length !== 1 || losers.length !== 1)) {
      return res.status(400).json({ error: "Singles requires exactly 1 winner and 1 loser" });
    }
    if (matchType === "doubles" && (winners.length !== 2 || losers.length !== 2)) {
      return res.status(400).json({ error: "Doubles requires exactly 2 winners and 2 losers" });
    }

    // Check all players are different
    const allIds = [...winners, ...losers];
    if (new Set(allIds).size !== allIds.length) {
      return res.status(400).json({ error: "All players must be different" });
    }

    // Verify all player IDs exist
    const existing = await client.query(
      "SELECT id FROM players WHERE id = ANY($1)",
      [allIds]
    );
    if (existing.rows.length !== allIds.length) {
      return res.status(400).json({ error: "One or more player IDs are invalid" });
    }

    // Derive rating type from context
    let ratingType = "skill";

    // Validate league if provided
    if (leagueId) {
      const league = await client.query("SELECT * FROM leagues WHERE id = $1", [leagueId]);
      if (league.rows.length === 0) {
        return res.status(400).json({ error: "League not found" });
      }
      if (league.rows[0].status !== "active") {
        return res.status(400).json({ error: "League is not active" });
      }
      if (league.rows[0].match_type !== matchType) {
        return res.status(400).json({ error: "Match type does not match league type" });
      }
      if (league.rows[0].sport !== sport) {
        return res.status(400).json({ error: "Sport does not match league sport" });
      }
      ratingType = "league";
    }

    // Begin transaction
    await client.query("BEGIN");

    // Insert match
    const matchResult = await client.query(
      `INSERT INTO matches (match_type, score, recorded_by, league_id, sport)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [matchType, score || null, req.player.id, leagueId || null, sport]
    );
    const match = matchResult.rows[0];

    // Insert match_players
    for (const winnerId of winners) {
      await client.query(
        `INSERT INTO match_players (match_id, player_id, team)
         VALUES ($1, $2, 'winner')`,
        [match.id, winnerId]
      );
    }
    for (const loserId of losers) {
      await client.query(
        `INSERT INTO match_players (match_id, player_id, team)
         VALUES ($1, $2, 'loser')`,
        [match.id, loserId]
      );
    }

    // Process rating updates (Elo for ping pong, UTR for tennis/pickleball)
    if (getRatingSystem(sport) === 'utr') {
      await processMatchUtr(client, match.id, matchType, winners, losers, sport, ratingType);
    } else {
      await processMatchElo(client, match.id, matchType, winners, losers, sport, ratingType);
    }

    await client.query("COMMIT");

    // Fetch full match data to return
    const fullMatch = await db.query(
      `SELECT m.*,
         json_agg(
           json_build_object(
             'player_id', mp.player_id,
             'team', mp.team,
             'elo_before', mp.elo_before,
             'elo_after', mp.elo_after
           )
         ) as players
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       WHERE m.id = $1
       GROUP BY m.id`,
      [match.id]
    );

    res.status(201).json({ match: fullMatch.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Record match error:", err);
    res.status(500).json({ error: "Failed to record match" });
  } finally {
    client.release();
  }
});

// GET /api/matches — all matches with optional filters
router.get("/", requireAuth, async (req, res) => {
  try {
    const { type, sport, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const params = [];

    if (type && ["singles", "doubles"].includes(type)) {
      params.push(type);
      conditions.push(`m.match_type = $${params.length}`);
    }
    if (sport && validateSport(sport)) {
      params.push(sport);
      conditions.push(`m.sport = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(
      `SELECT m.*,
         json_agg(
           json_build_object(
             'player_id', mp.player_id,
             'display_name', p.display_name,
             'team', mp.team,
             'elo_before', mp.elo_before,
             'elo_after', mp.elo_after
           )
         ) as players
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       JOIN players p ON p.id = mp.player_id
       ${whereClause}
       GROUP BY m.id
       ORDER BY m.played_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ matches: result.rows });
  } catch (err) {
    console.error("List matches error:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// GET /api/matches/my — current user's matches with date range
router.get("/my", requireAuth, async (req, res) => {
  try {
    const { days = 7, limit = 50, sport } = req.query;
    const daysInt = parseInt(days);
    const cutoff = daysInt > 9000
      ? new Date("2000-01-01")
      : new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

    const params = [req.player.id, cutoff, parseInt(limit)];
    let sportFilter = "";
    if (sport && validateSport(sport)) {
      params.push(sport);
      sportFilter = `AND m.sport = $${params.length}`;
    }

    const result = await db.query(
      `SELECT m.*,
         json_agg(
           json_build_object(
             'player_id', mp.player_id,
             'display_name', p.display_name,
             'team', mp.team,
             'elo_before', mp.elo_before,
             'elo_after', mp.elo_after
           )
         ) as players
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       JOIN players p ON p.id = mp.player_id
       WHERE m.id IN (
         SELECT match_id FROM match_players WHERE player_id = $1
       )
       AND m.played_at >= $2
       ${sportFilter}
       GROUP BY m.id
       ORDER BY m.played_at DESC
       LIMIT $3`,
      params
    );

    res.json({ matches: result.rows });
  } catch (err) {
    console.error("My matches error:", err);
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

module.exports = router;
