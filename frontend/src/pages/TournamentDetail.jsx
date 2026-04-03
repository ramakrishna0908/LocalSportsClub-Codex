import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Badge from "../components/Badge";
import BracketView from "../components/BracketView";

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
  in_progress: "amber",
  completed: "green",
};

const statusLabels = {
  upcoming: "Upcoming",
  registration: "Registration Open",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function TournamentDetail() {
  const { id } = useParams();
  const { player } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [recordingMatch, setRecordingMatch] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [matchScore, setMatchScore] = useState("");
  const [allPlayers, setAllPlayers] = useState([]);
  const [directorToAdd, setDirectorToAdd] = useState("");

  const fetchTournament = () => {
    setLoading(true);
    api
      .get(`/tournaments/${id}`)
      .then((res) => setTournament(res.data.tournament))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTournament();
  }, [id]);

  useEffect(() => {
    if (player?.role === "admin" || player?.role === "director") {
      api.get("/players").then((res) => setAllPlayers(res.data.players)).catch(() => {});
    }
  }, [player?.role]);

  const handleAddDirector = async () => {
    if (!directorToAdd) return;
    setActionMsg(null);
    try {
      await api.post(`/tournaments/${id}/directors`, { playerId: parseInt(directorToAdd) });
      setDirectorToAdd("");
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to add director");
    }
  };

  const handleRegister = async () => {
    try {
      await api.post(`/tournaments/${id}/register`);
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to register");
    }
  };

  const handleUnregister = async () => {
    try {
      await api.post(`/tournaments/${id}/unregister`);
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to unregister");
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/tournaments/${id}/status`, { status: newStatus });
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleGenerateBracket = async () => {
    try {
      await api.post(`/tournaments/${id}/generate-bracket`);
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to generate bracket");
    }
  };

  const handleRecordMatch = async () => {
    if (!selectedWinner || !recordingMatch) return;
    try {
      await api.post(`/tournaments/${id}/record-match`, {
        round: recordingMatch.round,
        position: recordingMatch.position,
        winnerId: parseInt(selectedWinner),
        score: matchScore || undefined,
      });
      setRecordingMatch(null);
      setSelectedWinner("");
      setMatchScore("");
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to record match");
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>;
  }

  if (!tournament) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Tournament not found</p>;
  }

  const canManage = tournament.canManage;
  const pendingMatches = tournament.bracket.filter(
    (s) => s.player1Id && s.player2Id && !s.winnerId
  );

  const finalMatch = tournament.bracket.length > 0
    ? tournament.bracket.reduce((a, b) => (a.round > b.round ? a : b))
    : null;
  const champion = finalMatch?.winnerId ? finalMatch : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-display text-2xl text-surface-900">{tournament.name}</h2>
          <Badge color={statusColors[tournament.status]}>
            {statusLabels[tournament.status]}
          </Badge>
        </div>
        {tournament.description && (
          <p className="font-body text-sm text-surface-500 mb-2">{tournament.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge color={tournament.matchType === "singles" ? "blue" : "amber"}>
            {tournament.matchType === "singles" ? "Singles" : "Doubles"}
          </Badge>
          <span className="font-mono text-[11px] text-surface-400">
            {formatDate(tournament.tournamentDate)}
          </span>
          {tournament.maxPlayers && (
            <span className="font-mono text-[11px] text-surface-400">
              Max {tournament.maxPlayers} players
            </span>
          )}
          <span className="font-mono text-[11px] text-surface-400">
            Created by {formatName(tournament.createdByName)}
          </span>
        </div>
        {/* Directors */}
        {tournament.directors && tournament.directors.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono text-[10px] text-surface-400 uppercase tracking-widest">
              Directors:
            </span>
            {tournament.directors.map((d) => (
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

      {/* Champion banner */}
      {champion && (
        <div className="bg-brand-900/30 border border-brand-700 rounded-xl p-4 mb-6 text-center">
          <span className="text-2xl">&#127942;</span>
          <p className="font-display text-lg text-brand-300 mt-1">
            Champion: {formatName(champion.winnerName)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {!tournament.isRegistered && tournament.status === "registration" && (
          <button
            onClick={handleRegister}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            Register
          </button>
        )}
        {tournament.isRegistered && tournament.status === "registration" && (
          <button
            onClick={handleUnregister}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500 hover:text-surface-700"
          >
            Unregister
          </button>
        )}
        {canManage && tournament.status === "upcoming" && (
          <button
            onClick={() => handleStatusChange("registration")}
            className="px-4 py-2 rounded-lg bg-blue-950 border border-blue-800 font-body text-xs text-blue-400"
          >
            Open Registration
          </button>
        )}
        {canManage && tournament.status === "registration" && (
          <button
            onClick={handleGenerateBracket}
            className="px-4 py-2 rounded-lg bg-green-950 border border-green-800 font-body text-xs text-green-400"
          >
            Generate Bracket & Start
          </button>
        )}
      </div>

      {actionMsg && (
        <p className="text-red-400 font-body text-sm mb-4">{actionMsg}</p>
      )}

      {/* Manage Directors (admin/director only) */}
      {canManage && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            Manage Directors
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tournament.directors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/30 border border-blue-800"
              >
                <span className="text-blue-400 text-[12px] font-body">
                  {formatName(d.displayName)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={directorToAdd}
              onChange={(e) => setDirectorToAdd(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 text-surface-800 font-body text-sm"
            >
              <option value="">Add a director...</option>
              {allPlayers
                .filter((p) => ['admin', 'director'].includes(p.role))
                .filter((p) => !tournament.directors.some((d) => d.id === p.id))
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
        </div>
      )}

      {/* Bracket */}
      {tournament.bracket.length > 0 && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Bracket</h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6 overflow-hidden">
            <BracketView bracket={tournament.bracket} />
          </div>
        </>
      )}

      {/* Pending matches to record (director/admin only) */}
      {canManage && tournament.status === "in_progress" && pendingMatches.length > 0 && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Record Match Results</h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
            <div className="flex flex-col gap-2">
              {pendingMatches.map((slot) => (
                <div key={slot.id} className="flex items-center gap-3 py-2 border-b border-surface-200/40">
                  <span className="font-mono text-[10px] text-surface-400">
                    R{slot.round}-M{slot.position}
                  </span>
                  <span className="font-body text-[13px] text-surface-700 flex-1">
                    {formatName(slot.player1Name)} vs {formatName(slot.player2Name)}
                  </span>
                  {recordingMatch?.id === slot.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedWinner}
                        onChange={(e) => setSelectedWinner(e.target.value)}
                        className="bg-surface-50 border border-surface-200 rounded px-2 py-1 text-surface-800 font-body text-xs"
                      >
                        <option value="">Winner...</option>
                        <option value={slot.player1Id}>{formatName(slot.player1Name)}</option>
                        <option value={slot.player2Id}>{formatName(slot.player2Name)}</option>
                      </select>
                      <input
                        value={matchScore}
                        onChange={(e) => setMatchScore(e.target.value)}
                        placeholder="Score"
                        className="w-20 bg-surface-50 border border-surface-200 rounded px-2 py-1 text-surface-800 font-body text-xs"
                      />
                      <button
                        onClick={handleRecordMatch}
                        className="px-3 py-1 rounded bg-green-950 border border-green-800 text-green-400 font-mono text-[11px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setRecordingMatch(null); setSelectedWinner(""); setMatchScore(""); }}
                        className="px-2 py-1 text-surface-400 font-mono text-[11px]"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRecordingMatch(slot)}
                      className="px-3 py-1 rounded bg-surface-200 border border-surface-300 text-surface-600 font-mono text-[11px]"
                    >
                      Record
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Registered players */}
      <h3 className="font-display text-lg text-surface-900 mb-3">
        Players ({tournament.players.length})
      </h3>
      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        {tournament.players.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-4 italic">
            No players registered yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tournament.players.map((p) => (
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
                {p.seed && (
                  <span className="font-mono text-[10px] text-surface-400">
                    #{p.seed}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
