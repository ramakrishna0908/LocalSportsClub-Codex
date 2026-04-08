import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { player } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [recordingMatch, setRecordingMatch] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState("");
  const [matchScore, setMatchScore] = useState("");
  const [allPlayers, setAllPlayers] = useState([]);
  const [directorToAdd, setDirectorToAdd] = useState("");

  // Team creation state
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", playerIds: [] });
  const [teamMsg, setTeamMsg] = useState(null);

  // Date editing state (admin only)
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState("");

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

  const handleUpdateDate = async () => {
    setActionMsg(null);
    try {
      await api.patch(`/tournaments/${id}`, { tournamentDate: newDate });
      setEditingDate(false);
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to update date");
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
    if (!recordingMatch) return;
    const isTeam = tournament.tournamentType === "team";

    if (isTeam && !selectedWinner) return;
    if (!isTeam && !selectedWinner) return;

    try {
      const body = {
        round: recordingMatch.round,
        position: recordingMatch.position,
        score: matchScore || undefined,
      };
      if (isTeam) {
        body.winnerTeamId = parseInt(selectedWinner);
      } else {
        body.winnerId = parseInt(selectedWinner);
      }

      await api.post(`/tournaments/${id}/record-match`, body);
      setRecordingMatch(null);
      setSelectedWinner("");
      setMatchScore("");
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to record match");
    }
  };

  const handleCreateTeam = async () => {
    setTeamMsg(null);
    if (!teamForm.name) {
      setTeamMsg("Team name is required");
      return;
    }
    try {
      await api.post(`/tournaments/${id}/teams`, {
        name: teamForm.name,
        playerIds: teamForm.playerIds.map(Number),
      });
      setTeamForm({ name: "", playerIds: [] });
      setShowTeamForm(false);
      fetchTournament();
    } catch (err) {
      setTeamMsg(err.response?.data?.error || "Failed to create team");
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await api.delete(`/tournaments/${id}/teams/${teamId}`);
      fetchTournament();
    } catch (err) {
      setActionMsg(err.response?.data?.error || "Failed to delete team");
    }
  };

  const toggleTeamPlayer = (playerId) => {
    setTeamForm((prev) => ({
      ...prev,
      playerIds: prev.playerIds.includes(playerId)
        ? prev.playerIds.filter((id) => id !== playerId)
        : [...prev.playerIds, playerId],
    }));
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (loading) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>;
  }

  if (!tournament) {
    return <p className="text-center text-surface-400 font-body text-sm py-8">Tournament not found</p>;
  }

  const isTeam = tournament.tournamentType === "team";
  const isRoundRobin = tournament.format === "round_robin";
  const canManage = tournament.canManage;

  const pendingMatches = isTeam
    ? tournament.bracket.filter((s) => s.team1Id && s.team2Id && !s.winnerTeamId)
    : tournament.bracket.filter((s) => s.player1Id && s.player2Id && !s.winnerId);

  // Champion determination
  let champion = null;
  if (isTeam && isRoundRobin) {
    // For round-robin, champion is top of standings when completed
    if (tournament.status === "completed" && tournament.standings?.length > 0) {
      champion = { name: tournament.standings[0].teamName, isTeam: true };
    }
  } else if (isTeam) {
    const finalMatch = tournament.bracket.length > 0
      ? tournament.bracket.reduce((a, b) => (a.round > b.round ? a : b))
      : null;
    if (finalMatch?.winnerTeamId) {
      champion = { name: finalMatch.winnerTeamName, isTeam: true };
    }
  } else {
    const finalMatch = tournament.bracket.length > 0
      ? tournament.bracket.reduce((a, b) => (a.round > b.round ? a : b))
      : null;
    if (finalMatch?.winnerId) {
      champion = { name: formatName(finalMatch.winnerName), isTeam: false };
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-surface-900">{tournament.name}</h2>
            {isTeam && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-purple-950/40 border border-purple-800/50 text-purple-400">
                TEAM
              </span>
            )}
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-surface-200/60 border border-surface-300/50 text-surface-500">
              {isRoundRobin ? "ROUND ROBIN" : "KNOCKOUT"}
            </span>
          </div>
          <Badge color={statusColors[tournament.status]}>
            {statusLabels[tournament.status]}
          </Badge>
        </div>
        {tournament.description && (
          <p className="font-body text-sm text-surface-500 mb-2">{tournament.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge color={tournament.matchType === "singles" ? "blue" : tournament.matchType === "both" ? "green" : "amber"}>
            {tournament.matchType === "singles" ? "Singles" : tournament.matchType === "both" ? "Singles & Doubles" : "Doubles"}
          </Badge>
          <span className="font-mono text-[11px] text-surface-400">
            {formatDate(tournament.tournamentDate)}
            {canManage && !editingDate && (
              <button
                onClick={() => {
                  setNewDate(new Date(tournament.tournamentDate).toISOString().split("T")[0]);
                  setEditingDate(true);
                }}
                className="ml-2 text-[10px] text-surface-400 hover:text-brand-300 transition-colors"
                title="Edit date"
              >
                [edit]
              </button>
            )}
          </span>
          {editingDate && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-surface-50 border border-surface-200 rounded-lg px-2 py-1 text-surface-800 font-mono text-[11px]"
              />
              <button
                onClick={handleUpdateDate}
                className="px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-400 text-[10px] font-mono"
              >
                Save
              </button>
              <button
                onClick={() => setEditingDate(false)}
                className="px-2 py-0.5 rounded bg-surface-50 border border-surface-200 text-surface-400 text-[10px] font-mono"
              >
                Cancel
              </button>
            </div>
          )}
          {tournament.maxPlayers && (
            <span className="font-mono text-[11px] text-surface-400">
              Max {tournament.maxPlayers} {isTeam ? "teams" : "players"}
            </span>
          )}
          <span className="font-mono text-[11px] text-surface-400">
            Created by {formatName(tournament.createdByName)}
          </span>
          {tournament.clubName && (
            <button
              onClick={() => navigate(`/clubs/${tournament.clubId}`)}
              className="inline-block px-2 py-0.5 rounded-md bg-surface-200/60 border border-surface-300/50 text-[11px] font-mono text-surface-500 hover:text-brand-300 transition-colors"
            >
              {tournament.clubName}
            </button>
          )}
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
          <span className="text-2xl">{"\u{1F3C6}"}</span>
          <p className="font-display text-lg text-brand-300 mt-1">
            Champion: {champion.name}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {!isTeam && !tournament.isRegistered && tournament.status === "registration" && (
          <button
            onClick={handleRegister}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            Register
          </button>
        )}
        {!isTeam && tournament.isRegistered && tournament.status === "registration" && (
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
            {isRoundRobin ? "Generate Fixtures & Start" : "Generate Bracket & Start"}
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

      {/* Teams section (team tournaments only) */}
      {isTeam && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">
            Teams ({tournament.teams?.length || 0})
          </h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
            {tournament.teams?.length === 0 ? (
              <p className="text-center text-surface-400 font-body text-sm py-4 italic">
                No teams created yet
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {tournament.teams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-surface-50/50 border border-surface-200/50 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-md bg-purple-950/40 border border-purple-800/40 flex items-center justify-center font-display font-bold text-xs text-purple-400">
                          {team.name[0]}
                        </span>
                        <span className="font-display text-sm text-surface-900">{team.name}</span>
                        {team.seed && (
                          <span className="font-mono text-[10px] text-surface-400">#{team.seed}</span>
                        )}
                      </div>
                      {canManage && tournament.status !== "in_progress" && tournament.status !== "completed" && (
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-red-400 hover:text-red-300 text-[11px] font-mono"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {team.players.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-100 border border-surface-200 text-[11px] font-body text-surface-600"
                        >
                          <span className="w-4 h-4 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[7px] text-brand-300">
                            {p.displayName[0]}
                          </span>
                          {p.displayName}
                        </span>
                      ))}
                      {team.players.length === 0 && (
                        <span className="text-surface-400 text-[11px] italic">No players assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create team form */}
            {canManage && (tournament.status === "upcoming" || tournament.status === "registration") && (
              <div className="mt-4">
                {!showTeamForm ? (
                  <button
                    onClick={() => setShowTeamForm(true)}
                    className="px-4 py-2 rounded-lg bg-purple-950/40 border border-purple-800/50 font-body text-xs text-purple-400 hover:bg-purple-950/60"
                  >
                    + Add Team
                  </button>
                ) : (
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 space-y-3">
                    <input
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      placeholder="Team name"
                      className="w-full bg-surface-100 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                    />
                    <div>
                      <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-2">
                        Select Players
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                        {allPlayers.map((p) => {
                          const selected = teamForm.playerIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggleTeamPlayer(p.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-body transition-all border
                                ${selected
                                  ? "bg-purple-950/40 border-purple-800 text-purple-400"
                                  : "bg-surface-100 border-surface-200 text-surface-600 hover:border-surface-300"
                                }`}
                            >
                              {p.display_name}
                              {selected && <span className="text-[9px]">{"\u2713"}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateTeam}
                        className="px-4 py-2 rounded-lg bg-purple-950 border border-purple-800 font-body text-xs text-purple-400"
                      >
                        Create Team
                      </button>
                      <button
                        onClick={() => { setShowTeamForm(false); setTeamForm({ name: "", playerIds: [] }); setTeamMsg(null); }}
                        className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-200 font-body text-xs text-surface-500"
                      >
                        Cancel
                      </button>
                    </div>
                    {teamMsg && <p className="text-red-400 font-body text-xs">{teamMsg}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Round-Robin Standings */}
      {isTeam && isRoundRobin && tournament.standings?.length > 0 && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Standings</h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">#</th>
                  <th className="text-left py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">Team</th>
                  <th className="text-center py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">P</th>
                  <th className="text-center py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">W</th>
                  <th className="text-center py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">L</th>
                  <th className="text-center py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">D</th>
                  <th className="text-center py-2 px-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest">Pts</th>
                </tr>
              </thead>
              <tbody>
                {tournament.standings.map((s, i) => (
                  <tr key={s.teamId} className={`border-b border-surface-200/30 ${i === 0 ? "bg-brand-900/10" : ""}`}>
                    <td className="py-2 px-2 font-mono text-xs text-surface-500">{i + 1}</td>
                    <td className="py-2 px-2 font-body text-sm text-surface-800 font-semibold">{s.teamName}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-surface-600">{s.played}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-green-400">{s.won}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-red-400">{s.lost}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-surface-500">{s.drawn}</td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-brand-300 font-bold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Bracket / Fixtures */}
      {tournament.bracket.length > 0 && !isRoundRobin && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Bracket</h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6 overflow-hidden">
            <BracketView bracket={tournament.bracket} isTeam={isTeam} />
          </div>
        </>
      )}

      {/* Round-robin fixtures list */}
      {tournament.bracket.length > 0 && isRoundRobin && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">
            Fixtures ({tournament.bracket.length})
          </h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
            <div className="flex flex-col gap-2">
              {tournament.bracket.map((slot) => {
                const isDone = isTeam ? !!slot.winnerTeamId : !!slot.winnerId;
                const name1 = isTeam ? slot.team1Name : formatName(slot.player1Name);
                const name2 = isTeam ? slot.team2Name : formatName(slot.player2Name);
                const winnerName = isTeam ? slot.winnerTeamName : formatName(slot.winnerName);

                return (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border
                      ${isDone ? "border-surface-200/30 bg-surface-50/30" : "border-surface-200/50"}`}
                  >
                    <span className="font-mono text-[10px] text-surface-400 w-8 shrink-0">
                      M{slot.position}
                    </span>
                    <span className={`font-body text-[13px] flex-1 ${isDone ? "text-surface-500" : "text-surface-700"}`}>
                      {name1 || "TBD"} <span className="text-surface-400 mx-1">vs</span> {name2 || "TBD"}
                    </span>
                    {isDone && (
                      <span className="font-mono text-[11px] text-green-400 shrink-0">
                        {"\u2713"} {winnerName}
                      </span>
                    )}
                    {!isDone && (
                      <span className="font-mono text-[10px] text-surface-400 shrink-0">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Pending matches to record (director/admin only) */}
      {canManage && tournament.status === "in_progress" && pendingMatches.length > 0 && (
        <>
          <h3 className="font-display text-lg text-surface-900 mb-3">Record Match Results</h3>
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-6">
            <div className="flex flex-col gap-2">
              {pendingMatches.map((slot) => {
                const name1 = isTeam ? slot.team1Name : formatName(slot.player1Name);
                const name2 = isTeam ? slot.team2Name : formatName(slot.player2Name);
                const id1 = isTeam ? slot.team1Id : slot.player1Id;
                const id2 = isTeam ? slot.team2Id : slot.player2Id;

                return (
                  <div key={slot.id} className="flex items-center gap-3 py-2 border-b border-surface-200/40">
                    <span className="font-mono text-[10px] text-surface-400">
                      {isRoundRobin ? `M${slot.position}` : `R${slot.round}-M${slot.position}`}
                    </span>
                    <span className="font-body text-[13px] text-surface-700 flex-1">
                      {name1} vs {name2}
                    </span>
                    {recordingMatch?.id === slot.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedWinner}
                          onChange={(e) => setSelectedWinner(e.target.value)}
                          className="bg-surface-50 border border-surface-200 rounded px-2 py-1 text-surface-800 font-body text-xs"
                        >
                          <option value="">Winner...</option>
                          <option value={id1}>{name1}</option>
                          <option value={id2}>{name2}</option>
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
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Registered players (individual tournaments) */}
      {!isTeam && (
        <>
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
        </>
      )}
    </div>
  );
}
