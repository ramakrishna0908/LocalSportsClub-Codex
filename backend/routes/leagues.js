const express = require("express");
const db = require("../db");
const { requireAuth, requireAdminOrDirector } = require("../middleware/auth");
const { validateSport, getRatingSystem } = require("../constants");
const { getDefaultElo, getDefaultUtr, getDefaultRating } = require("../services/ratingDefaults");
const { isClubAdmin } = require("./clubs");

const router = express.Router();

// Helper: check if player is a director of a league
async function isLeagueDirector(leagueId, playerId, client) {
  const conn = client || db;
  const result = await conn.query(
    "SELECT id FROM league_directors WHERE league_id = $1 AND player_id = $2",
    [leagueId, playerId]
  );
  return result.rows.length > 0;
}

// Helper: check if player can manage a league (site admin, league director, or club admin of league's club)
async function canManageLeague(leagueId, player, client) {
  if (player.role === 'admin') return true;
  if (await isLeagueDirector(leagueId, player.id, client)) return true;
  // Check if player is admin of the league's club
  const conn = client || db;
  const league = await conn.query("SELECT club_id FROM leagues WHERE id = $1", [leagueId]);
  if (league.rows.length > 0 && league.rows[0].club_id) {
    if (await isClubAdmin(league.rows[0].club_id, player.id, client)) return true;
  }
  return false;
}

// POST /api/leagues — create a new league (admin or director only)
router.post("/", requireAuth, requireAdminOrDirector, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, description, matchType, startDate, endDate, sport, registrationCloseDate, clubId } = req.body;

    if (!name || !matchType || !startDate || !endDate) {
      return res.status(400).json({ error: "name, matchType, startDate, and endDate are required" });
    }
    if (!["singles", "doubles"].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be 'singles' or 'doubles'" });
    }
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "sport must be 'ping_pong', 'pickleball', or 'tennis'" });
    }
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ error: "endDate must be after startDate" });
    }
    if (registrationCloseDate && registrationCloseDate > endDate) {
      return res.status(400).json({ error: "registrationCloseDate must be on or before endDate" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO leagues (name, description, match_type, start_date, end_date, created_by, sport, registration_close_date, club_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, description || null, matchType, startDate, endDate, req.player.id, sport, registrationCloseDate || null, clubId || null]
    );
    const league = result.rows[0];

    // Creator becomes a director
    await client.query(
      `INSERT INTO league_directors (league_id, player_id) VALUES ($1, $2)
       ON CONFLICT (league_id, player_id) DO NOTHING`,
      [league.id, req.player.id]
    );

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
    const { status, matchType, sport, clubId } = req.query;
    const conditions = [];
    const params = [];

    if (status && ["upcoming", "registration", "active", "completed"].includes(status)) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (matchType && ["singles", "doubles"].includes(matchType)) {
      params.push(matchType);
      conditions.push(`l.match_type = $${params.length}`);
    }
    if (sport && validateSport(sport)) {
      params.push(sport);
      conditions.push(`l.sport = $${params.length}`);
    }
    if (clubId) {
      params.push(clubId);
      conditions.push(`l.club_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT l.*,
         p.display_name AS created_by_name,
         c.name AS club_name,
         (SELECT COUNT(*) FROM league_players lp WHERE lp.league_id = l.id) AS player_count
       FROM leagues l
       JOIN players p ON p.id = l.created_by
       LEFT JOIN clubs c ON c.id = l.club_id
       ${whereClause}
       ORDER BY
         CASE l.status
           WHEN 'active' THEN 0
           WHEN 'registration' THEN 1
           WHEN 'upcoming' THEN 2
           WHEN 'completed' THEN 3
         END,
         l.start_date DESC`,
      params
    );

    const leagues = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      sport: row.sport,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      clubId: row.club_id,
      clubName: row.club_name,
      playerCount: parseInt(row.player_count),
      registrationCloseDate: row.registration_close_date,
      createdAt: row.created_at,
    }));

    res.json({ leagues });
  } catch (err) {
    console.error("List leagues error:", err);
    res.status(500).json({ error: "Failed to fetch leagues" });
  }
});

