const express = require("express");
const db = require("../db");
const { requireAuth, requireAdminOrDirector } = require("../middleware/auth");
const { processMatchElo } = require("../services/elo");
const {
  generateBracket,
  generateTeamBracket,
  generateTeamRoundRobin,
  advanceWinner,
  advanceTeamWinner,
  nextPowerOf2,
} = require("../services/bracket");
const { validateSport } = require("../constants");
const { isClubAdmin } = require("./clubs");

const router = express.Router();

// Helper: check if player is a director of a tournament
async function isTournamentDirector(tournamentId, playerId, client) {
  const conn = client || db;
  const result = await conn.query(
    "SELECT id FROM tournament_directors WHERE tournament_id = $1 AND player_id = $2",
    [tournamentId, playerId]
  );
  return result.rows.length > 0;
}

// Helper: check if player can manage a tournament (site admin, tournament director, or club admin)
async function canManageTournament(tournamentId, player, client) {
  if (player.role === 'admin') return true;
  if (await isTournamentDirector(tournamentId, player.id, client)) return true;
  const conn = client || db;
  const tourney = await conn.query("SELECT club_id FROM tournaments WHERE id = $1", [tournamentId]);
  if (tourney.rows.length > 0 && tourney.rows[0].club_id) {
    if (await isClubAdmin(tourney.rows[0].club_id, player.id, client)) return true;
  }
  return false;
}

// POST /api/tournaments — create a new tournament (admin or director only)
router.post("/", requireAuth, requireAdminOrDirector, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, description, matchType, tournamentDate, maxPlayers, sport, tournamentType, format, clubId } = req.body;

    if (!name || !matchType || !tournamentDate) {
      return res.status(400).json({ error: "name, matchType, and tournamentDate are required" });
    }
    if (!["singles", "doubles", "both"].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be 'singles', 'doubles', or 'both'" });
    }
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "sport must be 'ping_pong', 'pickleball', or 'tennis'" });
    }
    const tType = tournamentType || "individual";
    if (!["individual", "team"].includes(tType)) {
      return res.status(400).json({ error: "tournamentType must be 'individual' or 'team'" });
    }
    const tFormat = format || "knockout";
    if (!["knockout", "round_robin"].includes(tFormat)) {
      return res.status(400).json({ error: "format must be 'knockout' or 'round_robin'" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO tournaments (name, description, match_type, tournament_date, max_players, created_by, sport, tournament_type, format, club_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, description || null, matchType, tournamentDate, maxPlayers || null, req.player.id, sport, tType, tFormat, clubId || null]
    );
    const tournament = result.rows[0];

    // Creator becomes a director
    await client.query(
      `INSERT INTO tournament_directors (tournament_id, player_id) VALUES ($1, $2)
       ON CONFLICT (tournament_id, player_id) DO NOTHING`,
      [tournament.id, req.player.id]
    );

    await client.query("COMMIT");

    res.status(201).json({ tournament });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create tournament error:", err);
    res.status(500).json({ error: "Failed to create tournament" });
  } finally {
    client.release();
  }
});

