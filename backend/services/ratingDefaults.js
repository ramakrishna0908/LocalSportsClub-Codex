const db = require("../db");
const { getRatingSystem } = require("../constants");

// In-memory cache with TTL
let cache = { elo: 1000, utr: 1.0, loadedAt: 0 };
const CACHE_TTL = 60_000; // refresh from DB every 60s

async function loadDefaults() {
  if (Date.now() - cache.loadedAt < CACHE_TTL) return cache;

  try {
    const result = await db.query(
      "SELECT key, value FROM club_settings WHERE key IN ('default_elo', 'default_utr')"
    );
    result.rows.forEach((r) => {
      if (r.key === "default_elo") cache.elo = parseInt(r.value) || 1000;
      if (r.key === "default_utr") cache.utr = parseFloat(r.value) || 1.0;
    });
    cache.loadedAt = Date.now();
  } catch {
    // Fall back to last known or hardcoded defaults
  }
  return cache;
}

async function getDefaultRating(sport) {
  const defaults = await loadDefaults();
  return getRatingSystem(sport) === "utr" ? defaults.utr : defaults.elo;
}

async function getDefaultElo() {
  const defaults = await loadDefaults();
  return defaults.elo;
}

async function getDefaultUtr() {
  const defaults = await loadDefaults();
  return defaults.utr;
}

module.exports = { getDefaultRating, getDefaultElo, getDefaultUtr, loadDefaults };
