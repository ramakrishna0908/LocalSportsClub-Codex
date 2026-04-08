import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Badge from "../components/Badge";
import ConfirmDialog from "../components/ConfirmDialog";
import CompetitionCard from "../components/CompetitionCard";

function formatName(displayName) {
  if (!displayName) return "";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ClubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Admin management
  const [allPlayers, setAllPlayers] = useState([]);
  const [adminToAdd, setAdminToAdd] = useState("");

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // null = club, {type, id, name} = admin

  const fetchClub = () => {
    setLoading(true);
    api
      .get(`/clubs/${id}`)
      .then((res) => setClub(res.data.club))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClub();
  }, [id]);

  useEffect(() => {
    api.get("/players").then((res) => setAllPlayers(res.data.players)).catch(() => {});
  }, []);

  const handleEdit = async () => {
    setActionMsg(null);
    try {
      await api.patch(`/clubs/${id}`, { name: editName, description: editDesc });
      setEditing(false);
      fetchClub();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update club");
    }
  };

  const handleDeleteClub = async () => {
    try {
      await api.delete(`/clubs/${id}`);
      navigate("/clubs");
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to delete club");
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleAddAdmin = async () => {
    if (!adminToAdd) return;
    setActionMsg(null);
    try {
      await api.post(`/clubs/${id}/admins`, { playerId: parseInt(adminToAdd) });
      setAdminToAdd("");
      fetchClub();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to add admin");
    }
  };

  const handleRemoveAdmin = (admin) => {
    setDeleteTarget({ type: "admin", id: admin.id, name: admin.displayName });
    setShowDeleteConfirm(true);
  };

  const confirmRemoveAdmin = async () => {
    if (!deleteTarget) return;
    setActionMsg(null);
    try {
      await api.delete(`/clubs/${id}/admins/${deleteTarget.id}`);
      fetchClub();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to remove admin");
    }
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  if (loading) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>;
  }

  if (!club) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Club not found</p>;
  }

  const canManage = club.canManage;
  const isSiteAdmin = player?.role === "admin";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-display text-2xl text-surface-900">{club.name}</h2>
              <div className="flex gap-2">
                {canManage && (
                  <button
                    onClick={() => {
                      setEditName(club.name);
                      setEditDesc(club.description || "");
                      setEditing(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-surface-100 border border-surface-200 font-body text-xs text-surface-500 hover:text-surface-700"
                  >
                    Edit
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => {
                      setDeleteTarget(null);
                      setShowDeleteConfirm(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-red-950 border border-red-800 font-body text-xs text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {club.description && (
              <p className="font-body text-sm text-surface-500 mb-2">{club.description}</p>
            )}
            <span className="font-mono text-[11px] text-surface-400">
              Created by {formatName(club.createdByName)}
            </span>
          </>
        ) : (
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
            <div className="grid gap-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Club name"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 rounded-lg bg-blue-950 border border-blue-800 font-body text-xs text-blue-400"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {actionMsg && (
        <p className="text-red-400 font-body text-sm mb-4">{actionMsg}</p>
      )}

      {/* Club Admins */}
      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
        <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
          Club Admins
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {club.admins.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-900/30 border border-brand-700/40"
            >
              <span className="text-brand-300 text-[12px] font-body">
                {formatName(a.displayName)}
              </span>
              {canManage && club.admins.length > 1 && (
                <button
                  onClick={() => handleRemoveAdmin(a)}
                  className="text-brand-600 hover:text-red-400 text-[11px] font-mono ml-1 transition-colors"
                  title="Remove admin"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <select
              value={adminToAdd}
              onChange={(e) => setAdminToAdd(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800 font-body text-sm"
            >
              <option value="">Add an admin...</option>
              {allPlayers
                .filter((p) => !club.admins.some((a) => a.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatName(p.display_name)} (@{p.username})
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddAdmin}
              disabled={!adminToAdd}
              className="px-4 py-1.5 rounded-lg bg-brand-900/50 border border-brand-700 font-body text-xs text-brand-300 disabled:opacity-30"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Leagues */}
      <h3 className="font-display text-lg text-surface-900 mb-3">
        Leagues ({club.leagues.length})
      </h3>
      {club.leagues.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-4 italic mb-6">
          No leagues in this club yet
        </p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {club.leagues.map((l) => (
            <CompetitionCard
              key={l.id}
              name={l.name}
              matchType={l.matchType}
              status={l.status}
              dateInfo={`${formatDate(l.startDate)} - ${formatDate(l.endDate)}`}
              playerCount={l.playerCount}
              onClick={() => navigate(`/leagues/${l.id}`)}
            />
          ))}
        </div>
      )}

      {/* Tournaments */}
      <h3 className="font-display text-lg text-surface-900 mb-3">
        Tournaments ({club.tournaments.length})
      </h3>
      {club.tournaments.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-4 italic mb-6">
          No tournaments in this club yet
        </p>
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {club.tournaments.map((t) => (
            <CompetitionCard
              key={t.id}
              name={t.name}
              matchType={t.matchType}
              status={t.status}
              dateInfo={formatDate(t.tournamentDate)}
              playerCount={t.tournamentType === "team" ? t.teamCount : t.playerCount}
              countLabel={t.tournamentType === "team" ? "teams" : undefined}
              badge={t.tournamentType === "team" ? "TEAM" : undefined}
              formatBadge={t.format === "round_robin" ? "RR" : "KO"}
              onClick={() => navigate(`/tournaments/${t.id}`)}
            />
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={deleteTarget?.type === "admin" ? "Remove Admin" : "Delete Club"}
        message={
          deleteTarget?.type === "admin"
            ? `Are you sure you want to remove ${formatName(deleteTarget.name)} as a club admin?`
            : `Are you sure you want to delete "${club.name}"? Leagues and tournaments will be unlinked but not deleted.`
        }
        onConfirm={deleteTarget?.type === "admin" ? confirmRemoveAdmin : handleDeleteClub}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