// GET /api/tournaments — list tournaments
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, matchType, sport, tournamentType, clubId } = req.query;
    const conditions = [];
    const params = [];

    if (status && ["upcoming", "registration", "in_progress", "completed"].includes(status)) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (matchType && ["singles", "doubles"].includes(matchType)) {
      params.push(matchType);
      conditions.push(`t.match_type = $${params.length}`);
    }
    if (sport && validateSport(sport)) {
      params.push(sport);
      conditions.push(`t.sport = $${params.length}`);
    }
    if (tournamentType && ["individual", "team"].includes(tournamentType)) {
      params.push(tournamentType);
      conditions.push(`t.tournament_type = $${params.length}`);
    }
    if (clubId) {
      params.push(clubId);
      conditions.push(`t.club_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT t.*,
         p.display_name AS created_by_name,
         c.name AS club_name,
         (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS player_count,
         (SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id) AS team_count
       FROM tournaments t
       JOIN players p ON p.id = t.created_by
       LEFT JOIN clubs c ON c.id = t.club_id
       ${whereClause}
       ORDER BY
         CASE t.status
           WHEN 'in_progress' THEN 0
           WHEN 'registration' THEN 1
           WHEN 'upcoming' THEN 2
           WHEN 'completed' THEN 3
         END,
         t.tournament_date DESC`,
      params
    );

    const tournaments = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      sport: row.sport,
      status: row.status,
      tournamentType: row.tournament_type || "individual",
      format: row.format || "knockout",
      tournamentDate: row.tournament_date,
      maxPlayers: row.max_players,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      clubId: row.club_id,
      clubName: row.club_name,
      playerCount: parseInt(row.player_count),
      teamCount: parseInt(row.team_count),
      createdAt: row.created_at,
    }));

    res.json({ tournaments });
  } catch (err) {
    console.error("List tournaments error:", err);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

// GET /api/tournaments/:id — tournament detail
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const tourneyResult = await db.query(
      `SELECT t.*, p.display_name AS created_by_name, c.name AS club_name
       FROM tournaments t
       JOIN players p ON p.id = t.created_by
       LEFT JOIN clubs c ON c.id = t.club_id
       WHERE t.id = $1`,
      [id]
    );
    if (tourneyResult.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    const row = tourneyResult.rows[0];
    const tourneySport = row.sport || "ping_pong";
    const isTeam = (row.tournament_type || "individual") === "team";

    // Registered players with tournament ratings
    const playersResult = await db.query(
      `SELECT p.id, p.username, p.display_name,
              COALESCE(pr.singles_elo, 1000) AS singles_elo,
              COALESCE(pr.doubles_elo, 1000) AS doubles_elo,
              tp.seed, tp.registered_at
       FROM tournament_players tp
       JOIN players p ON p.id = tp.player_id
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $2 AND pr.rating_type = 'tournament'
       WHERE tp.tournament_id = $1
       ORDER BY tp.seed NULLS LAST, tp.registered_at`,
      [id, tourneySport]
    );

    // Directors
    const directorsResult = await db.query(
      `SELECT p.id, p.username, p.display_name
       FROM tournament_directors td
       JOIN players p ON p.id = td.player_id
       WHERE td.tournament_id = $1`,
      [id]
    );

    // Teams (for team tournaments)
    let teams = [];
    if (isTeam) {
      const teamsResult = await db.query(
        `SELECT tt.id, tt.name, tt.seed
         FROM tournament_teams tt
         WHERE tt.tournament_id = $1
         ORDER BY tt.seed NULLS LAST, tt.id`,
        [id]
      );

      // Get team players
      for (const team of teamsResult.rows) {
        const teamPlayersResult = await db.query(
          `SELECT p.id, p.username, p.display_name
           FROM tournament_team_players ttp
           JOIN players p ON p.id = ttp.player_id
           WHERE ttp.team_id = $1
           ORDER BY p.display_name`,
          [team.id]
        );
        teams.push({
          id: team.id,
          name: team.name,
          seed: team.seed,
          players: teamPlayersResult.rows.map((p) => ({
            id: p.id,
            username: p.username,
            displayName: p.display_name,
          })),
        });
      }
    }

    // Bracket data — include team names
    const bracketResult = await db.query(
      `SELECT tb.*,
         p1.display_name AS player1_name,
         p2.display_name AS player2_name,
         pw.display_name AS winner_name,
         t1.name AS team1_name,
         t2.name AS team2_name,
         tw.name AS winner_team_name
       FROM tournament_brackets tb
       LEFT JOIN players p1 ON p1.id = tb.player1_id
       LEFT JOIN players p2 ON p2.id = tb.player2_id
       LEFT JOIN players pw ON pw.id = tb.winner_id
       LEFT JOIN tournament_teams t1 ON t1.id = tb.team1_id
       LEFT JOIN tournament_teams t2 ON t2.id = tb.team2_id
       LEFT JOIN tournament_teams tw ON tw.id = tb.winner_team_id
       WHERE tb.tournament_id = $1
       ORDER BY tb.round, tb.position`,
      [id]
    );

    // Round-robin standings
    let standings = [];
    if (isTeam && (row.format || "knockout") === "round_robin") {
      const standingsResult = await db.query(
        `SELECT rr.*, tt.name AS team_name
         FROM tournament_round_robin rr
         JOIN tournament_teams tt ON tt.id = rr.team_id
         WHERE rr.tournament_id = $1
         ORDER BY rr.points DESC, rr.won DESC, rr.played ASC`,
        [id]
      );
      standings = standingsResult.rows.map((s) => ({
        teamId: s.team_id,
        teamName: s.team_name,
        played: s.played,
        won: s.won,
        lost: s.lost,
        drawn: s.drawn,
        points: s.points,
      }));
    }

    const isRegistered = playersResult.rows.some((p) => p.id === req.player.id);
    const isDirector = await isTournamentDirector(id, req.player.id);
    const canManage = req.player.role === 'admin' || isDirector;

    const tournament = {
      id: row.id,
      name: row.name,
      description: row.description,
      matchType: row.match_type,
      sport: row.sport,
      status: row.status,
      tournamentType: row.tournament_type || "individual",
      format: row.format || "knockout",
      tournamentDate: row.tournament_date,
      maxPlayers: row.max_players,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      clubId: row.club_id,
      clubName: row.club_name,
      createdAt: row.created_at,
      isRegistered,
      isCreator: row.created_by === req.player.id,
      isDirector,
      canManage,
      players: playersResult.rows.map((p) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        singlesElo: p.singles_elo,
        doublesElo: p.doubles_elo,
        seed: p.seed,
        registeredAt: p.registered_at,
      })),
      directors: directorsResult.rows.map((d) => ({
        id: d.id,
        username: d.username,
        displayName: d.display_name,
      })),
      teams,
      standings,
      bracket: bracketResult.rows.map((b) => ({
        id: b.id,
        round: b.round,
        position: b.position,
        matchId: b.match_id,
        player1Id: b.player1_id,
        player1Name: b.player1_name,
        player2Id: b.player2_id,
        player2Name: b.player2_name,
        winnerId: b.winner_id,
        winnerName: b.winner_name,
        team1Id: b.team1_id,
        team1Name: b.team1_name,
        team2Id: b.team2_id,
        team2Name: b.team2_name,
        winnerTeamId: b.winner_team_id,
        winnerTeamName: b.winner_team_name,
      })),
    };

    res.json({ tournament });
  } catch (err) {
    console.error("Tournament detail error:", err);
    res.status(500).json({ error: "Failed to fetch tournament" });
  }
});

