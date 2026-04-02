const db = require("./db");

const migration = `
-- ============================================================
-- Ping Pong Club — Database Schema
-- ============================================================

-- Players table: user accounts + Elo ratings
CREATE TABLE IF NOT EXISTS players (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50)  UNIQUE NOT NULL,
  display_name    VARCHAR(100) NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  singles_elo     INTEGER NOT NULL DEFAULT 1000,
  doubles_elo     INTEGER NOT NULL DEFAULT 1000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login      TIMESTAMPTZ
);

-- Sessions table: for JWT blacklisting on logout
CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Matches table: each recorded game
CREATE TABLE IF NOT EXISTS matches (
  id           SERIAL PRIMARY KEY,
  match_type   VARCHAR(10) NOT NULL CHECK (match_type IN ('singles', 'doubles')),
  score        VARCHAR(100),
  played_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by  INTEGER NOT NULL REFERENCES players(id)
);

-- Match players: junction table linking players to matches
CREATE TABLE IF NOT EXISTS match_players (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  team        VARCHAR(10) NOT NULL CHECK (team IN ('winner', 'loser')),
  elo_before  INTEGER,
  elo_after   INTEGER
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_match_players_match_id   ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id  ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at        ON matches(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_match_type       ON matches(match_type);
CREATE INDEX IF NOT EXISTS idx_sessions_token           ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id       ON sessions(player_id);

-- ============================================================
-- Leagues
-- ============================================================

CREATE TABLE IF NOT EXISTS leagues (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  match_type   VARCHAR(10) NOT NULL CHECK (match_type IN ('singles', 'doubles')),
  status       VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming', 'active', 'completed')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  created_by   INTEGER NOT NULL REFERENCES players(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_players (
  id         SERIAL PRIMARY KEY,
  league_id  INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

-- ============================================================
-- Tournaments
-- ============================================================

CREATE TABLE IF NOT EXISTS tournaments (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  match_type      VARCHAR(10) NOT NULL CHECK (match_type IN ('singles', 'doubles')),
  status          VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming', 'registration', 'in_progress', 'completed')),
  tournament_date DATE NOT NULL,
  max_players     INTEGER,
  created_by      INTEGER NOT NULL REFERENCES players(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     INTEGER NOT NULL REFERENCES players(id),
  seed          INTEGER,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_brackets (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  position      INTEGER NOT NULL,
  match_id      INTEGER REFERENCES matches(id),
  player1_id    INTEGER REFERENCES players(id),
  player2_id    INTEGER REFERENCES players(id),
  winner_id     INTEGER REFERENCES players(id),
  UNIQUE(tournament_id, round, position)
);

-- ============================================================
-- Add league/tournament FK columns to matches
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'league_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN league_id INTEGER REFERENCES leagues(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'tournament_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id);
  END IF;
END $$;

-- ============================================================
-- Additional indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_matches_league_id             ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id         ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_league_players_league          ON league_players(league_id);
CREATE INDEX IF NOT EXISTS idx_league_players_player          ON league_players(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament   ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_tournament  ON tournament_brackets(tournament_id);
`;

async function migrate() {
  try {
    console.log("🔄 Running migrations...");
    await db.query(migration);
    console.log("✅ Migration complete — all tables created");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