// GET /api/leagues/:id — league detail with players, directors, groups
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const leagueResult = await db.query(
      `SELECT l.*, p.display_name AS created_by_name, c.name AS club_name
       FROM leagues l
       JOIN players p ON p.id = l.created_by
       LEFT JOIN clubs c ON c.id = l.club_id
       WHERE l.id = $1`,
      [id]
    );
    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    const row = leagueResult.rows[0];
    const leagueSport = row.sport || "ping_pong";

    const isUtr = getRatingSystem(leagueSport) === "utr";
    const defaultElo = await getDefaultElo();
    const defaultUtr = await getDefaultUtr();

    const playersResult = await db.query(
      `SELECT p.id, p.username, p.display_name, lp.joined_at,
              COALESCE(pr.singles_elo, ${defaultElo}) AS singles_elo,
              COALESCE(pr.doubles_elo, ${defaultElo}) AS doubles_elo,
              COALESCE(pr.singles_utr, ${defaultUtr}) AS singles_utr,
              COALESCE(pr.doubles_utr, ${defaultUtr}) AS doubles_utr
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $2 AND pr.rating_type = 'league'
       WHERE lp.league_id = $1
       ORDER BY lp.joined_at`,
      [id, leagueSport]
    );

    // Directors
    const directorsResult = await db.query(
      `SELECT p.id, p.username, p.display_name
       FROM league_directors ld
       JOIN players p ON p.id = ld.player_id
       WHERE ld.league_id = $1`,
      [id]
    );

    // Groups
    const groupsResult = await db.query(
      `SELECT lg.id, lg.name, lg.position
       FROM league_groups lg
       WHERE lg.league_id = $1
       ORDER BY lg.position`,
      [id]
    );

    const groupPlayers = {};
    if (groupsResult.rows.length > 0) {
      const groupIds = groupsResult.rows.map(g => g.id);
      const gpResult = await db.query(
        `SELECT lgp.group_id, lgp.position, p.id AS player_id, p.display_name, p.username,
                COALESCE(pr.singles_elo, ${defaultElo}) AS singles_elo,
                COALESCE(pr.doubles_elo, ${defaultElo}) AS doubles_elo,
                COALESCE(pr.singles_utr, ${defaultUtr}) AS singles_utr,
                COALESCE(pr.doubles_utr, ${defaultUtr}) AS doubles_utr
         FROM league_group_players lgp
         JOIN players p ON p.id = lgp.player_id
         LEFT JOIN player_ratings pr ON pr.player_id = p.id
           AND pr.sport = $2 AND pr.rating_type = 'league'
         WHERE lgp.group_id = ANY($1)
         ORDER BY lgp.position`,
        [groupIds, leagueSport]
      );
      gpResult.rows.forEach(gp => {
        if (!groupPlayers[gp.group_id]) groupPlayers[gp.group_id] = [];
        groupPlayers[gp.group_id].push({
          id: gp.player_id,
          displayName: gp.display_name,
          username: gp.username,
          singlesElo: gp.singles_elo,
          doublesElo: gp.doubles_elo,
          singlesUtr: parseFloat(gp.singles_utr),
          doublesUtr: parseFloat(gp.doubles_utr),
          position: gp.position,
        });
      });
    }

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

    const isMember = playersResult.rows.some((p) => p.id === req.player.id);
    const isDirector = await isLeagueDirector(id, req.player.id);
    const canManage = req.player.role === 'admin' || isDirector;

    const league = {
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      sport: row.sport,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      clubId: row.club_id,
      clubName: row.club_name,
      registrationCloseDate: row.registration_close_date,
      createdAt: row.created_at,
      ratingSystem: isUtr ? "utr" : "elo",
      players: playersResult.rows.map((p) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        singlesElo: p.singles_elo,
        doublesElo: p.doubles_elo,
        singlesUtr: parseFloat(p.singles_utr),
        doublesUtr: parseFloat(p.doubles_utr),
        joinedAt: p.joined_at,
      })),
      directors: directorsResult.rows.map((d) => ({
        id: d.id,
        username: d.username,
        displayName: d.display_name,
      })),
      groups: groupsResult.rows.map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
        players: groupPlayers[g.id] || [],
      })),
      standings,
      isMember,
      isDirector,
      canManage,
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
    if (!["upcoming", "registration"].includes(league.rows[0].status)) {
      return res.status(400).json({ error: "Registration is closed. You can only join leagues that are open for registration." });
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
    if (["active", "completed"].includes(league.rows[0].status)) {
      return res.status(400).json({ error: "Cannot leave an active or completed league" });
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

// PATCH /api/leagues/:id/status — update league status (director or admin)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (!(await canManageLeague(id, req.player))) {
      return res.status(403).json({ error: "Only league directors or admins can update status" });
    }

    const validTransitions = {
      upcoming: ["registration"],
      registration: ["active"],
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

// POST /api/leagues/:id/directors — add a director (director or admin)
router.post("/:id/directors", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (!(await canManageLeague(id, req.player))) {
      return res.status(403).json({ error: "Only league directors or admins can add directors" });
    }

    // Verify target player has director or admin role
    const target = await db.query("SELECT role FROM players WHERE id = $1", [playerId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }
    if (!['admin', 'director'].includes(target.rows[0].role)) {
      return res.status(400).json({ error: "Player must have director or admin role" });
    }

    await db.query(
      `INSERT INTO league_directors (league_id, player_id) VALUES ($1, $2)
       ON CONFLICT (league_id, player_id) DO NOTHING`,
      [id, playerId]
    );

    res.json({ message: "Director added" });
  } catch (err) {
    console.error("Add league director error:", err);
    res.status(500).json({ error: "Failed to add director" });
  }
});

// DELETE /api/leagues/:id/directors/:playerId — remove a director
router.delete("/:id/directors/:playerId", requireAuth, async (req, res) => {
  try {
    const { id, playerId } = req.params;

    if (!(await canManageLeague(id, req.player))) {
      return res.status(403).json({ error: "Only league directors or admins can remove directors" });
    }

    await db.query(
      "DELETE FROM league_directors WHERE league_id = $1 AND player_id = $2",
      [id, playerId]
    );

    res.json({ message: "Director removed" });
  } catch (err) {
    console.error("Remove league director error:", err);
    res.status(500).json({ error: "Failed to remove director" });
  }
});

// PATCH /api/leagues/:id — update league settings (dates, etc.) — admin only
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { registrationCloseDate, startDate, endDate } = req.body;

    const league = await db.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }

    const isAdmin = req.player.role === 'admin';
    const isDirector = await isLeagueDirector(id, req.player.id);

    // Registration close date: admin only. Dates: admin or director.
    if (registrationCloseDate !== undefined && !isAdmin) {
      return res.status(403).json({ error: "Only admins can update registration close date" });
    }
    if ((startDate || endDate) && !isAdmin && !isDirector) {
      return res.status(403).json({ error: "Only admins or league directors can update dates" });
    }
    if (!isAdmin && !isDirector) {
      return res.status(403).json({ error: "Only admins or league directors can update league settings" });
    }

    // Use new values if provided, otherwise fall back to existing
    const effectiveStart = startDate || new Date(league.rows[0].start_date).toISOString().split("T")[0];
    const effectiveEnd = endDate || new Date(league.rows[0].end_date).toISOString().split("T")[0];

    if (startDate || endDate) {
      if (effectiveEnd <= effectiveStart) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
    }

    if (startDate) {
      await db.query("UPDATE leagues SET start_date = $1 WHERE id = $2", [startDate, id]);
    }
    if (endDate) {
      await db.query("UPDATE leagues SET end_date = $1 WHERE id = $2", [endDate, id]);
    }

    if (registrationCloseDate !== undefined) {
      if (registrationCloseDate) {
        const closeStr = new Date(registrationCloseDate).toISOString().split("T")[0];
        if (closeStr > effectiveEnd) {
          return res.status(400).json({ error: "Registration close date must be on or before the end date" });
        }
      }
      await db.query(
        "UPDATE leagues SET registration_close_date = $1 WHERE id = $2",
        [registrationCloseDate || null, id]
      );
    }

    res.json({ message: "League updated" });
  } catch (err) {
    console.error("Update league error:", err);
    res.status(500).json({ error: "Failed to update league" });
  }
});