// POST /api/tournaments/:id/register — register individual player
router.post("/:id/register", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const tourney = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (tourney.rows[0].status !== "registration") {
      return res.status(400).json({ error: "Tournament is not open for registration" });
    }

    if (tourney.rows[0].max_players) {
      const count = await db.query(
        "SELECT COUNT(*) FROM tournament_players WHERE tournament_id = $1",
        [id]
      );
      if (parseInt(count.rows[0].count) >= tourney.rows[0].max_players) {
        return res.status(400).json({ error: "Tournament is full" });
      }
    }

    await db.query(
      `INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)
       ON CONFLICT (tournament_id, player_id) DO NOTHING`,
      [id, req.player.id]
    );

    res.json({ message: "Registered for tournament" });
  } catch (err) {
    console.error("Register tournament error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
});

// POST /api/tournaments/:id/unregister
router.post("/:id/unregister", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const tourney = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (tourney.rows[0].status !== "registration") {
      return res.status(400).json({ error: "Can only unregister during registration phase" });
    }

    await db.query(
      "DELETE FROM tournament_players WHERE tournament_id = $1 AND player_id = $2",
      [id, req.player.id]
    );

    res.json({ message: "Unregistered from tournament" });
  } catch (err) {
    console.error("Unregister tournament error:", err);
    res.status(500).json({ error: "Failed to unregister" });
  }
});

