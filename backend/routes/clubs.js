const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Helper: check if player is a club admin
async function isClubAdmin(clubId, playerId, client) {
  const conn = client || db;
  const result = await conn.query(
    "SELECT id FROM club_admins WHERE club_id = $1 AND player_id = $2",
    [clubId, playerId]
  );
  return result.rows.length > 0;
}

// Helper: check if player can manage a club (site admin or club admin)
async function canManageClub(clubId, player, client) {
  if (player.role === "admin") return true;
  return isClubAdmin(clubId, player.id, client);
}

// POST /api/clubs — create a new club (any authenticated user)
router.post("/", requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Club name is required" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO clubs (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, req.player.id]
    );
    const club = result.rows[0];

    // Creator becomes club admin and member
    await client.query(
      `INSERT INTO club_admins (club_id, player_id) VALUES ($1, $2)`,
      [club.id, req.player.id]
    );
    await client.query(
      `INSERT INTO club_members (club_id, player_id) VALUES ($1, $2)`,
      [club.id, req.player.id]
    );

    await client.query("COMMIT");

    res.status(201).json({ club });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create club error:", err);
    res.status(500).json({ error: "Failed to create club" });
  } finally {
    client.release();
  }
});

// GET /api/clubs — list all clubs
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
         p.display_name AS created_by_name,
         (SELECT COUNT(*) FROM club_admins ca WHERE ca.club_id = c.id) AS admin_count,
         (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS member_count,
         (SELECT COUNT(*) FROM leagues l WHERE l.club_id = c.id) AS league_count,
         (SELECT COUNT(*) FROM tournaments t WHERE t.club_id = c.id) AS tournament_count
       FROM clubs c
       JOIN players p ON p.id = c.created_by
       ORDER BY c.created_at DESC`
    );

    const clubs = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      adminCount: parseInt(row.admin_count),
      memberCount: parseInt(row.member_count),
      leagueCount: parseInt(row.league_count),
      tournamentCount: parseInt(row.tournament_count),
      createdAt: row.created_at,
    }));

    res.json({ clubs });
  } catch (err) {
    console.error("List clubs error:", err);
    res.status(500).json({ error: "Failed to fetch clubs" });
  }
});

// GET /api/clubs/my/list — list clubs the current user is a member of
router.get("/my/list", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.name
       FROM club_members cm
       JOIN clubs c ON c.id = cm.club_id
       WHERE cm.player_id = $1
       ORDER BY c.name`,
      [req.player.id]
    );
    res.json({ clubs: result.rows });
  } catch (err) {
    console.error("My clubs error:", err);
    res.status(500).json({ error: "Failed to fetch clubs" });
  }
});

// PATCH /api/clubs/default — set default club
router.patch("/default", requireAuth, async (req, res) => {
  try {
    const { clubId } = req.body;
    await db.query(
      "UPDATE players SET default_club_id = $1 WHERE id = $2",
      [clubId || null, req.player.id]
    );
    res.json({ message: "Default club updated" });
  } catch (err) {
    console.error("Set default club error:", err);
    res.status(500).json({ error: "Failed to set default club" });
  }
});

// GET /api/clubs/:id — club detail
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const clubResult = await db.query(
      `SELECT c.*, p.display_name AS created_by_name
       FROM clubs c
       JOIN players p ON p.id = c.created_by
       WHERE c.id = $1`,
      [id]
    );
    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: "Club not found" });
    }
    const row = clubResult.rows[0];

    // Admins
    const adminsResult = await db.query(
      `SELECT p.id, p.username, p.display_name
       FROM club_admins ca
       JOIN players p ON p.id = ca.player_id
       WHERE ca.club_id = $1`,
      [id]
    );

    // Leagues
    const leaguesResult = await db.query(
      `SELECT l.id, l.name, l.match_type, l.status, l.sport, l.start_date, l.end_date,
         (SELECT COUNT(*) FROM league_players lp WHERE lp.league_id = l.id) AS player_count
       FROM leagues l
       WHERE l.club_id = $1
       ORDER BY l.start_date DESC`,
      [id]
    );

    // Tournaments
    const tournamentsResult = await db.query(
      `SELECT t.id, t.name, t.match_type, t.status, t.sport, t.tournament_date, t.tournament_type, t.format,
         (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS player_count,
         (SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id) AS team_count
       FROM tournaments t
       WHERE t.club_id = $1
       ORDER BY t.tournament_date DESC`,
      [id]
    );

    const isAdmin = await isClubAdmin(id, req.player.id);
    const canManage = req.player.role === "admin" || isAdmin;

    const memberCheck = await db.query(
      "SELECT id FROM club_members WHERE club_id = $1 AND player_id = $2",
      [id, req.player.id]
    );
    const isMember = memberCheck.rows.length > 0;

    const memberCountResult = await db.query(
      "SELECT COUNT(*) FROM club_members WHERE club_id = $1",
      [id]
    );

    const club = {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      isClubAdmin: isAdmin,
      isMember,
      memberCount: parseInt(memberCountResult.rows[0].count),
      canManage,
      admins: adminsResult.rows.map((a) => ({
        id: a.id,
        username: a.username,
        displayName: a.display_name,
      })),
      leagues: leaguesResult.rows.map((l) => ({
        id: l.id,
        name: l.name,
        matchType: l.match_type,
        status: l.status,
        sport: l.sport,
        startDate: l.start_date,
        endDate: l.end_date,
        playerCount: parseInt(l.player_count),
      })),
      tournaments: tournamentsResult.rows.map((t) => ({
        id: t.id,
        name: t.name,
        matchType: t.match_type,
        status: t.status,
        sport: t.sport,
        tournamentDate: t.tournament_date,
        tournamentType: t.tournament_type,
        format: t.format,
        playerCount: parseInt(t.player_count),
        teamCount: parseInt(t.team_count),
      })),
    };

    res.json({ club });
  } catch (err) {
    console.error("Club detail error:", err);
    res.status(500).json({ error: "Failed to fetch club" });
  }
});

