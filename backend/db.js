const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection on startup
pool.query("SELECT NOW()").then(() => {
  console.log("✅ Connected to PostgreSQL");
}).catch((err) => {
  console.error("❌ PostgreSQL connection failed:", err.message);
  process.exit(1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