// POST /api/tournaments/:id/teams — create a team (director/admin)
router.post("/:id/teams", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { name, playerIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const tourney = await client.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if ((tourney.rows[0].tournament_type || "individual") !== "team") {
      return res.status(400).json({ error: "This is not a team tournament" });
    }
    if (!(await canManageTournament(id, req.player, client))) {
      return res.status(403).json({ error: "Only tournament directors or admins can create teams" });
    }

    await client.query("BEGIN");

    const teamResult = await client.query(
      `INSERT INTO tournament_teams (tournament_id, name) VALUES ($1, $2) RETURNING *`,
      [id, name]
    );
    const team = teamResult.rows[0];

    // Add players to team
    if (Array.isArray(playerIds) && playerIds.length > 0) {
      for (const playerId of playerIds) {
        await client.query(
          `INSERT INTO tournament_team_players (team_id, player_id) VALUES ($1, $2)
           ON CONFLICT (team_id, player_id) DO NOTHING`,
          [team.id, playerId]
        );
        // Also register them as tournament players
        await client.query(
          `INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)
           ON CONFLICT (tournament_id, player_id) DO NOTHING`,
          [id, playerId]
        );
      }
    }

    await client.query("COMMIT");

    res.status(201).json({ team });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create team error:", err);
    res.status(500).json({ error: err.message || "Failed to create team" });
  } finally {
    client.release();
  }
});

// PUT /api/tournaments/:id/teams/:teamId — update a team
router.put("/:id/teams/:teamId", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id, teamId } = req.params;
    const { name, playerIds } = req.body;

    if (!(await canManageTournament(id, req.player, client))) {
      return res.status(403).json({ error: "Only tournament directors or admins can update teams" });
    }

    await client.query("BEGIN");

    if (name) {
      await client.query("UPDATE tournament_teams SET name = $1 WHERE id = $2 AND tournament_id = $3", [name, teamId, id]);
    }

    if (Array.isArray(playerIds)) {
      await client.query("DELETE FROM tournament_team_players WHERE team_id = $1", [teamId]);
      for (const playerId of playerIds) {
        await client.query(
          `INSERT INTO tournament_team_players (team_id, player_id) VALUES ($1, $2)
           ON CONFLICT (team_id, player_id) DO NOTHING`,
          [teamId, playerId]
        );
        await client.query(
          `INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)
           ON CONFLICT (tournament_id, player_id) DO NOTHING`,
          [id, playerId]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Team updated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update team error:", err);
    res.status(500).json({ error: "Failed to update team" });
  } finally {
    client.release();
  }
});