// PATCH /api/clubs/:id — update club (club admin or site admin)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const club = await db.query("SELECT * FROM clubs WHERE id = $1", [id]);
    if (club.rows.length === 0) {
      return res.status(404).json({ error: "Club not found" });
    }
    if (!(await canManageClub(id, req.player))) {
      return res.status(403).json({ error: "Only club admins or site admins can update club" });
    }

    if (name) {
      await db.query("UPDATE clubs SET name = $1 WHERE id = $2", [name, id]);
    }
    if (description !== undefined) {
      await db.query("UPDATE clubs SET description = $1 WHERE id = $2", [description, id]);
    }

    res.json({ message: "Club updated" });
  } catch (err) {
    console.error("Update club error:", err);
    res.status(500).json({ error: "Failed to update club" });
  }
});

// DELETE /api/clubs/:id — delete club (club admin or site admin)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const club = await db.query("SELECT * FROM clubs WHERE id = $1", [id]);
    if (club.rows.length === 0) {
      return res.status(404).json({ error: "Club not found" });
    }
    if (!(await canManageClub(id, req.player))) {
      return res.status(403).json({ error: "Only club admins or site admins can delete club" });
    }

    await db.query("DELETE FROM clubs WHERE id = $1", [id]);

    res.json({ message: "Club deleted" });
  } catch (err) {
    console.error("Delete club error:", err);
    res.status(500).json({ error: "Failed to delete club" });
  }
});

// POST /api/clubs/:id/admins — add a club admin
router.post("/:id/admins", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "playerId is required" });
    }

    const club = await db.query("SELECT * FROM clubs WHERE id = $1", [id]);
    if (club.rows.length === 0) {
      return res.status(404).json({ error: "Club not found" });
    }
    if (!(await canManageClub(id, req.player))) {
      return res.status(403).json({ error: "Only club admins or site admins can add admins" });
    }

    const target = await db.query("SELECT id FROM players WHERE id = $1", [playerId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    await db.query(
      `INSERT INTO club_admins (club_id, player_id) VALUES ($1, $2)
       ON CONFLICT (club_id, player_id) DO NOTHING`,
      [id, playerId]
    );

    res.json({ message: "Admin added" });
  } catch (err) {
    console.error("Add club admin error:", err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

// DELETE /api/clubs/:id/admins/:playerId — remove a club admin
router.delete("/:id/admins/:playerId", requireAuth, async (req, res) => {
  try {
    const { id, playerId } = req.params;

    if (!(await canManageClub(id, req.player))) {
      return res.status(403).json({ error: "Only club admins or site admins can remove admins" });
    }

    // Prevent removing the last admin
    const adminCount = await db.query(
      "SELECT COUNT(*) FROM club_admins WHERE club_id = $1",
      [id]
    );
    if (parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({ error: "Cannot remove the last club admin" });
    }

    await db.query(
      "DELETE FROM club_admins WHERE club_id = $1 AND player_id = $2",
      [id, playerId]
    );

    res.json({ message: "Admin removed" });
  } catch (err) {
    console.error("Remove club admin error:", err);
    res.status(500).json({ error: "Failed to remove admin" });
  }
});

// POST /api/clubs/:id/join — join a club
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const club = await db.query("SELECT id FROM clubs WHERE id = $1", [id]);
    if (club.rows.length === 0) {
      return res.status(404).json({ error: "Club not found" });
    }
    await db.query(
      `INSERT INTO club_members (club_id, player_id) VALUES ($1, $2)
       ON CONFLICT (club_id, player_id) DO NOTHING`,
      [id, req.player.id]
    );
    res.json({ message: "Joined club" });
  } catch (err) {
    console.error("Join club error:", err);
    res.status(500).json({ error: "Failed to join club" });
  }
});

// POST /api/clubs/:id/leave — leave a club
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "DELETE FROM club_members WHERE club_id = $1 AND player_id = $2",
      [id, req.player.id]
    );
    // Clear default if leaving that club
    await db.query(
      "UPDATE players SET default_club_id = NULL WHERE id = $1 AND default_club_id = $2",
      [req.player.id, id]
    );
    res.json({ message: "Left club" });
  } catch (err) {
    console.error("Leave club error:", err);
    res.status(500).json({ error: "Failed to leave club" });
  }
});

module.exports = router;
module.exports.isClubAdmin = isClubAdmin;
module.exports.canManageClub = canManageClub;
