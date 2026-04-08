const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { validateSport, getRatingSystem } = require("../constants");

const router = express.Router();

// GET /api/analytics/movers — "Who is improving fastest?"
router.get("/movers", requireAuth, async (req, res) => {
  try {
    const { sport, matchType = "singles", days = 30 } = req.query;
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "Valid sport required" });
    }
    if (!["singles", "doubles"].includes(matchType)) {
      return res.status(400).json({ error: "matchType must be singles or doubles" });
    }

    const daysInt = parseInt(days);
    const cutoff = daysInt > 9000
      ? new Date("2000-01-01")
      : new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

    const result = await db.query(
      `WITH period_matches AS (
        SELECT
          mp.player_id,
          mp.elo_before,
          mp.elo_after,
          m.played_at,
          ROW_NUMBER() OVER (PARTITION BY mp.player_id ORDER BY m.played_at ASC, m.id ASC) AS rn_first,
          ROW_NUMBER() OVER (PARTITION BY mp.player_id ORDER BY m.played_at DESC, m.id DESC) AS rn_last
        FROM match_players mp
        JOIN matches m ON m.id = mp.match_id
        WHERE m.sport = $1
          AND m.match_type = $2
          AND m.played_at >= $3
      ),
      first_match AS (
        SELECT player_id, elo_before FROM period_matches WHERE rn_first = 1
      ),
      last_match AS (
        SELECT player_id, elo_after FROM period_matches WHERE rn_last = 1
      ),
      match_counts AS (
        SELECT player_id, COUNT(*) AS matches_played
        FROM period_matches
        GROUP BY player_id
      )
      SELECT
        p.id,
        p.display_name,
        f.elo_before AS start_rating,
        l.elo_after AS end_rating,
        (l.elo_after - f.elo_before) AS delta,
        mc.matches_played
      FROM first_match f
      JOIN last_match l ON f.player_id = l.player_id
      JOIN match_counts mc ON mc.player_id = f.player_id
      JOIN players p ON p.id = f.player_id
      ORDER BY delta DESC
      LIMIT 50`,
      [sport, matchType, cutoff]
    );

    res.json({
      movers: result.rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        startRating: parseInt(r.start_rating),
        endRating: parseInt(r.end_rating),
        delta: parseInt(r.delta),
        matchesPlayed: parseInt(r.matches_played),
      })),
      ratingSystem: getRatingSystem(sport),
    });
  } catch (err) {
    console.error("Movers error:", err);
    res.status(500).json({ error: "Failed to fetch movers" });
  }
});

