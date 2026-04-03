const { VALID_RATING_TYPES } = require("../constants");

// UTR (Universal Tennis Rating) — simplified for club use
// Scale: 1.00 – 16.50
// 1-3: Beginner, 4-6: Intermediate, 7-9: Advanced, 10-12: Competitive, 13-16.5: Elite/Pro
const DEFAULT_UTR = 5.0;
const MIN_UTR = 1.0;
const MAX_UTR = 16.5;

// How much UTR moves per match — smaller than Elo K because the scale is 1-16
const K_FACTOR = 0.4;

function clampUtr(utr) {
  return Math.round(Math.min(MAX_UTR, Math.max(MIN_UTR, utr)) * 100) / 100;
}

function expectedScore(utrA, utrB) {
  // Same logistic curve as Elo, scaled for UTR range
  // A 2-point UTR gap ≈ ~76% expected win rate (similar to 400-point Elo gap)
  return 1 / (1 + Math.pow(10, (utrB - utrA) / 4));
}

function calculateNewUtr(utr, expected, actual) {
  return clampUtr(utr + K_FACTOR * (actual - expected));
}

/**
 * Ensure player_ratings rows exist for given players/sport with UTR defaults.
 */
async function ensurePlayerRatings(client, playerIds, sport) {
  for (const playerId of playerIds) {
    for (const ratingType of VALID_RATING_TYPES) {
      await client.query(
        `INSERT INTO player_ratings (player_id, sport, rating_type, singles_elo, doubles_elo, singles_utr, doubles_utr)
         VALUES ($1, $2, $3, 1000, 1000, $4, $4)
         ON CONFLICT (player_id, sport, rating_type) DO NOTHING`,
        [playerId, sport, ratingType, DEFAULT_UTR]
      );
    }
  }
}

/**
 * Process UTR updates for a newly recorded match.
 */
async function processMatchUtr(client, matchId, matchType, winnerIds, loserIds, sport, ratingType) {
  const utrField = matchType === "singles" ? "singles_utr" : "doubles_utr";

  const allIds = [...winnerIds, ...loserIds];

  await ensurePlayerRatings(client, allIds, sport);

  // Fetch current UTR
  const playersResult = await client.query(
    `SELECT player_id, ${utrField} as utr FROM player_ratings
     WHERE player_id = ANY($1) AND sport = $2 AND rating_type = $3`,
    [allIds, sport, ratingType]
  );
  const utrMap = {};
  playersResult.rows.forEach((p) => {
    utrMap[p.player_id] = parseFloat(p.utr);
  });

  // Calculate team averages
  const avgWinner =
    winnerIds.reduce((sum, id) => sum + (utrMap[id] || DEFAULT_UTR), 0) /
    winnerIds.length;
  const avgLoser =
    loserIds.reduce((sum, id) => sum + (utrMap[id] || DEFAULT_UTR), 0) /
    loserIds.length;

  const expected = expectedScore(avgWinner, avgLoser);

  // Update each winner
  for (const id of winnerIds) {
    const oldUtr = utrMap[id] || DEFAULT_UTR;
    const newUtr = calculateNewUtr(oldUtr, expected, 1);

    // Store as elo_before/elo_after in match_players (multiplied by 100 for integer storage)
    const oldStored = Math.round(oldUtr * 100);
    const newStored = Math.round(newUtr * 100);

    await client.query(
      `UPDATE player_ratings SET ${utrField} = $1
       WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
      [newUtr, id, sport, ratingType]
    );
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldStored, newStored, matchId, id]
    );
  }

  // Update each loser
  for (const id of loserIds) {
    const oldUtr = utrMap[id] || DEFAULT_UTR;
    const newUtr = calculateNewUtr(oldUtr, 1 - expected, 0);

    const oldStored = Math.round(oldUtr * 100);
    const newStored = Math.round(newUtr * 100);

    await client.query(
      `UPDATE player_ratings SET ${utrField} = $1
       WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
      [newUtr, id, sport, ratingType]
    );
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldStored, newStored, matchId, id]
    );
  }
}

module.exports = { processMatchUtr, ensurePlayerRatings, DEFAULT_UTR, MIN_UTR, MAX_UTR };
