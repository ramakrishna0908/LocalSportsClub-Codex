const db = require("../db");

const K_FACTOR = 32;
const DEFAULT_ELO = 1000;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculateNewRating(rating, expected, actual) {
  return Math.round(rating + K_FACTOR * (actual - expected));
}

/**
 * Process Elo updates for a newly recorded match.
 * Called inside a transaction from the matches route.
 *
 * @param {object} client - pg client (inside transaction)
 * @param {number} matchId
 * @param {string} matchType - 'singles' | 'doubles'
 * @param {number[]} winnerIds
 * @param {number[]} loserIds
 */
async function processMatchElo(client, matchId, matchType, winnerIds, loserIds) {
  const eloField = matchType === "singles" ? "singles_elo" : "doubles_elo";

  // Fetch current Elo for all involved players
  const allIds = [...winnerIds, ...loserIds];
  const playersResult = await client.query(
    `SELECT id, ${eloField} as elo FROM players WHERE id = ANY($1)`,
    [allIds]
  );
  const eloMap = {};
  playersResult.rows.forEach((p) => {
    eloMap[p.id] = p.elo;
  });

  // Calculate team averages
  const avgWinner =
    winnerIds.reduce((sum, id) => sum + (eloMap[id] || DEFAULT_ELO), 0) /
    winnerIds.length;
  const avgLoser =
    loserIds.reduce((sum, id) => sum + (eloMap[id] || DEFAULT_ELO), 0) /
    loserIds.length;

  const expected = expectedScore(avgWinner, avgLoser);

  // Update each winner
  for (const id of winnerIds) {
    const oldElo = eloMap[id] || DEFAULT_ELO;
    const newElo = calculateNewRating(oldElo, expected, 1);

    await client.query(`UPDATE players SET ${eloField} = $1 WHERE id = $2`, [
      newElo,
      id,
    ]);
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldElo, newElo, matchId, id]
    );
  }

  // Update each loser
  for (const id of loserIds) {
    const oldElo = eloMap[id] || DEFAULT_ELO;
    const newElo = calculateNewRating(oldElo, 1 - expected, 0);

    await client.query(`UPDATE players SET ${eloField} = $1 WHERE id = $2`, [
      newElo,
      id,
    ]);
    await client.query(
      `UPDATE match_players SET elo_before = $1, elo_after = $2 WHERE match_id = $3 AND player_id = $4`,
      [oldElo, newElo, matchId, id]
    );
  }
}

module.exports = { processMatchElo, DEFAULT_ELO };