// GET /api/analytics/suggestions — "Suggest matches"
router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    const { sport, matchType = "singles" } = req.query;
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "Valid sport required" });
    }

    const playerId = req.player.id;
    const isUtr = getRatingSystem(sport) === "utr";
    const ratingCol = matchType === "singles"
      ? (isUtr ? "singles_utr" : "singles_elo")
      : (isUtr ? "doubles_utr" : "doubles_elo");
    const defaultRating = isUtr ? 1.0 : 1000;
    const divisor = isUtr ? 4 : 400;
    const threshold = isUtr ? 3.0 : 300;

    // Get my rating
    const myRatingResult = await db.query(
      `SELECT COALESCE(${ratingCol}, ${defaultRating}) AS rating
       FROM player_ratings
       WHERE player_id = $1 AND sport = $2 AND rating_type = 'skill'`,
      [playerId, sport]
    );
    const myRating = myRatingResult.rows.length > 0
      ? parseFloat(myRatingResult.rows[0].rating)
      : defaultRating;

    // Find candidates with rating proximity and recency
    const candidates = await db.query(
      `WITH last_played AS (
        SELECT
          CASE WHEN mp1.player_id = $1 THEN mp2.player_id ELSE mp1.player_id END AS opponent_id,
          MAX(m.played_at) AS last_match_at
        FROM match_players mp1
        JOIN match_players mp2 ON mp1.match_id = mp2.match_id AND mp1.player_id != mp2.player_id
        JOIN matches m ON m.id = mp1.match_id
        WHERE (mp1.player_id = $1 OR mp2.player_id = $1)
          AND m.sport = $2
        GROUP BY opponent_id
      )
      SELECT
        p.id,
        p.display_name,
        COALESCE(pr.${ratingCol}, ${defaultRating}) AS rating,
        ABS(COALESCE(pr.${ratingCol}, ${defaultRating}) - ${myRating}) AS gap,
        lp.last_match_at,
        EXTRACT(DAY FROM NOW() - COALESCE(lp.last_match_at, '2000-01-01'::timestamptz)) AS days_since
      FROM players p
      JOIN player_sports ps ON ps.player_id = p.id AND ps.sport = $2
      LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.sport = $2 AND pr.rating_type = 'skill'
      LEFT JOIN last_played lp ON lp.opponent_id = p.id
      WHERE p.id != $1
        AND ABS(COALESCE(pr.${ratingCol}, ${defaultRating}) - ${myRating}) <= ${threshold}
      ORDER BY
        COALESCE(lp.last_match_at, '2000-01-01'::timestamptz) ASC,
        ABS(COALESCE(pr.${ratingCol}, ${defaultRating}) - ${myRating}) ASC
      LIMIT 10`,
      [playerId, sport]
    );

    const suggestions = candidates.rows.map((r) => {
      const oppRating = parseFloat(r.rating);
      const winProb = 1.0 / (1.0 + Math.pow(10, (oppRating - myRating) / divisor));
      return {
        opponent: { id: r.id, displayName: r.display_name, rating: oppRating },
        winProbability: Math.round(winProb * 100) / 100,
        lastPlayedAt: r.last_match_at,
        daysSinceLastMatch: r.last_match_at ? parseInt(r.days_since) : null,
      };
    });

    // Doubles suggestions: find 3 closest players and suggest balanced pairings
    let doublesSuggestions = [];
    if (matchType === "doubles" && candidates.rows.length >= 3) {
      const top3 = candidates.rows.slice(0, 3).map((r) => ({
        id: r.id,
        displayName: r.display_name,
        rating: parseFloat(r.rating),
      }));

      // 3 possible pairings: me+0 vs 1+2, me+1 vs 0+2, me+2 vs 0+1
      const pairings = [
        { team1: [{ id: playerId, displayName: req.player.display_name, rating: myRating }, top3[0]], team2: [top3[1], top3[2]] },
        { team1: [{ id: playerId, displayName: req.player.display_name, rating: myRating }, top3[1]], team2: [top3[0], top3[2]] },
        { team1: [{ id: playerId, displayName: req.player.display_name, rating: myRating }, top3[2]], team2: [top3[0], top3[1]] },
      ];

      doublesSuggestions = pairings
        .map((p) => ({
          ...p,
          team1Total: p.team1.reduce((s, pl) => s + pl.rating, 0),
          team2Total: p.team2.reduce((s, pl) => s + pl.rating, 0),
          ratingGap: Math.abs(
            p.team1.reduce((s, pl) => s + pl.rating, 0) - p.team2.reduce((s, pl) => s + pl.rating, 0)
          ),
        }))
        .sort((a, b) => a.ratingGap - b.ratingGap);
    }

    // Convert myRating for UTR stored display
    const myRatingStored = isUtr ? myRating : Math.round(myRating);

    res.json({
      myRating: myRatingStored,
      suggestions,
      doublesSuggestions,
      ratingSystem: getRatingSystem(sport),
    });
  } catch (err) {
    console.error("Suggestions error:", err);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// GET /api/analytics/trends — "Analyze playing trends"
router.get("/trends", requireAuth, async (req, res) => {
  try {
    const { sport, matchType = "singles" } = req.query;
    if (!sport || !validateSport(sport)) {
      return res.status(400).json({ error: "Valid sport required" });
    }

    const playerId = req.player.id;

    // Rating progression: all matches chronologically
    const progressionResult = await db.query(
      `SELECT m.id AS match_id, m.played_at, mp.team, mp.elo_before, mp.elo_after
       FROM match_players mp
       JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = $1 AND m.sport = $2 AND m.match_type = $3
       ORDER BY m.played_at ASC, m.id ASC`,
      [playerId, sport, matchType]
    );

    const ratingProgression = progressionResult.rows.map((r) => ({
      matchId: r.match_id,
      playedAt: r.played_at,
      eloBefore: parseInt(r.elo_before),
      eloAfter: parseInt(r.elo_after),
      result: r.team === "winner" ? "win" : "loss",
    }));

    // Head-to-head
    const h2hResult = await db.query(
      `SELECT
        opp.player_id AS opponent_id,
        p.display_name AS opponent_name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE me.team = 'winner') AS wins,
        COUNT(*) FILTER (WHERE me.team = 'loser') AS losses
      FROM match_players me
      JOIN match_players opp ON opp.match_id = me.match_id AND opp.player_id != me.player_id
        AND opp.team != me.team
      JOIN matches m ON m.id = me.match_id
      JOIN players p ON p.id = opp.player_id
      WHERE me.player_id = $1 AND m.sport = $2 AND m.match_type = $3
      GROUP BY opp.player_id, p.display_name
      ORDER BY total DESC`,
      [playerId, sport, matchType]
    );

    const headToHead = h2hResult.rows.map((r) => ({
      opponentId: parseInt(r.opponent_id),
      opponentName: r.opponent_name,
      total: parseInt(r.total),
      wins: parseInt(r.wins),
      losses: parseInt(r.losses),
      winRate: parseInt(r.total) > 0 ? Math.round((parseInt(r.wins) / parseInt(r.total)) * 100) : 0,
    }));

    // Compute streaks from progression
    let currentType = null;
    let currentLength = 0;
    let bestWin = 0;
    let worstLoss = 0;
    let tempStreak = 0;
    let tempType = null;

    for (const match of ratingProgression) {
      if (match.result === tempType) {
        tempStreak++;
      } else {
        // Save previous streak
        if (tempType === "win" && tempStreak > bestWin) bestWin = tempStreak;
        if (tempType === "loss" && tempStreak > worstLoss) worstLoss = tempStreak;
        tempType = match.result;
        tempStreak = 1;
      }
    }
    // Final streak
    if (tempType === "win" && tempStreak > bestWin) bestWin = tempStreak;
    if (tempType === "loss" && tempStreak > worstLoss) worstLoss = tempStreak;
    currentType = tempType;
    currentLength = tempStreak;

    // Rolling win rate (window of 10)
    const windowSize = 10;
    const rollingWinRate = [];
    for (let i = windowSize - 1; i < ratingProgression.length; i++) {
      const window = ratingProgression.slice(i - windowSize + 1, i + 1);
      const wins = window.filter((m) => m.result === "win").length;
      rollingWinRate.push({
        matchIndex: i + 1,
        playedAt: ratingProgression[i].playedAt,
        winRate: Math.round((wins / windowSize) * 100),
      });
    }

    res.json({
      ratingProgression,
      headToHead,
      streaks: {
        currentType: currentType || "none",
        currentLength: currentLength || 0,
        bestWin,
        worstLoss,
      },
      rollingWinRate,
      ratingSystem: getRatingSystem(sport),
    });
  } catch (err) {
    console.error("Trends error:", err);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

module.exports = router;
