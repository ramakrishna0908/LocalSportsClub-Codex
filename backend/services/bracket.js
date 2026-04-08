/**
 * Single-elimination bracket generation and management.
 * Supports both individual and team tournaments.
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
 * Generate bracket for an INDIVIDUAL tournament.
 * Must be called within a transaction.
 */
async function generateBracket(client, tournamentId) {
  const tourney = await client.query(
    "SELECT * FROM tournaments WHERE id = $1",
    [tournamentId]
  );
  if (tourney.rows.length === 0) {
    throw new Error("Tournament not found");
  }
  const tournament = tourney.rows[0];
  const eloField = tournament.match_type === "singles" ? "singles_elo" : "doubles_elo";
  const sport = tournament.sport || "ping_pong";

  const playersResult = await client.query(
    `SELECT tp.player_id, COALESCE(pr.${eloField}, 1000) AS elo
     FROM tournament_players tp
     LEFT JOIN player_ratings pr ON pr.player_id = tp.player_id
       AND pr.sport = $2 AND pr.rating_type = 'tournament'
     WHERE tp.tournament_id = $1
     ORDER BY COALESCE(pr.${eloField}, 1000) DESC`,
    [tournamentId, sport]
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
      await client.query(
        `UPDATE tournament_brackets SET winner_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [player1, tournamentId, pos + 1]
      );
      await advanceWinner(client, tournamentId, 1, pos + 1, player1, totalRounds);
    } else if (!player1 && player2) {
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
 * Generate bracket for a TEAM tournament (knockout format).
 */
async function generateTeamBracket(client, tournamentId) {
  const tourney = await client.query(
    "SELECT * FROM tournaments WHERE id = $1",
    [tournamentId]
  );
  if (tourney.rows.length === 0) {
    throw new Error("Tournament not found");
  }

  const teamsResult = await client.query(
    `SELECT id, name FROM tournament_teams WHERE tournament_id = $1 ORDER BY id`,
    [tournamentId]
  );
  const teams = teamsResult.rows;

  if (teams.length < 2) {
    throw new Error("Need at least 2 teams to generate a bracket");
  }

  // Assign seeds (simple order for teams)
  for (let i = 0; i < teams.length; i++) {
    await client.query(
      "UPDATE tournament_teams SET seed = $1 WHERE id = $2",
      [i + 1, teams[i].id]
    );
  }

  const bracketSize = nextPowerOf2(teams.length);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = generateSeedOrder(bracketSize);

  const firstRoundMatchups = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const seed1 = seedOrder[i];
    const seed2 = seedOrder[i + 1];
    const team1 = seed1 <= teams.length ? teams[seed1 - 1] : null;
    const team2 = seed2 <= teams.length ? teams[seed2 - 1] : null;
    firstRoundMatchups.push({ team1, team2 });
  }

  // Insert first-round bracket slots
  for (let pos = 0; pos < firstRoundMatchups.length; pos++) {
    const { team1, team2 } = firstRoundMatchups[pos];
    await client.query(
      `INSERT INTO tournament_brackets (tournament_id, round, position, team1_id, team2_id)
       VALUES ($1, 1, $2, $3, $4)`,
      [tournamentId, pos + 1, team1?.id || null, team2?.id || null]
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
    const { team1, team2 } = firstRoundMatchups[pos];
    if (team1 && !team2) {
      await client.query(
        `UPDATE tournament_brackets SET winner_team_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [team1.id, tournamentId, pos + 1]
      );
      await advanceTeamWinner(client, tournamentId, 1, pos + 1, team1.id, totalRounds);
    } else if (!team1 && team2) {
      await client.query(
        `UPDATE tournament_brackets SET winner_team_id = $1
         WHERE tournament_id = $2 AND round = 1 AND position = $3`,
        [team2.id, tournamentId, pos + 1]
      );
      await advanceTeamWinner(client, tournamentId, 1, pos + 1, team2.id, totalRounds);
    }
  }

  await client.query(
    "UPDATE tournaments SET status = 'in_progress' WHERE id = $1",
    [tournamentId]
  );
}

/**
 * Generate round-robin fixtures for a team tournament.
 */
async function generateTeamRoundRobin(client, tournamentId) {
  const tourney = await client.query(
    "SELECT * FROM tournaments WHERE id = $1",
    [tournamentId]
  );
  if (tourney.rows.length === 0) {
    throw new Error("Tournament not found");
  }

  const teamsResult = await client.query(
    `SELECT id, name FROM tournament_teams WHERE tournament_id = $1 ORDER BY id`,
    [tournamentId]
  );
  const teams = teamsResult.rows;

  if (teams.length < 2) {
    throw new Error("Need at least 2 teams for round-robin");
  }

  // Initialize standings
  for (const team of teams) {
    await client.query(
      `INSERT INTO tournament_round_robin (tournament_id, team_id) VALUES ($1, $2)
       ON CONFLICT (tournament_id, team_id) DO NOTHING`,
      [tournamentId, team.id]
    );
  }

  // Generate round-robin fixtures: every team plays every other team once
  let round = 1;
  let position = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      await client.query(
        `INSERT INTO tournament_brackets (tournament_id, round, position, team1_id, team2_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [tournamentId, round, position, teams[i].id, teams[j].id]
      );
      position++;
    }
  }

  await client.query(
    "UPDATE tournaments SET status = 'in_progress' WHERE id = $1",
    [tournamentId]
  );
}

/**
 * Advance a winner (individual) to the next round of the bracket.
 */
async function advanceWinner(client, tournamentId, round, position, winnerId, totalRounds) {
  if (round >= totalRounds) {
    await client.query(
      "UPDATE tournaments SET status = 'completed' WHERE id = $1",
      [tournamentId]
    );
    return;
  }

  const nextRound = round + 1;
  const nextPosition = Math.ceil(position / 2);

  const isPlayer1 = position % 2 === 1;
  const field = isPlayer1 ? "player1_id" : "player2_id";

  await client.query(
    `UPDATE tournament_brackets SET ${field} = $1
     WHERE tournament_id = $2 AND round = $3 AND position = $4`,
    [winnerId, tournamentId, nextRound, nextPosition]
  );
}

/**
 * Advance a team winner to the next round of the bracket.
 */
async function advanceTeamWinner(client, tournamentId, round, position, teamId, totalRounds) {
  if (round >= totalRounds) {
    await client.query(
      "UPDATE tournaments SET status = 'completed' WHERE id = $1",
      [tournamentId]
    );
    return;
  }

  const nextRound = round + 1;
  const nextPosition = Math.ceil(position / 2);
  const isTeam1 = position % 2 === 1;
  const field = isTeam1 ? "team1_id" : "team2_id";

  await client.query(
    `UPDATE tournament_brackets SET ${field} = $1
     WHERE tournament_id = $2 AND round = $3 AND position = $4`,
    [teamId, tournamentId, nextRound, nextPosition]
  );
}

module.exports = {
  generateBracket,
  generateTeamBracket,
  generateTeamRoundRobin,
  advanceWinner,
  advanceTeamWinner,
  nextPowerOf2,
};
