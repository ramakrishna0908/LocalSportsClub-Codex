require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const playerRoutes = require("./routes/players");
const matchRoutes = require("./routes/matches");
const rankingRoutes = require("./routes/rankings");
const leagueRoutes = require("./routes/leagues");
const tournamentRoutes = require("./routes/tournaments");
const settingsRoutes = require("./routes/settings");
const analyticsRoutes = require("./routes/analytics");
const clubRoutes = require("./routes/clubs");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any local origin in dev
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/clubs", clubRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🏅 Local Sports Club API running on http://localhost:${PORT}\n`);
});