// POST /api/leagues/:id/shuffle-groups — create groups based on rankings
router.post("/:id/shuffle-groups", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { groupSize, mode } = req.body; // mode: 'sequential' or 'snake'

    const league = await client.query("SELECT * FROM leagues WHERE id = $1", [id]);
    if (league.rows.length === 0) {
      return res.status(404).json({ error: "League not found" });
    }
    if (!(await canManageLeague(id, req.player, client))) {
      return res.status(403).json({ error: "Only league directors or admins can shuffle groups" });
    }

    // Check admin setting for allowed modes
    const settingResult = await client.query(
      "SELECT value FROM club_settings WHERE key = 'group_shuffle_mode'"
    );
    const allowedMode = settingResult.rows.length > 0 ? settingResult.rows[0].value : 'both';
    const shuffleMode = mode || (allowedMode === 'both' ? 'sequential' : allowedMode);

    if (allowedMode !== 'both' && shuffleMode !== allowedMode) {
      return res.status(400).json({ error: `Only '${allowedMode}' mode is enabled by admin` });
    }
    if (!['sequential', 'snake'].includes(shuffleMode)) {
      return res.status(400).json({ error: "mode must be 'sequential' or 'snake'" });
    }

    const leagueSport = league.rows[0].sport || "ping_pong";
    const matchType = league.rows[0].match_type;
    const isUtr = getRatingSystem(leagueSport) === "utr";
    const ratingField = isUtr
      ? (matchType === "doubles" ? "doubles_utr" : "singles_utr")
      : (matchType === "doubles" ? "doubles_elo" : "singles_elo");
    const defaultVal = await getDefaultRating(leagueSport);
    const size = groupSize || 3;

    // Get players ordered by their league rating (descending)
    const playersResult = await client.query(
      `SELECT lp.player_id, p.display_name,
              COALESCE(pr.${ratingField}, ${defaultVal}) AS rating
       FROM league_players lp
       JOIN players p ON p.id = lp.player_id
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $2 AND pr.rating_type = 'league'
       WHERE lp.league_id = $1
       ORDER BY COALESCE(pr.${ratingField}, ${defaultVal}) DESC`,
      [id, leagueSport]
    );

    const players = playersResult.rows;
    if (players.length < 2) {
      return res.status(400).json({ error: "Need at least 2 players to create groups" });
    }

    const numGroups = Math.ceil(players.length / size);

    await client.query("BEGIN");

    // Delete existing groups for this league
    await client.query("DELETE FROM league_groups WHERE league_id = $1", [id]);

    // Create groups
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      const groupName = `Group ${String.fromCharCode(65 + i)}`; // A, B, C...
      const groupResult = await client.query(
        `INSERT INTO league_groups (league_id, name, position) VALUES ($1, $2, $3) RETURNING id`,
        [id, groupName, i]
      );
      groups.push({ id: groupResult.rows[0].id, name: groupName, players: [] });
    }

    // Distribute players based on mode
    for (let i = 0; i < players.length; i++) {
      let groupIdx;
      if (shuffleMode === 'sequential') {
        // Sequential/tiered: top N in Group A, next N in Group B, etc.
        groupIdx = Math.floor(i / size);
        if (groupIdx >= numGroups) groupIdx = numGroups - 1;
      } else {
        // Snake draft: 0,1,2 -> A,B,C then 3,4,5 -> C,B,A
        const round = Math.floor(i / numGroups);
        const posInRound = i % numGroups;
        groupIdx = round % 2 === 0 ? posInRound : (numGroups - 1 - posInRound);
      }
      const group = groups[groupIdx];

      await client.query(
        `INSERT INTO league_group_players (group_id, player_id, position)
         VALUES ($1, $2, $3)`,
        [group.id, players[i].player_id, group.players.length]
      );
      group.players.push(players[i]);
    }

    await client.query("COMMIT");

    res.json({
      message: "Groups created",
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        players: g.players.map(p => ({
          id: p.player_id,
          displayName: p.display_name,
          rating: p.rating,
        })),
      })),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Shuffle groups error:", err);
    res.status(500).json({ error: "Failed to shuffle groups" });
  } finally {
    client.release();
  }
});

module.exports = router;
