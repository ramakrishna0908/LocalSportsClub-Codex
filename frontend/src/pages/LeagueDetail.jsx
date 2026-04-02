import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Badge from "../components/Badge";
import StandingsTable from "../components/StandingsTable";

const statusColors = {
  upcoming: "slate",
  active: "green",
  completed: "slate",
};

export default function LeagueDetail() {
  const { id } = useParams();
  const { player } = useAuth();
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);

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

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>;
  }

  if (!league) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">League not found</p>;
  }

  const isCreator = league.createdBy === player.id;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-display text-2xl text-surface-900">{league.name}</h2>
          <Badge color={statusColors[league.status]}>{league.status}</Badge>
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
          </span>
          <span className="font-mono text-[11px] text-surface-400">
            Created by {league.createdByName}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {!league.isMember && league.status !== "completed" && (
          <button
            onClick={handleJoin}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            Join League
          </button>
        )}
        {league.isMember && league.status !== "completed" && (
          <button
            onClick={handleLeave}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500 hover:text-surface-700"
          >
            Leave League
          </button>
        )}
        {isCreator && league.status === "upcoming" && (
          <button
            onClick={() => handleStatusChange("active")}
            className="px-4 py-2 rounded-lg bg-green-950 border border-green-800 font-body text-xs text-green-400"
          >
            Start League
          </button>
        )}
        {isCreator && league.status === "active" && (
          <button
            onClick={() => handleStatusChange("completed")}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500"
          >
            End League
          </button>
        )}
      </div>

      {actionMsg && (
        <p className="text-red-400 font-body text-sm mb-4">{actionMsg}</p>
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
                  {p.displayName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
