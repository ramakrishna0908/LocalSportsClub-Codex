/**
 * Single-elimination bracket generation and management.
 */

/**
 * Round up to next power of 2.
 */
function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generate standard seeding positions for a bracket of given size.
 * E.g., for 8 players: [[1,8],[4,5],[2,7],[3,6]]
 * This ensures top seeds are on opposite sides of the bracket.
 */
function generateSeedOrder(bracketSize) {
  if (bracketSize === 1) return [1];

  const rounds = Math.log2(bracketSize);
  let positions = [1, 2];

  for (let r = 1; r < rounds; r++) {
    const newPositions = [];
    const sum = Math.pow(2, r + 1) + 1;
    for (const pos of positions) {
      newPositions.push(pos);
      newPositions.push(sum - pos);
    }
    positions = newPositions;
  }

  return positions;
}

/**
 * Generate bracket for a tournament.
 * Must be called within a transaction.
 *
 * @param {object} client - pg client (inside transaction)
 * @param {number} tournamentId
 */
async function generateBracket(client, tournamentId) {
  // Fetch tournament info
  const tourney = await client.query(
    "SELECT * FROM tournaments WHERE id = $1",
    [tournamentId]
  );
  if (tourney.rows.length === 0) {
    throw new Error("Tournament not found");
  }
  const tournament = tourney.rows[0];
  const eloField = tournament.match_type === "singles" ? "singles_elo" : "doubles_elo";

  // Fetch registered players sorted by Elo (best first = seed 1)
  const playersResult = await client.query(
    `SELECT tp.player_id, p.${eloField} AS elo
     FROM tournament_players tp
     JOIN players p ON p.id = tp.player_id
     WHERE tp.tournament_id = $1
     ORDER BY p.${eloField} DESC`,
    [tournamentId]
  );
  const players = playersResult.rows;

  if (players.length < 2) {
    throw new Error("Need at least 2 players to generate a bracket");
  }

  // Update seeds
  for (let i = 0; i < players.length; i++) {
    await client.query(
      "UPDATE tournament_players SET seed = $1 WHERE tournament_id = $2 AND player_id = $3",
      [i + 1, tournamentId, players[i].player_id]
    );
  }

  const bracketSize = nextPowerOf2(players.length);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = generateSeedOrder(bracketSize);

  // Create first-round matchups
  const firstRoundMatchups = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const seed1 = seedOrder[i];
    const seed2 = seedOrder[i + 1];
    const player1 = seed1 <= players.length ? players[seed1 - 1].player_id : null;
    const player2 = seed2 <= players.length ? players[seed2 - 1].player_id : null;
    firstRoundMatchups.push({ player1, player2 });
  }

  // Insert first-round bracket slots
  for (let pos = 0; pos < firstRoundMatchups.length; pos++) {
    const { player1, player2 } = firstRoundMatchups[pos];
    await client.query(
      `INSERT INTO tournament_brackets (tournament_id, round, position, player1_id, player2_id)
       VALUES ($1, 1, $2, $3, $4)`,
      [tournamentId, pos + 1, player1, player2]
    );
  }

  // Create empty bracket slots for subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let pos = 1; pos <= matchesInRound; pos++) {
      await client.query(
        `INSERT INTO tournament_brackets (tournament_id, round, position)
         VALUES ($1, $2, $3)`,
        [tournamentId, round, pos]
      );
    }
  }

  // Auto-advance byes in first round
  for (let pos = 0; pos < firstRoundMatchups.length; pos++) {
    const { player1, player2 } = firstRoundMatchups[pos];
    if (player1 && !player2) {
      // player1 gets a bye
      await client.query(
        `UPDATE tournament_brackets SET winner_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [player1, tournamentId, pos + 1]
      );
      await advanceWinner(client, tournamentId, 1, pos + 1, player1, totalRounds);
    } else if (!player1 && player2) {
      // player2 gets a bye
      await client.query(
        `UPDATE tournament_brackets SET winner_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [player2, tournamentId, pos + 1]
      );
      await advanceWinner(client, tournamentId, 1, pos + 1, player2, totalRounds);
    }
  }

  // Update tournament status
  await client.query(
    "UPDATE tournaments SET status = 'in_progress' WHERE id = $1",
    [tournamentId]
  );
}

/**
 * Advance a winner to the next round of the bracket.
 *
 * @param {object} client - pg client (inside transaction)
 * @param {number} tournamentId
 * @param {number} round - current round
 * @param {number} position - current position (1-based)
 * @param {number} winnerId - player who won
 * @param {number} totalRounds - total rounds in bracket
 */
async function advanceWinner(client, tournamentId, round, position, winnerId, totalRounds) {
  if (round >= totalRounds) {
    // This was the final — tournament is complete
    await client.query(
      "UPDATE tournaments SET status = 'completed' WHERE id = $1",
      [tournamentId]
    );
    return;
  }

  const nextRound = round + 1;
  const nextPosition = Math.ceil(position / 2);

  // Determine if winner goes to player1 or player2 slot
  const isPlayer1 = position % 2 === 1;
  const field = isPlayer1 ? "player1_id" : "player2_id";

  await client.query(
    `UPDATE tournament_brackets SET ${field} = $1
     WHERE tournament_id = $2 AND round = $3 AND position = $4`,
    [winnerId, tournamentId, nextRound, nextPosition]
  );
}

module.exports = { generateBracket, advanceWinner, nextPowerOf2 };