// DELETE /api/tournaments/:id/teams/:teamId — delete a team
router.delete("/:id/teams/:teamId", requireAuth, async (req, res) => {
  try {
    const { id, teamId } = req.params;
    if (!(await canManageTournament(id, req.player))) {
      return res.status(403).json({ error: "Only tournament directors or admins can delete teams" });
    }
    await db.query("DELETE FROM tournament_teams WHERE id = $1 AND tournament_id = $2", [teamId, id]);
    res.json({ message: "Team deleted" });
  } catch (err) {
    console.error("Delete team error:", err);
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// POST /api/tournaments/:id/generate-bracket — director or admin
router.post("/:id/generate-bracket", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;

    const tourney = await client.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (!(await canManageTournament(id, req.player, client))) {
      return res.status(403).json({ error: "Only tournament directors or admins can generate the bracket" });
    }
    if (tourney.rows[0].status !== "registration") {
      return res.status(400).json({ error: "Bracket can only be generated during registration phase" });
    }

    const isTeam = (tourney.rows[0].tournament_type || "individual") === "team";
    const format = tourney.rows[0].format || "knockout";

    await client.query("BEGIN");

    if (isTeam) {
      if (format === "round_robin") {
        await generateTeamRoundRobin(client, parseInt(id));
      } else {
        await generateTeamBracket(client, parseInt(id));
      }
    } else {
      await generateBracket(client, parseInt(id));
    }

    await client.query("COMMIT");

    res.json({ message: "Bracket generated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Generate bracket error:", err);
    res.status(500).json({ error: err.message || "Failed to generate bracket" });
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/record-match — record a bracket match result
router.post("/:id/record-match", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { round, position, winnerId, winnerTeamId, score } = req.body;

    if (!round || position === undefined || position === null) {
      return res.status(400).json({ error: "round and position are required" });
    }

    const tourney = await client.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (tourney.rows[0].status !== "in_progress") {
      return res.status(400).json({ error: "Tournament is not in progress" });
    }
    if (!(await canManageTournament(id, req.player, client))) {
      return res.status(403).json({ error: "Only tournament directors or admins can record matches" });
    }

    const matchType = tourney.rows[0].match_type;
    const tourneySport = tourney.rows[0].sport || "ping_pong";
    const isTeam = (tourney.rows[0].tournament_type || "individual") === "team";
    const format = tourney.rows[0].format || "knockout";

    // Fetch the bracket slot
    const slotResult = await client.query(
      `SELECT * FROM tournament_brackets
       WHERE tournament_id = $1 AND round = $2 AND position = $3`,
      [id, round, position]
    );
    if (slotResult.rows.length === 0) {
      return res.status(404).json({ error: "Bracket slot not found" });
    }
    const slot = slotResult.rows[0];

    if (isTeam) {
      // Team match recording
      if (!winnerTeamId) {
        return res.status(400).json({ error: "winnerTeamId is required for team tournaments" });
      }
      if (slot.winner_team_id) {
        return res.status(400).json({ error: "This match has already been decided" });
      }
      if (!slot.team1_id || !slot.team2_id) {
        return res.status(400).json({ error: "Both teams must be assigned to this slot" });
      }
      if (winnerTeamId !== slot.team1_id && winnerTeamId !== slot.team2_id) {
        return res.status(400).json({ error: "Winner must be one of the teams in this matchup" });
      }

      const loserTeamId = winnerTeamId === slot.team1_id ? slot.team2_id : slot.team1_id;

      await client.query("BEGIN");

      // Create match record
      const matchResult = await client.query(
        `INSERT INTO matches (match_type, score, recorded_by, tournament_id, sport, team1_id, team2_id, winner_team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [matchType, score || null, req.player.id, id, tourneySport, slot.team1_id, slot.team2_id, winnerTeamId]
      );
      const match = matchResult.rows[0];

      // Update bracket slot
      await client.query(
        `UPDATE tournament_brackets SET winner_team_id = $1, match_id = $2
         WHERE tournament_id = $3 AND round = $4 AND position = $5`,
        [winnerTeamId, match.id, id, round, position]
      );

      // Update round-robin standings if applicable
      if (format === "round_robin") {
        // Update winner
        await client.query(
          `UPDATE tournament_round_robin
           SET played = played + 1, won = won + 1, points = points + 3
           WHERE tournament_id = $1 AND team_id = $2`,
          [id, winnerTeamId]
        );
        // Update loser
        await client.query(
          `UPDATE tournament_round_robin
           SET played = played + 1, lost = lost + 1
           WHERE tournament_id = $1 AND team_id = $2`,
          [id, loserTeamId]
        );

        // Check if all round-robin matches are done
        const pendingCount = await client.query(
          `SELECT COUNT(*) FROM tournament_brackets
           WHERE tournament_id = $1 AND winner_team_id IS NULL`,
          [id]
        );
        if (parseInt(pendingCount.rows[0].count) === 0) {
          await client.query(
            "UPDATE tournaments SET status = 'completed' WHERE id = $1",
            [id]
          );
        }
      } else {
        // Knockout: advance winner
        const teamCount = await client.query(
          "SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1",
          [id]
        );
        const bracketSize = nextPowerOf2(parseInt(teamCount.rows[0].count));
        const totalRounds = Math.log2(bracketSize);

        await advanceTeamWinner(client, parseInt(id), round, position, winnerTeamId, totalRounds);
      }

      await client.query("COMMIT");
      res.json({ message: "Match recorded", matchId: match.id });

    } else {
      // Individual match recording (original logic)
      if (!winnerId) {
        return res.status(400).json({ error: "winnerId is required" });
      }
      if (slot.winner_id) {
        return res.status(400).json({ error: "This match has already been decided" });
      }
      if (!slot.player1_id || !slot.player2_id) {
        return res.status(400).json({ error: "Both players must be assigned to this slot" });
      }
      if (winnerId !== slot.player1_id && winnerId !== slot.player2_id) {
        return res.status(400).json({ error: "Winner must be one of the players in this matchup" });
      }

      const loserId = winnerId === slot.player1_id ? slot.player2_id : slot.player1_id;

      await client.query("BEGIN");

      const winners = [winnerId];
      const losers = [loserId];

      const matchResult = await client.query(
        `INSERT INTO matches (match_type, score, recorded_by, tournament_id, sport)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [matchType, score || null, req.player.id, id, tourneySport]
      );
      const match = matchResult.rows[0];

      await client.query(
        `INSERT INTO match_players (match_id, player_id, team) VALUES ($1, $2, 'winner')`,
        [match.id, winnerId]
      );
      await client.query(
        `INSERT INTO match_players (match_id, player_id, team) VALUES ($1, $2, 'loser')`,
        [match.id, loserId]
      );

      await processMatchElo(client, match.id, matchType, winners, losers, tourneySport, "tournament");

      await client.query(
        `UPDATE tournament_brackets SET winner_id = $1, match_id = $2
         WHERE tournament_id = $3 AND round = $4 AND position = $5`,
        [winnerId, match.id, id, round, position]
      );

      const playerCount = await client.query(
        "SELECT COUNT(*) FROM tournament_players WHERE tournament_id = $1",
        [id]
      );
      const bracketSize = nextPowerOf2(parseInt(playerCount.rows[0].count));
      const totalRounds = Math.log2(bracketSize);

      await advanceWinner(client, parseInt(id), round, position, winnerId, totalRounds);

      await client.query("COMMIT");
      res.json({ message: "Match recorded", matchId: match.id });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Record tournament match error:", err);
    res.status(500).json({ error: "Failed to record match" });
  } finally {
    client.release();
  }
});

// PATCH /api/tournaments/:id — update tournament settings (date, etc.) — admin only
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tournamentDate } = req.body;

    const tourney = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (!(await canManageTournament(id, req.player))) {
      return res.status(403).json({ error: "Only admins or tournament directors can update tournament settings" });
    }

    if (tournamentDate) {
      await db.query("UPDATE tournaments SET tournament_date = $1 WHERE id = $2", [tournamentDate, id]);
    }

    res.json({ message: "Tournament updated" });
  } catch (err) {
    console.error("Update tournament error:", err);
    res.status(500).json({ error: "Failed to update tournament" });
  }
});

