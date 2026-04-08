/**
 * Seed script: creates missing players, teams, and a past team tournament with results.
 *
 * Teams:
 *   Team A: Sharath, Bhavnam, Venky, Pavitra (alt: Nirmala)
 *   Team B: Ramakrishna, Prasad, Lakshma, Vinod
 *   Team C: Teja, Ramesh, Suresh, Shiva
 *   Team D: Kiran, Boobalan, Chandra, Srini
 *   Team E: Madhu, Shyam, Namratha, Upendra
 *   Team F: Preethi, Sashank, Arvind, Pavan
 */
const db = require("./db");
const bcrypt = require("bcrypt");
const { ensurePlayerRatings } = require("./services/elo");

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = "password123";

// Players that need to be created (username, display_name)
const NEW_PLAYERS = [
  ["venky", "Venky Peddireddy"],
  ["pavitra", "Pavitra Maddula"],
  ["nirmala", "Nirmala Guntuku"],
  ["prasad", "Prasad Bollam"],
  ["vinod", "Vinod Kumar"],
  ["teja", "Teja Reddy"],
  ["ramesh", "Ramesh Babu"],
  ["suresh", "Suresh Kumar"],
  ["shiva", "Shiva Shankar"],
  ["kiran", "Kiran Meda"],
  ["boobalan", "Boobalan Murugan"],
  ["chandra", "Chandra Mouli"],
  ["srini", "Srini Rajan"],
  ["shyam", "Shyam Sundar"],
  ["namratha", "Namratha Rao"],
  ["upendra", "Upendra Varma"],
  ["sashank", "Sashank Pinninti"],
  ["arvind", "Arvind Kumar"],
  ["pavan", "Pavan Reddy"],
];

// Team definitions: [team_name, [usernames]]
const TEAMS = [
  ["Team A", ["sharath", "bhavnam", "venky", "pavitra"]],
  ["Team B", ["ramakrishna", "prasad", "lakshma", "vinod"]],
  ["Team C", ["teja", "ramesh", "suresh", "shiva"]],
  ["Team D", ["kiran", "boobalan", "chandra", "srini"]],
  ["Team E", ["madhu", "shyam", "namratha", "upendra"]],
  ["Team F", ["preethi", "sashank", "arvind", "pavan"]],
];

