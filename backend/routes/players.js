const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validateSport, getRatingSystem } = require("../constants");
const { getDefaultElo, getDefaultUtr } = require("../services/ratingDefaults");
const { ensurePlayerRatings } = require("../services/elo");

const router = express.Router();

// GET /api/players — list all players (authenticated)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { sport } = req.query;
    const sportVal = sport && validateSport(sport) ? sport : "ping_pong";

    const defaultElo = await getDefaultElo();
    const defaultUtr = await getDefaultUtr();

    const result = await db.query(
      `SELECT p.id, p.username, p.display_name, p.role, p.default_sport, p.created_at,
              COALESCE(pr.singles_elo, ${defaultElo}) AS singles_elo,
              COALESCE(pr.doubles_elo, ${defaultElo}) AS doubles_elo,
              COALESCE(pr.singles_utr, ${defaultUtr}) AS singles_utr,
              COALESCE(pr.doubles_utr, ${defaultUtr}) AS doubles_utr
       FROM players p
       JOIN player_sports ps ON ps.player_id = p.id AND ps.sport = $1
       LEFT JOIN player_ratings pr ON pr.player_id = p.id
         AND pr.sport = $1 AND pr.rating_type = 'skill'
       ORDER BY p.display_name ASC`,
      [sportVal]
    );
    res.json({ players: result.rows, ratingSystem: getRatingSystem(sportVal) });
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

    // Get all ratings for this player (include UTR columns)
    const ratingsResult = await db.query(
      `SELECT sport, rating_type, singles_elo, doubles_elo, singles_utr, doubles_utr
       FROM player_ratings WHERE player_id = $1
       ORDER BY sport, rating_type`,
      [id]
    );

    // Get player's selected sports
    const sportsResult = await db.query(
      "SELECT sport FROM player_sports WHERE player_id = $1 ORDER BY sport",
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
      sports: sportsResult.rows.map(r => r.sport),
      stats: statsResult.rows[0],
    });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ error: "Failed to fetch player" });
  }
});

// POST /api/players/quick-add — any authenticated user can add a new player
router.post("/quick-add", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { displayName, username: providedUsername, sports, initialRatings } = req.body;
    // initialRatings: { ping_pong: 1200, tennis: 3.5, pickleball: 2.0 }

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({ error: "Display name is required" });
    }

    // Validate sports
    const selectedSports = (Array.isArray(sports) ? sports : []).filter(s => validateSport(s));
    if (selectedSports.length === 0) {
      return res.status(400).json({ error: "Select at least one sport" });
    }

    // Use provided username or auto-generate from display name
    let username;
    if (providedUsername && providedUsername.trim().length >= 3) {
      username = providedUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      // Check if username already taken
      const exists = await client.query("SELECT id FROM players WHERE username = $1", [username]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: `Username "${username}" is already taken` });
      }
    } else if (providedUsername && providedUsername.trim().length > 0 && providedUsername.trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    } else {
      // Auto-generate from display name
      const baseName = displayName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      username = baseName || "player";
      let suffix = 0;
      while (true) {
        const candidate = suffix === 0 ? username : `${username}${suffix}`;
        const exists = await client.query("SELECT id FROM players WHERE username = $1", [candidate]);
        if (exists.rows.length === 0) {
          username = candidate;
          break;
        }
        suffix++;
      }
    }

    // Default password: Welcome1 (player should change on first login)
    const passwordHash = await bcrypt.hash("Welcome1", 12);

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO players (username, display_name, password_hash, default_sport, last_login)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, username, display_name, default_sport, created_at`,
      [username, displayName.trim(), passwordHash, selectedSports[0]]
    );

    const player = result.rows[0];

    // Record selected sports and seed ratings
    for (const s of selectedSports) {
      await client.query(
        "INSERT INTO player_sports (player_id, sport) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [player.id, s]
      );
      await ensurePlayerRatings(client, [player.id], s);

      // Apply initial rating if provided
      const rating = initialRatings && initialRatings[s];
      if (rating !== undefined && rating !== null && rating !== "") {
        const ratingVal = parseFloat(rating);
        if (!isNaN(ratingVal)) {
          const isUtr = getRatingSystem(s) === "utr";
          if (isUtr) {
            // Set UTR for all rating types
            for (const rt of ['skill', 'league', 'tournament']) {
              await client.query(
                `UPDATE player_ratings SET singles_utr = $1, doubles_utr = $1
                 WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
                [ratingVal, player.id, s, rt]
              );
            }
          } else {
            // Set Elo for all rating types
            const eloVal = Math.round(ratingVal);
            for (const rt of ['skill', 'league', 'tournament']) {
              await client.query(
                `UPDATE player_ratings SET singles_elo = $1, doubles_elo = $1
                 WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
                [eloVal, player.id, s, rt]
              );
            }
          }
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      player,
      message: `Player added! Username: ${username}, Default password: Welcome1`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Quick-add player error:", err);
    res.status(500).json({ error: "Failed to add player" });
  } finally {
    client.release();
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
