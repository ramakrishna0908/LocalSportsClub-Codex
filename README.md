# 🏓 Ping Pong Club — Rank Tracking System

A full-stack application for local table tennis clubs to track singles & doubles matches, calculate Elo ratings, and display player rankings.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** bcrypt password hashing + JWT tokens

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Quick Start

### 1. Set up PostgreSQL

```bash
# Create the database
createdb pingpong_club

# Or via psql
psql -U postgres -c "CREATE DATABASE pingpong_club;"
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials
```

### 3. Install & Run Backend

```bash
cd backend
npm install
npm run db:migrate   # Creates all tables
npm run dev          # Starts on http://localhost:3001
```

### 4. Install & Run Frontend

```bash
cd frontend
npm install
npm run dev          # Starts on http://localhost:5173
```

## Project Structure

```
pingpong-club/
├── backend/
│   ├── server.js           # Express app entry point
│   ├── db.js               # PostgreSQL connection pool
│   ├── migrate.js          # Database migration script
│   ├── middleware/
│   │   └── auth.js         # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js         # Register, login, logout, me
│   │   ├── matches.js      # Record matches, fetch history
│   │   ├── players.js      # Player list, profiles
│   │   └── rankings.js     # Singles & doubles leaderboards
│   ├── services/
│   │   └── elo.js          # Elo rating calculation engine
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # Axios API client
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth state management
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── Badge.jsx
│   │   │   └── MatchRow.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RecordMatch.jsx
│   │   │   ├── Rankings.jsx
│   │   │   └── MatchHistory.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

## API Contract

The shared backend/frontend API contract now lives at [backend/openapi.yaml](/Users/ramakrishna0908/MyProjects/LocalSportsClub/backend/openapi.yaml).

Use that file as the canonical reference for:

- endpoints
- request and response shapes
- auth requirements
- enum values
- shared integration assumptions

## Database Schema

The app uses 4 tables:

- **players** — User accounts with credentials and Elo ratings
- **sessions** — JWT token blacklist for logout
- **matches** — Match records (type, score, timestamp)
- **match_players** — Junction table linking players to matches with team & Elo snapshots

## Elo Rating System

- K-factor: 32
- Default rating: 1000
- Singles: direct player-vs-player calculation
- Doubles: uses averaged team Elo for calculation, then applies individual updates
