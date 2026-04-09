# Local Sports Club Frontend

Frontend for a multi-sport local club platform that supports player auth, match recording, rankings, leagues, tournaments, clubs, analytics, and admin workflows.

This documentation is derived from the current frontend codebase. The API section reflects how the frontend calls the backend and what fields it expects in responses.

## Stack

- React 18
- Vite 5
- React Router 6
- Axios
- Recharts
- Tailwind CSS

## Project Purpose

The app allows authenticated players to:

- register and log in
- select a default sport
- record singles and doubles matches
- view rankings by sport and rating type
- join and manage leagues
- register for and manage tournaments
- manage clubs and club admins
- review analytics and history
- administer users and global settings

Supported sport keys:

- `ping_pong`
- `pickleball`
- `tennis`

Rating systems used by the UI:

- `ping_pong` -> Elo
- `pickleball` -> UTR
- `tennis` -> UTR

Rating type keys used throughout the app:

- `skill`
- `league`
- `tournament`

## Application Structure

### Entry Points

- `src/main.jsx`: mounts the app, wraps it with `BrowserRouter` and `AuthProvider`
- `src/App.jsx`: defines guest and protected routes
- `src/api/client.js`: shared Axios client and auth interceptors

### Contexts

- `AuthContext`: session bootstrap, login, register, logout, refresh current player
- `SportContext`: current sport selection, default sport persistence, sport metadata

### Main Feature Pages

- `Login`, `Register`
- `Dashboard`
- `RecordMatch`
- `Rankings`
- `Leagues`, `LeagueDetail`
- `Tournaments`, `TournamentDetail`
- `Clubs`, `ClubDetail`
- `CompetitionHistory`
- `Analytics`
- `Help`
- `Admin`

## Route Map

### Guest Routes

- `/login`
- `/register`

### Protected Routes

- `/` -> dashboard
- `/record`
- `/rankings`
- `/leagues`
- `/leagues/:id`
- `/tournaments`
- `/tournaments/:id`
- `/clubs`
- `/clubs/:id`
- `/history`
- `/analytics`
- `/help`
- `/admin`

Unknown protected routes redirect to `/`.

## Authentication and Session Behavior

The frontend stores the JWT in `localStorage` under `lsc_token`.

Behavior implemented in `src/api/client.js`:

- all API calls use base URL `/api`
- if `lsc_token` exists, `Authorization: Bearer <token>` is attached
- on `401`, the token is removed and the browser is redirected to `/login`

Behavior implemented in `AuthContext`:

- on app load, `GET /auth/me` validates the session
- `POST /auth/login` and `POST /auth/register` save the returned token
- `POST /auth/logout` is called on logout, but logout still clears local state if that request fails

## Local Development

Install and run:

```bash
npm ci
npm run dev
```

Vite runs on `http://localhost:5173`.

### Dev Proxy

`vite.config.js` proxies `/api` to:

```text
http://localhost:3001
```

So the frontend expects the backend to be reachable on port `3001` during local development.

## Production Build and Container

Build locally:

```bash
npm run build
```

Docker flow:

1. Build the Vite app in a Node 20 Alpine stage.
2. Serve the generated `dist/` output from Nginx.
3. Proxy `/api/` requests from Nginx to `http://backend:3001`.

This means the deployed container expects another service named `backend` on port `3001`.

## UI/Domain Notes

### Roles

The UI recognizes these player roles:

- `admin`
- `director`
- `user`

Typical capability split in the frontend:

- `user`: core player flows
- `director`: can create competitions, record matches in director mode, manage certain competition details
- `admin`: full admin screen, role changes, global settings, broader management actions

### Competition Status Values

League statuses used by the UI:

- `upcoming`
- `registration`
- `active`
- `completed`

Tournament statuses used by the UI:

- `upcoming`
- `registration`
- `in_progress`
- `completed`

### Match Types

- `singles`
- `doubles`
- `both` (used by team tournaments)

## Shared API Contract

The backend now has a shared OpenAPI contract at [backend/openapi.yaml](/Users/ramakrishna0908/MyProjects/LocalSportsClub/backend/openapi.yaml).

Use that file as the canonical API reference. The summary below is kept intentionally high-level so the frontend README does not become a second source of truth.

## API Reference Summary

All paths below are relative to `/api`.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`
- `PATCH /auth/role`

### Players

- `GET /players`
- `GET /players/:id`
- `POST /players/quick-add`
- `PATCH /players/me/default-sport`

### Matches

- `GET /matches`
- `GET /matches/my`
- `POST /matches`
- `PATCH /matches/:id`
- `DELETE /matches/:id`

### Rankings

- `GET /rankings/singles`
- `GET /rankings/doubles`

### Leagues

- `GET /leagues`
- `POST /leagues`
- `GET /leagues/:id`
- `PATCH /leagues/:id`
- `POST /leagues/:id/join`
- `POST /leagues/:id/leave`
- `PATCH /leagues/:id/status`
- `POST /leagues/:id/directors`
- `DELETE /leagues/:id/directors/:playerId`
- `POST /leagues/:id/shuffle-groups`

### Tournaments

- `GET /tournaments`
- `POST /tournaments`
- `GET /tournaments/:id`
- `PATCH /tournaments/:id`
- `POST /tournaments/:id/register`
- `POST /tournaments/:id/unregister`
- `PATCH /tournaments/:id/status`
- `POST /tournaments/:id/generate-bracket`
- `POST /tournaments/:id/record-match`
- `POST /tournaments/:id/directors`
- `POST /tournaments/:id/teams`
- `PUT /tournaments/:id/teams/:teamId`
- `DELETE /tournaments/:id/teams/:teamId`

### Clubs

- `GET /clubs`
- `POST /clubs`
- `GET /clubs/my/list`
- `PATCH /clubs/default`
- `GET /clubs/:id`
- `PATCH /clubs/:id`
- `DELETE /clubs/:id`
- `POST /clubs/:id/admins`
- `DELETE /clubs/:id/admins/:playerId`
- `POST /clubs/:id/join`
- `POST /clubs/:id/leave`

### Analytics

- `GET /analytics/movers`
- `GET /analytics/suggestions`
- `GET /analytics/trends`

### Settings

- `GET /settings`
- `PATCH /settings`

## Data Shape Observations

The frontend currently consumes a mix of snake_case and camelCase fields, depending on endpoint:

- `display_name` and `displayName`
- `match_type` and `matchType`
- `default_sport` and `defaultSport`

If the backend evolves, standardizing these response shapes would reduce frontend translation risk.

## Important Integration Assumptions

- Backend base path is `/api`
- Dev backend target is `http://localhost:3001`
- Production Nginx target is `http://backend:3001`
- JWT auth is bearer-token based
- Unauthorized responses should return HTTP `401`

## Gaps and Notes

- `src/pages/MatchHistory.jsx` exists but is not wired into the current route tree; `/history` uses `CompetitionHistory`
- The backend now has an OpenAPI contract, but the frontend still consumes a mix of snake_case and camelCase response fields across endpoints
- `PATCH /matches/:id` is used but the exact editable payload is only partially visible from the UI logic

For request bodies, enums, and response shapes, use [backend/openapi.yaml](/Users/ramakrishna0908/MyProjects/LocalSportsClub/backend/openapi.yaml).