// PATCH /api/tournaments/:id/status — update status (director or admin)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const tourney = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (!(await canManageTournament(id, req.player))) {
      return res.status(403).json({ error: "Only tournament directors or admins can update status" });
    }

    const validTransitions = {
      upcoming: ["registration"],
      registration: ["in_progress"],
      in_progress: ["completed"],
    };
    const allowed = validTransitions[tourney.rows[0].status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from '${tourney.rows[0].status}' to '${status}'`,
      });
    }

    await db.query("UPDATE tournaments SET status = $1 WHERE id = $2", [status, id]);

    res.json({ message: `Tournament status updated to '${status}'` });
  } catch (err) {
    console.error("Update tournament status error:", err);
    res.status(500).json({ error: "Failed to update tournament status" });
  }
});

// POST /api/tournaments/:id/directors — add a director
router.post("/:id/directors", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }

    const tourney = await db.query("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (tourney.rows.length === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    if (!(await canManageTournament(id, req.player))) {
      return res.status(403).json({ error: "Only tournament directors or admins can add directors" });
    }

    const target = await db.query("SELECT role FROM players WHERE id = $1", [playerId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }
    if (!['admin', 'director'].includes(target.rows[0].role)) {
      return res.status(400).json({ error: "Player must have director or admin role" });
    }

    await db.query(
      `INSERT INTO tournament_directors (tournament_id, player_id) VALUES ($1, $2)
       ON CONFLICT (tournament_id, player_id) DO NOTHING`,
      [id, playerId]
    );

    res.json({ message: "Director added" });
  } catch (err) {
    console.error("Add tournament director error:", err);
    res.status(500).json({ error: "Failed to add director" });
  }
});

module.exports = router;
