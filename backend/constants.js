const VALID_SPORTS = ['ping_pong', 'pickleball', 'tennis'];
const VALID_RATING_TYPES = ['league', 'tournament', 'skill'];

const SPORT_LABELS = {
  ping_pong: 'Ping Pong',
  pickleball: 'Pickleball',
  tennis: 'Tennis',
};

// Rating system per sport: 'elo' or 'utr'
const SPORT_RATING_SYSTEM = {
  ping_pong: 'elo',
  pickleball: 'utr',
  tennis: 'utr',
};

function getRatingSystem(sport) {
  return SPORT_RATING_SYSTEM[sport] || 'elo';
}

function validateSport(sport) {
  return VALID_SPORTS.includes(sport);
}

function validateRatingType(ratingType) {
  return VALID_RATING_TYPES.includes(ratingType);
}

module.exports = { VALID_SPORTS, VALID_RATING_TYPES, SPORT_LABELS, SPORT_RATING_SYSTEM, getRatingSystem, validateSport, validateRatingType };