async function seed() {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    console.log("1. Creating missing players...");
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    for (const [username, displayName] of NEW_PLAYERS) {
      const existing = await client.query(
        "SELECT id FROM players WHERE username = $1",
        [username]
      );
      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO players (username, display_name, password_hash, default_sport)
           VALUES ($1, $2, $3, 'ping_pong')
           RETURNING id`,
          [username, displayName, passwordHash]
        );
        const playerId = result.rows[0].id;

        // Add sport and ensure ratings
        await client.query(
          `INSERT INTO player_sports (player_id, sport) VALUES ($1, 'ping_pong')
           ON CONFLICT DO NOTHING`,
          [playerId]
        );
        await ensurePlayerRatings(client, [playerId], "ping_pong");
        console.log(`   Created: ${displayName} (@${username}) -> id ${playerId}`);
      } else {
        console.log(`   Exists:  ${displayName} (@${username}) -> id ${existing.rows[0].id}`);
      }
    }

    // Build username -> id map
    const allPlayersResult = await client.query(
      "SELECT id, username FROM players"
    );
    const playerMap = {};
    for (const p of allPlayersResult.rows) {
      playerMap[p.username] = p.id;
    }

    // Get Ramakrishna's ID for created_by
    const creatorId = playerMap["ramakrishna"];

    console.log("\n2. Creating team tournament...");

    // Check if tournament already exists
    const existingTourney = await client.query(
      "SELECT id FROM tournaments WHERE name = 'Spring 2026 Team Championship'"
    );

    let tournamentId;
    if (existingTourney.rows.length > 0) {
      tournamentId = existingTourney.rows[0].id;
      console.log(`   Tournament already exists with id ${tournamentId}, cleaning up...`);
      await client.query("DELETE FROM tournament_round_robin WHERE tournament_id = $1", [tournamentId]);
      await client.query("DELETE FROM tournament_brackets WHERE tournament_id = $1", [tournamentId]);
      await client.query("DELETE FROM matches WHERE tournament_id = $1", [tournamentId]);
      // Delete team players before teams
      const existingTeams = await client.query(
        "SELECT id FROM tournament_teams WHERE tournament_id = $1", [tournamentId]
      );
      for (const t of existingTeams.rows) {
        await client.query("DELETE FROM tournament_team_players WHERE team_id = $1", [t.id]);
      }
      await client.query("DELETE FROM tournament_teams WHERE tournament_id = $1", [tournamentId]);
      await client.query("DELETE FROM tournament_players WHERE tournament_id = $1", [tournamentId]);
    } else {
      const tourneyResult = await client.query(
        `INSERT INTO tournaments (name, description, match_type, tournament_date, created_by, sport, tournament_type, format, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          "Spring 2026 Team Championship",
          "First team-based round-robin tournament of the year. 6 teams compete in a full round-robin format.",
          "singles",
          "2026-03-15",
          creatorId,
          "ping_pong",
          "team",
          "round_robin",
          "completed",
        ]
      );
      tournamentId = tourneyResult.rows[0].id;
      console.log(`   Created tournament id ${tournamentId}`);
    }

    // Make creator a director
    await client.query(
      `INSERT INTO tournament_directors (tournament_id, player_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [tournamentId, creatorId]
    );

    console.log("\n3. Creating teams...");
    const teamIds = {};
    for (const [teamName, usernames] of TEAMS) {
      const teamResult = await client.query(
        `INSERT INTO tournament_teams (tournament_id, name) VALUES ($1, $2)
         ON CONFLICT (tournament_id, name) DO UPDATE SET name = $2
         RETURNING id`,
        [tournamentId, teamName]
      );
      const teamId = teamResult.rows[0].id;
      teamIds[teamName] = teamId;

      for (const username of usernames) {
        const playerId = playerMap[username];
        if (!playerId) {
          console.error(`   WARNING: Player '${username}' not found!`);
          continue;
        }
        await client.query(
          `INSERT INTO tournament_team_players (team_id, player_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [teamId, playerId]
        );
        await client.query(
          `INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [tournamentId, playerId]
        );
      }
      console.log(`   ${teamName} (id ${teamId}): ${usernames.join(", ")}`);
    }

    console.log("\n4. Generating round-robin fixtures and results...");

    // Initialize standings
    const teamNames = Object.keys(teamIds);
    for (const tn of teamNames) {
      await client.query(
        `INSERT INTO tournament_round_robin (tournament_id, team_id) VALUES ($1, $2)
         ON CONFLICT (tournament_id, team_id) DO UPDATE SET played = 0, won = 0, lost = 0, drawn = 0, points = 0`,
        [tournamentId, teamIds[tn]]
      );
    }

    // Define match results: [team1Name, team2Name, winnerTeamName, score]
    // Round-robin: 6 teams = 15 matches total
    const matchResults = [
      // Round 1
      ["Team A", "Team B", "Team A", "3-2"],
      ["Team C", "Team D", "Team D", "1-3"],
      ["Team E", "Team F", "Team E", "3-1"],
      // Round 2
      ["Team A", "Team C", "Team A", "3-0"],
      ["Team B", "Team D", "Team B", "3-2"],
      ["Team E", "Team F", "Team F", "2-3"], // F wins
      // Round 3
      ["Team A", "Team D", "Team D", "2-3"],
      ["Team B", "Team C", "Team B", "3-1"],
      ["Team E", "Team F", "Team E", "3-2"], // E wins — wait, E and F already played twice. Let me fix.
    ];

    // Actually let's do this properly: each pair plays exactly once
    // Pairs: AB, AC, AD, AE, AF, BC, BD, BE, BF, CD, CE, CF, DE, DF, EF = 15 matches
    const allMatchResults = [
      ["Team A", "Team B", "Team A", "3-2"],
      ["Team A", "Team C", "Team A", "3-0"],
      ["Team A", "Team D", "Team D", "2-3"],
      ["Team A", "Team E", "Team A", "3-1"],
      ["Team A", "Team F", "Team A", "3-2"],
      ["Team B", "Team C", "Team B", "3-1"],
      ["Team B", "Team D", "Team B", "3-2"],
      ["Team B", "Team E", "Team E", "1-3"],
      ["Team B", "Team F", "Team B", "3-0"],
      ["Team C", "Team D", "Team D", "1-3"],
      ["Team C", "Team E", "Team E", "2-3"],
      ["Team C", "Team F", "Team C", "3-2"],
      ["Team D", "Team E", "Team D", "3-1"],
      ["Team D", "Team F", "Team D", "3-2"],
      ["Team E", "Team F", "Team E", "3-1"],
    ];

    let position = 1;
    for (const [t1Name, t2Name, winnerName, score] of allMatchResults) {
      const t1Id = teamIds[t1Name];
      const t2Id = teamIds[t2Name];
      const winnerId = teamIds[winnerName];
      const loserId = winnerId === t1Id ? t2Id : t1Id;

      // Create bracket/fixture entry
      await client.query(
        `INSERT INTO tournament_brackets (tournament_id, round, position, team1_id, team2_id, winner_team_id)
         VALUES ($1, 1, $2, $3, $4, $5)`,
        [tournamentId, position, t1Id, t2Id, winnerId]
      );

      // Create match record
      const matchResult = await client.query(
        `INSERT INTO matches (match_type, score, recorded_by, tournament_id, sport, team1_id, team2_id, winner_team_id, played_at)
         VALUES ('singles', $1, $2, $3, 'ping_pong', $4, $5, $6, $7)
         RETURNING id`,
        [score, creatorId, tournamentId, t1Id, t2Id, winnerId,
         `2026-03-15 ${String(9 + Math.floor(position / 4)).padStart(2, "0")}:${String((position % 4) * 15).padStart(2, "0")}:00`]
      );

      // Update bracket with match_id
      await client.query(
        `UPDATE tournament_brackets SET match_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [matchResult.rows[0].id, tournamentId, position]
      );

      // Update standings
      await client.query(
        `UPDATE tournament_round_robin
         SET played = played + 1, won = won + 1, points = points + 3
         WHERE tournament_id = $1 AND team_id = $2`,
        [tournamentId, winnerId]
      );
      await client.query(
        `UPDATE tournament_round_robin
         SET played = played + 1, lost = lost + 1
         WHERE tournament_id = $1 AND team_id = $2`,
        [tournamentId, loserId]
      );

      console.log(`   M${position}: ${t1Name} vs ${t2Name} -> ${winnerName} (${score})`);
      position++;
    }

    // Print final standings
    const finalStandings = await client.query(
      `SELECT tt.name, rr.played, rr.won, rr.lost, rr.points
       FROM tournament_round_robin rr
       JOIN tournament_teams tt ON tt.id = rr.team_id
       WHERE rr.tournament_id = $1
       ORDER BY rr.points DESC, rr.won DESC`,
      [tournamentId]
    );
    console.log("\n5. Final Standings:");
    console.log("   " + "Team".padEnd(10) + "P".padStart(4) + "W".padStart(4) + "L".padStart(4) + "Pts".padStart(5));
    console.log("   " + "-".repeat(27));
    for (const s of finalStandings.rows) {
      console.log(
        `   ${s.name.padEnd(10)}${String(s.played).padStart(4)}${String(s.won).padStart(4)}${String(s.lost).padStart(4)}${String(s.points).padStart(5)}`
      );
    }

    await client.query("COMMIT");
    console.log("\n✅ Seed complete!");
    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
