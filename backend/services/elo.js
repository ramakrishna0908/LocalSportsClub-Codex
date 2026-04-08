const { VALID_RATING_TYPES } = require("../constants");
const { getDefaultElo } = require("./ratingDefaults");

const K_FACTOR = 32;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculateNewRating(rating, expected, actual) {
  return Math.round(rating + K_FACTOR * (actual - expected));
}

/**
 * Ensure player_ratings rows exist for given players, sport, and all rating types.
 */
async function ensurePlayerRatings(client, playerIds, sport) {
  const defaultElo = await getDefaultElo();
  for (const playerId of playerIds) {
    for (const ratingType of VALID_RATING_TYPES) {
      await client.query(
        `INSERT INTO player_ratings (player_id, sport, rating_type, singles_elo, doubles_elo)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (player_id, sport, rating_type) DO NOTHING`,
        [playerId, sport, ratingType, defaultElo]
      );
    }
  }
}

/**
 * Process Elo updates for a newly recorded match.
 */
async function processMatchElo(client, matchId, matchType, winnerIds, loserIds, sport, ratingType) {
  const defaultElo = await getDefaultElo();
  const eloField = matchType === "singles" ? "singles_elo" : "doubles_elo";

  const allIds = [...winnerIds, ...loserIds];

  await ensurePlayerRatings(client, allIds, sport);

  const playersResult = await client.query(
    `SELECT player_id, ${eloField} as elo FROM player_ratings
     WHERE player_id = ANY($1) AND sport = $2 AND rating_type = $3`,
    [allIds, sport, ratingType]
  );
  const eloMap = {};
  playersResult.rows.forEach((p) => {
    eloMap[p.player_id] = p.elo;
  });

  const avgWinner =
    winnerIds.reduce((sum, id) => sum + (eloMap[id] || defaultElo), 0) /
    winnerIds.length;
  const avgLoser =
    loserIds.reduce((sum, id) => sum + (eloMap[id] || defaultElo), 0) /
    loserIds.length;

  const expected = expectedScore(avgWinner, avgLoser);

  for (const id of winnerIds) {
    const oldElo = eloMap[id] || defaultElo;
    const newElo = calculateNewRating(oldElo, expected, 1);

    await client.query(
      `UPDATE player_ratings SET ${eloField} = $1
       WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
      [newElo, id, sport, ratingType]
    );
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldElo, newElo, matchId, id]
    );
  }

  for (const id of loserIds) {
    const oldElo = eloMap[id] || defaultElo;
    const newElo = calculateNewRating(oldElo, 1 - expected, 0);

    await client.query(
      `UPDATE player_ratings SET ${eloField} = $1
       WHERE player_id = $2 AND sport = $3 AND rating_type = $4`,
      [newElo, id, sport, ratingType]
    );
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldElo, newElo, matchId, id]
    );
  }
}

module.exports = { processMatchElo, ensurePlayerRatings };
