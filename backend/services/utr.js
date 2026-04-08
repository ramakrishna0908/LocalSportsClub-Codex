const { VALID_RATING_TYPES } = require("../constants");
const { getDefaultUtr, getDefaultElo } = require("./ratingDefaults");

// UTR (Universal Tennis Rating) — simplified for club use
// Scale: 1.00 – 16.50
// 1-3: Beginner, 4-6: Intermediate, 7-9: Advanced, 10-12: Competitive, 13-16.5: Elite/Pro
const MIN_UTR = 1.0;
const MAX_UTR = 16.5;

// How much UTR moves per match — smaller than Elo K because the scale is 1-16
const K_FACTOR = 0.4;

function clampUtr(utr, min) {
  return Math.round(Math.min(MAX_UTR, Math.max(min, utr)) * 100) / 100;
}

function expectedScore(utrA, utrB) {
  return 1 / (1 + Math.pow(10, (utrB - utrA) / 4));
}

function calculateNewUtr(utr, expected, actual, min) {
  return clampUtr(utr + K_FACTOR * (actual - expected), min);
}

/**
 * Ensure player_ratings rows exist for given players/sport with UTR defaults.
 */
async function ensurePlayerRatings(client, playerIds, sport) {
  const defaultUtr = await getDefaultUtr();
  const defaultElo = await getDefaultElo();
  for (const playerId of playerIds) {
    for (const ratingType of VALID_RATING_TYPES) {
      await client.query(
        `INSERT INTO player_ratings (player_id, sport, rating_type, singles_elo, doubles_elo, singles_utr, doubles_utr)
         VALUES ($1, $2, $3, $5, $5, $4, $4)
         ON CONFLICT (player_id, sport, rating_type) DO NOTHING`,
        [playerId, sport, ratingType, defaultUtr, defaultElo]
      );
    }
  }
}

/**
 * Process UTR updates for a newly recorded match.
 */
async function processMatchUtr(client, matchId, matchType, winnerIds, loserIds, sport, ratingType) {
  const defaultUtr = await getDefaultUtr();
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

  const avgWinner =
    winnerIds.reduce((sum, id) => sum + (utrMap[id] || defaultUtr), 0) /
    winnerIds.length;
  const avgLoser =
    loserIds.reduce((sum, id) => sum + (utrMap[id] || defaultUtr), 0) /
    loserIds.length;

  const expected = expectedScore(avgWinner, avgLoser);

  for (const id of winnerIds) {
    const oldUtr = utrMap[id] || defaultUtr;
    const newUtr = calculateNewUtr(oldUtr, expected, 1, MIN_UTR);

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

  for (const id of loserIds) {
    const oldUtr = utrMap[id] || defaultUtr;
    const newUtr = calculateNewUtr(oldUtr, 1 - expected, 0, MIN_UTR);

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

module.exports = { processMatchUtr, ensurePlayerRatings, MIN_UTR, MAX_UTR };
