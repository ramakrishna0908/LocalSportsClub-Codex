import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Badge from "../components/Badge";
import StandingsTable from "../components/StandingsTable";

function formatName(displayName) {
  if (!displayName) return "";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

const statusColors = {
  upcoming: "slate",
  registration: "blue",
  active: "green",
  completed: "slate",
};

export default function LeagueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [groupSize, setGroupSize] = useState(3);
  const [shuffling, setShuffling] = useState(false);
  const [allPlayers, setAllPlayers] = useState([]);
  const [directorToAdd, setDirectorToAdd] = useState("");
  const [shuffleMode, setShuffleMode] = useState("sequential");
  const [allowedMode, setAllowedMode] = useState("both");
  const [editingCloseDate, setEditingCloseDate] = useState(false);
  const [newCloseDate, setNewCloseDate] = useState("");
  const [editingDates, setEditingDates] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const fetchLeague = () => {
    setLoading(true);
    api
      .get(`/leagues/${id}`)
      .then((res) => setLeague(res.data.league))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeague();
  }, [id]);

  // Fetch all players for director assignment dropdown + settings
  useEffect(() => {
    if (player?.role === "admin" || player?.role === "director") {
      api.get("/players").then((res) => setAllPlayers(res.data.players)).catch(() => {});
    }
    api.get("/settings").then((res) => {
      const mode = res.data.settings?.group_shuffle_mode || "both";
      setAllowedMode(mode);
      setShuffleMode(mode === "both" ? "sequential" : mode);
    }).catch(() => {});
  }, [player?.role]);

  const handleJoin = async () => {
    try {
      await api.post(`/leagues/${id}/join`);
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to join");
    }
  };

  const handleLeave = async () => {
    try {
      await api.post(`/leagues/${id}/leave`);
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to leave");
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/leagues/${id}/status`, { status: newStatus });
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleShuffle = async () => {
    setShuffling(true);
    setActionMsg(null);
    try {
      await api.post(`/leagues/${id}/shuffle-groups`, { groupSize, mode: shuffleMode });
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to shuffle groups");
    } finally {
      setShuffling(false);
    }
  };

  const handleAddDirector = async () => {
    if (!directorToAdd) return;
    setActionMsg(null);
    try {
      await api.post(`/leagues/${id}/directors`, { playerId: parseInt(directorToAdd) });
      setDirectorToAdd("");
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to add director");
    }
  };

  const handleUpdateDates = async () => {
    setActionMsg(null);
    try {
      const payload = {};
      if (newStartDate) payload.startDate = newStartDate;
      if (newEndDate) payload.endDate = newEndDate;
      await api.patch(`/leagues/${id}`, payload);
      setEditingDates(false);
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update dates");
    }
  };

  const handleUpdateCloseDate = async () => {
    setActionMsg(null);
    try {
      await api.patch(`/leagues/${id}`, { registrationCloseDate: newCloseDate || null });
      setEditingCloseDate(false);
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update close date");
    }
  };

  const handleRemoveDirector = async (playerId) => {
    setActionMsg(null);
    try {
      await api.delete(`/leagues/${id}/directors/${playerId}`);
      fetchLeague();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to remove director");
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>;
  }

  if (!league) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">League not found</p>;
  }

  const canManage = league.canManage;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-display text-2xl text-surface-900">{league.name}</h2>
          <Badge color={statusColors[league.status]}>
            {league.status === "registration" ? "Registration Open" : league.status}
          </Badge>
        </div>
        {league.description && (
          <p className="font-body text-sm text-surface-500 mb-2">{league.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge color={league.matchType === "singles" ? "blue" : "amber"}>
            {league.matchType === "singles" ? "Singles" : "Doubles"}
          </Badge>
          <span className="font-mono text-[11px] text-surface-400">
            {formatDate(league.startDate)} - {formatDate(league.endDate)}
            {canManage && !editingDates && (
              <button
                onClick={() => {
                  setNewStartDate(new Date(league.startDate).toISOString().split("T")[0]);
                  setNewEndDate(new Date(league.endDate).toISOString().split("T")[0]);
                  setEditingDates(true);
                }}
                className="ml-2 text-[10px] text-surface-400 hover:text-brand-300 transition-colors"
                title="Edit dates"
              >
                [edit]
              </button>
            )}
          </span>
          {editingDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="bg-surface-50 border border-surface-200 rounded-lg px-2 py-1 text-surface-800 font-mono text-[11px]"
              />
              <span className="text-surface-400 text-[11px]">-</span>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="bg-surface-50 border border-surface-200 rounded-lg px-2 py-1 text-surface-800 font-mono text-[11px]"
              />
              <button
                onClick={handleUpdateDates}
                className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-400 text-[10px] font-mono"
              >
                Save
              </button>
              <button
                onClick={() => setEditingDates(false)}
                className="px-2 py-0.5 rounded bg-surface-50 border border-surface-200 text-surface-400 text-[10px] font-mono"
              >
                Cancel
              </button>
            </div>
          )}
          {league.registrationCloseDate && (
            <span className="font-mono text-[11px] text-blue-400">
              Reg. closes {formatDate(league.registrationCloseDate)}
            </span>
          )}
          <span className="font-mono text-[11px] text-surface-400">
            Created by {formatName(league.createdByName)}
          </span>
          {league.clubName && (
            <button
              onClick={() => navigate(`/clubs/${league.clubId}`)}
              className="inline-block px-2 py-0.5 rounded-md bg-surface-200/60 border border-surface-300/50 text-[11px] font-mono text-surface-500 hover:text-brand-300 transition-colors"
            >
              {league.clubName}
            </button>
          )}
        </div>
        {/* Directors */}
        {league.directors && league.directors.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-[10px] text-surface-400 uppercase tracking-widest">
              Directors:
            </span>
            {league.directors.map((d) => (
              <span
                key={d.id}
                className="inline-block px-2 py-0.5 rounded-md bg-blue-950/30 border border-blue-800 text-blue-400 text-[11px] font-mono"
              >
                {formatName(d.displayName)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {!league.isMember && ["upcoming", "registration"].includes(league.status) && (
          <button
            onClick={handleJoin}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            Join League
          </button>
        )}
        {league.isMember && ["upcoming", "registration"].includes(league.status) && (
          <button
            onClick={handleLeave}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500 hover:text-surface-700"
          >
            Leave League
          </button>
        )}
        {canManage && league.status === "upcoming" && (
          <button
            onClick={() => handleStatusChange("registration")}
            className="px-4 py-2 rounded-lg bg-blue-950 border border-blue-800 font-body text-xs text-blue-400"
          >
            Open Registration
          </button>
        )}
        {canManage && league.status === "registration" && (
          <button
            onClick={() => handleStatusChange("active")}
            className="px-4 py-2 rounded-lg bg-green-950 border border-green-800 font-body text-xs text-green-400"
          >
            Start League
          </button>
        )}
        {canManage && league.status === "active" && (
          <button
            onClick={() => handleStatusChange("completed")}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500"
          >
            End League
          </button>
        )}
      </div>

      {/* Registration Close Date (admin only, when registration or upcoming) */}
      {player?.role === "admin" && ["upcoming", "registration"].includes(league.status) && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            Registration Close Date
          </h3>
          {!editingCloseDate ? (
            <div className="flex items-center gap-3">
              <span className="font-body text-sm text-surface-700">
                {league.registrationCloseDate
                  ? formatDate(league.registrationCloseDate)
                  : "Not set"}
              </span>
              <button
                onClick={() => {
                  setNewCloseDate(league.registrationCloseDate ? new Date(league.registrationCloseDate).toISOString().split("T")[0] : "");
                  setEditingCloseDate(true);
                }}
                className="px-3 py-1 rounded-lg bg-surface-50 border border-surface-200 font-body text-xs text-surface-500 hover:text-surface-700"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={newCloseDate}
                onChange={(e) => setNewCloseDate(e.target.value)}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800 font-body text-sm"
              />
              <button
                onClick={handleUpdateCloseDate}
                className="px-3 py-1 rounded-lg bg-blue-950 border border-blue-800 font-body text-xs text-blue-400"
              >
                Save
              </button>
              <button
                onClick={() => setEditingCloseDate(false)}
                className="px-3 py-1 rounded-lg bg-surface-50 border border-surface-200 font-body text-xs text-surface-400"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {actionMsg && (
        <p className="text-red-400 font-body text-sm mb-4">{actionMsg}</p>
      )}

      {/* Manage Directors (admin/director only) */}
      {canManage && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            Manage Directors
          </h3>
          {/* Current directors with remove */}
          <div className="flex flex-wrap gap-2 mb-3">
            {league.directors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/30 border border-blue-800"
              >
                <span className="text-blue-400 text-[12px] font-body">
                  {formatName(d.displayName)}
                </span>
                <button
                  onClick={() => handleRemoveDirector(d.id)}
                  className="text-blue-600 hover:text-red-400 text-[11px] font-mono ml-1 transition-colors"
                  title="Remove director"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          {/* Add director dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={directorToAdd}
              onChange={(e) => setDirectorToAdd(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800 font-body text-sm"
            >
              <option value="">Add a director...</option>
              {allPlayers
                .filter((p) => ['admin', 'director'].includes(p.role))
                .filter((p) => !league.directors.some((d) => d.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatName(p.display_name)} (@{p.username})
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddDirector}
              disabled={!directorToAdd}
              className="px-4 py-1.5 rounded-lg bg-blue-950 border border-blue-800 font-body text-xs text-blue-400 disabled:opacity-30"
            >
              Add
            </button>
          </div>
          <p className="font-body text-[11px] text-surface-400 mt-2">
            Only users with admin or director role can be added as league directors.
          </p>
        </div>
      )}

      {/* Group Shuffle (director/admin only, when league has players) */}
      {canManage && league.players.length >= 2 && league.status !== "completed" && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            Shuffle Groups
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="font-body text-sm text-surface-600">
              Players per group:
            </label>
            <input
              type="number"
              min={2}
              max={league.players.length}
              value={groupSize}
              onChange={(e) => setGroupSize(parseInt(e.target.value) || 3)}
              className="w-16 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800 font-mono text-sm text-center"
            />
            {/* Mode selector */}
            {allowedMode === "both" ? (
              <div className="flex gap-1 bg-surface-50 rounded-lg p-0.5 border border-surface-200">
                <button
                  onClick={() => setShuffleMode("sequential")}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                    ${shuffleMode === "sequential" ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
                >
                  Tiered
                </button>
                <button
                  onClick={() => setShuffleMode("snake")}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                    ${shuffleMode === "snake" ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
                >
                  Balanced
                </button>
              </div>
            ) : (
              <span className="font-mono text-[11px] text-surface-400">
                Mode: {allowedMode === "sequential" ? "Tiered" : "Balanced"}
              </span>
            )}
            <button
              onClick={handleShuffle}
              disabled={shuffling}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900 disabled:opacity-50"
            >
              {shuffling ? "Shuffling..." : "Shuffle Groups"}
            </button>
          </div>
          <p className="font-body text-[11px] text-surface-400 mt-2">
            {shuffleMode === "sequential"
              ? "Tiered: Top ranked players in Group A, next tier in Group B, etc."
              : "Balanced: Players spread across groups via snake draft for competitive balance."}
          </p>
        </div>
      )}

      {/* Groups */}
      {league.groups && league.groups.length > 0 && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Groups</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {league.groups.map((g) => (
              <div
                key={g.id}
                className="bg-surface-100/70 border border-surface-200 rounded-xl p-4"
              >
                <h4 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
                  {g.name}
                </h4>
                <div className="flex flex-col gap-2">
                  {g.players.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <span className="font-mono text-[10px] text-surface-400 w-4">
                        {idx + 1}
                      </span>
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[10px] text-brand-300">
                        {p.displayName[0].toUpperCase()}
                      </span>
                      <span className="font-body text-[13px] text-surface-700 flex-1">
                        {formatName(p.displayName)}
                      </span>
                      <span className="font-mono text-[10px] text-surface-400">
                        {p.singlesElo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Standings */}
      <h3 className="font-display text-lg text-surface-900 mb-3">Standings</h3>
      <StandingsTable standings={league.standings} loading={false} />

      {/* Players */}
      <h3 className="font-display text-lg text-surface-900 mt-6 mb-3">
        Players ({league.players.length})
      </h3>
      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        {league.players.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-4 italic">
            No players yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {league.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-surface-50 rounded-lg px-3 py-2 border border-surface-200"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[10px] text-brand-300">
                  {p.displayName[0].toUpperCase()}
                </span>
                <span className="font-body text-[13px] text-surface-700">
                  {formatName(p.displayName)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
