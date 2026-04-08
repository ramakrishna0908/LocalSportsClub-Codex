import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";

export default function RecordMatch() {
  const { player, refreshPlayer } = useAuth();
  const { sport, sportEmoji, SPORTS } = useSport();
  const [type, setType] = useState("singles");
  const [allPlayers, setAllPlayers] = useState([]);
  // Player mode (self reporting)
  const [opponent, setOpponent] = useState("");
  const [partner, setPartner] = useState("");
  const [opp1, setOpp1] = useState("");
  const [opp2, setOpp2] = useState("");
  const [won, setWon] = useState(true);
  // Director mode (admin/director picks both sides)
  const [directorMode, setDirectorMode] = useState(false);
  const [winner1, setWinner1] = useState("");
  const [winner2, setWinner2] = useState("");
  const [loser1, setLoser1] = useState("");
  const [loser2, setLoser2] = useState("");

  const [score, setScore] = useState("");
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState("");

  // Tournament / team selection
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedTournamentData, setSelectedTournamentData] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedOpponentTeam, setSelectedOpponentTeam] = useState("");

  // Add player modal
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerUsername, setNewPlayerUsername] = useState("");
  const [newPlayerSports, setNewPlayerSports] = useState([]);
  const [newPlayerRatings, setNewPlayerRatings] = useState({});
  const [addPlayerMsg, setAddPlayerMsg] = useState(null);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Current user's sports
  const mySports = player.sports || [];
  const mySportsData = SPORTS.filter((s) => mySports.includes(s.key));

  // Reset add-player sport selection when sport context changes
  useEffect(() => {
    setNewPlayerSports([sport]);
  }, [sport]);

  // Recent matches for admin/director editing
  const [recentMatches, setRecentMatches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editScore, setEditScore] = useState("");
  const [editSwap, setEditSwap] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const canDirector = player.role === "admin" || player.role === "director";

  const loadPlayers = () => {
    api
      .get("/players", { params: { sport } })
      .then((res) => setAllPlayers(res.data.players))
      .catch(console.error);
  };

  useEffect(() => {
    loadPlayers();
  }, [sport]);

  // Load active leagues
  useEffect(() => {
    api
      .get("/leagues", { params: { status: "active", sport } })
      .then((res) => setLeagues(res.data.leagues.filter((l) => l.matchType === type)))
      .catch(console.error);
    setSelectedLeague("");
  }, [type, sport]);

  // Load in-progress tournaments
  useEffect(() => {
    api
      .get("/tournaments", { params: { status: "in_progress", sport } })
      .then((res) => setTournaments(res.data.tournaments))
      .catch(console.error);
    setSelectedTournament("");
    setSelectedTournamentData(null);
    setSelectedTeam("");
    setSelectedOpponentTeam("");
  }, [sport]);

  // Load tournament detail when one is selected
  useEffect(() => {
    if (!selectedTournament) {
      setSelectedTournamentData(null);
      setSelectedTeam("");
      setSelectedOpponentTeam("");
      return;
    }
    api
      .get(`/tournaments/${selectedTournament}`)
      .then((res) => setSelectedTournamentData(res.data.tournament))
      .catch(console.error);
  }, [selectedTournament]);

  // Load recent matches for admin/director
  useEffect(() => {
    if (canDirector && showRecent) {
      api
        .get("/matches", { params: { sport, limit: 20 } })
        .then((res) => setRecentMatches(res.data.matches))
        .catch(console.error);
    }
  }, [showRecent, sport]);

  // Players list excluding self (for player mode)
  const otherPlayers = allPlayers.filter((p) => p.id !== player.id);

  const resetForm = () => {
    setOpponent(""); setPartner(""); setOpp1(""); setOpp2("");
    setWinner1(""); setWinner2(""); setLoser1(""); setLoser2("");
    setScore(""); setSelectedLeague("");
    setSelectedTournament(""); setSelectedTournamentData(null);
    setSelectedTeam(""); setSelectedOpponentTeam("");
  };

  const submit = async () => {
    setMsg(null);
    setSubmitting(true);

    try {
      let body;

      if (directorMode) {
        // Director mode — pick winner(s) and loser(s)
        if (type === "singles") {
          if (!winner1 || !loser1) throw new Error("Select both players");
          if (winner1 === loser1) throw new Error("Winner and loser must be different");
          body = {
            matchType: "singles",
            sport,
            winners: [parseInt(winner1)],
            losers: [parseInt(loser1)],
            score: score || undefined,
            leagueId: selectedLeague ? parseInt(selectedLeague) : undefined,
            tournamentId: selectedTournament ? parseInt(selectedTournament) : undefined,
            teamId: selectedTeam ? parseInt(selectedTeam) : undefined,
            opponentTeamId: selectedOpponentTeam ? parseInt(selectedOpponentTeam) : undefined,
          };
        } else {
          if (!winner1 || !winner2 || !loser1 || !loser2)
            throw new Error("Select all 4 players");
          const ids = new Set([winner1, winner2, loser1, loser2].map(Number));
          if (ids.size !== 4) throw new Error("All 4 players must be different");
          body = {
            matchType: "doubles",
            sport,
            winners: [parseInt(winner1), parseInt(winner2)],
            losers: [parseInt(loser1), parseInt(loser2)],
            score: score || undefined,
            leagueId: selectedLeague ? parseInt(selectedLeague) : undefined,
            tournamentId: selectedTournament ? parseInt(selectedTournament) : undefined,
            teamId: selectedTeam ? parseInt(selectedTeam) : undefined,
            opponentTeamId: selectedOpponentTeam ? parseInt(selectedOpponentTeam) : undefined,
          };
        }
      } else {
        // Player mode — self is part of the match
        if (type === "singles") {
          if (!opponent) throw new Error("Select an opponent");
          body = {
            matchType: "singles",
            sport,
            winners: won ? [player.id] : [parseInt(opponent)],
            losers: won ? [parseInt(opponent)] : [player.id],
            score: score || undefined,
            leagueId: selectedLeague ? parseInt(selectedLeague) : undefined,
            tournamentId: selectedTournament ? parseInt(selectedTournament) : undefined,
            teamId: selectedTeam ? parseInt(selectedTeam) : undefined,
            opponentTeamId: selectedOpponentTeam ? parseInt(selectedOpponentTeam) : undefined,
          };
        } else {
          if (!partner || !opp1 || !opp2) throw new Error("Select all players");
          const ids = new Set([player.id, parseInt(partner), parseInt(opp1), parseInt(opp2)]);
          if (ids.size !== 4) throw new Error("All 4 players must be different");
          body = {
            matchType: "doubles",
            sport,
            winners: won
              ? [player.id, parseInt(partner)]
              : [parseInt(opp1), parseInt(opp2)],
            losers: won
              ? [parseInt(opp1), parseInt(opp2)]
              : [player.id, parseInt(partner)],
            score: score || undefined,
            leagueId: selectedLeague ? parseInt(selectedLeague) : undefined,
            tournamentId: selectedTournament ? parseInt(selectedTournament) : undefined,
            teamId: selectedTeam ? parseInt(selectedTeam) : undefined,
            opponentTeamId: selectedOpponentTeam ? parseInt(selectedOpponentTeam) : undefined,
          };
        }
      }

      await api.post("/matches", body);
      await refreshPlayer();
      setMsg({ text: "Match recorded!", ok: true });
      resetForm();
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({
        text: err.response?.data?.error || err.message,
        ok: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPlayer = async () => {
    setAddPlayerMsg(null);
    if (!newPlayerName.trim()) {
      return setAddPlayerMsg({ text: "Enter a display name", ok: false });
    }
    if (newPlayerSports.length === 0) {
      return setAddPlayerMsg({ text: "Select at least one sport", ok: false });
    }
    setAddingPlayer(true);
    try {
      const res = await api.post("/players/quick-add", {
        displayName: newPlayerName.trim(),
        username: newPlayerUsername.trim() || undefined,
        sports: newPlayerSports,
        initialRatings: newPlayerRatings,
      });
      setAddPlayerMsg({ text: res.data.message, ok: true });
      setNewPlayerName("");
      setNewPlayerUsername("");
      setNewPlayerSports([sport]);
      setNewPlayerRatings({});
      loadPlayers();
      setTimeout(() => {
        setShowAddPlayer(false);
        setAddPlayerMsg(null);
      }, 3000);
    } catch (err) {
      setAddPlayerMsg({
        text: err.response?.data?.error || "Failed to add player",
        ok: false,
      });
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!confirm("Delete this match and reverse rating changes?")) return;
    setDeletingId(matchId);
    try {
      await api.delete(`/matches/${matchId}`);
      setRecentMatches((prev) => prev.filter((m) => m.id !== matchId));
      setMsg({ text: "Match deleted & ratings reversed!", ok: true });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({
        text: err.response?.data?.error || "Failed to delete match",
        ok: false,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const startEditMatch = (m) => {
    setEditingMatch(m.id);
    setEditScore(m.score || "");
    setEditSwap(false);
  };

  const handleEditMatch = async (matchId) => {
    setEditSaving(true);
    try {
      const body = {};
      if (editScore !== (recentMatches.find(m => m.id === matchId)?.score || "")) {
        body.score = editScore;
      }
      if (editSwap) {
        body.swapResult = true;
      }
      if (!body.score && body.score !== "" && !body.swapResult) {
        setEditingMatch(null);
        return;
      }
      const res = await api.patch(`/matches/${matchId}`, body);
      setRecentMatches((prev) =>
        prev.map((m) => (m.id === matchId ? res.data.match : m))
      );
      setEditingMatch(null);
      setMsg({ text: editSwap ? "Result swapped & ratings recalculated!" : "Match updated!", ok: true });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg({
        text: err.response?.data?.error || "Failed to update match",
        ok: false,
      });
    } finally {
      setEditSaving(false);
    }
  };

  const toggleNewPlayerSport = (key) => {
    setNewPlayerSports((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  // Determine if selected tournament is a team tournament
  const isTeamTournament = selectedTournamentData?.tournamentType === "team";
  const tournamentTeams = selectedTournamentData?.teams || [];

  const SelectField = ({ label, value, onChange, placeholder, playerList }) => (
    <div className="mb-3.5">
      <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
      >
        <option value="">{placeholder || "Select player..."}</option>
        {(playerList || otherPlayers).map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
      </select>
    </div>
  );

  const formatMatchPlayers = (match) => {
    const winners = (match.players || []).filter((p) => p.team === "winner");
    const losers = (match.players || []).filter((p) => p.team === "loser");
    const wNames = winners.map((p) => p.display_name).join(" & ");
    const lNames = losers.map((p) => p.display_name).join(" & ");
    return { wNames, lNames };
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-2xl text-surface-900">
          Record Match Result
        </h2>
        <button
          onClick={() => { setShowAddPlayer(!showAddPlayer); setAddPlayerMsg(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-200 hover:bg-surface-200/60 transition-all font-body text-xs text-surface-600 hover:text-surface-800"
        >
          <span className="text-sm">{"\u2795"}</span>
          <span>Add Player</span>
        </button>
      </div>

      {/* Add Player Form */}
      {showAddPlayer && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            Add New Player
          </h3>
          <p className="font-body text-xs text-surface-500 mb-3">
            Quick-add a player who hasn't registered yet. Default password: <span className="text-surface-800 font-semibold">Welcome1</span>
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Display Name
              </label>
              <input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Username (login ID)
              </label>
              <input
                value={newPlayerUsername}
                onChange={(e) => setNewPlayerUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="e.g. johnsmith"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
              Sports
            </label>
            <div className="flex gap-2">
              {mySportsData.map((s) => (
                <button
                  key={s.key}
                  onClick={() => toggleNewPlayerSport(s.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 font-body text-xs border transition-all
                    ${newPlayerSports.includes(s.key)
                      ? "bg-surface-200 border-surface-300 text-surface-800"
                      : "bg-surface-50/50 border-surface-200 text-surface-500"
                    }`}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Initial Rating per selected sport */}
          {newPlayerSports.length > 0 && (
            <div className="mb-3">
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Initial Rating (optional)
              </label>
              <div className="space-y-2">
                {newPlayerSports.map((sKey) => {
                  const sData = SPORTS.find((s) => s.key === sKey);
                  const isUtr = sData?.ratingSystem === "utr";
                  return (
                    <div key={sKey} className="flex items-center gap-2">
                      <span className="text-sm w-5 text-center">{sData?.emoji}</span>
                      <span className="font-body text-xs text-surface-600 w-20">{sData?.label}</span>
                      <input
                        type="number"
                        step={isUtr ? "0.01" : "1"}
                        min={isUtr ? "1" : "100"}
                        max={isUtr ? "16.5" : "3000"}
                        value={newPlayerRatings[sKey] || ""}
                        onChange={(e) => setNewPlayerRatings({ ...newPlayerRatings, [sKey]: e.target.value })}
                        placeholder={isUtr ? "UTR (1.00 - 16.50)" : "Elo (e.g. 1000)"}
                        className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                      />
                      <span className="font-mono text-[10px] text-surface-400 w-8">{isUtr ? "UTR" : "Elo"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAddPlayer}
              disabled={addingPlayer}
              className="flex-1 bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2 text-surface-900 font-display font-bold text-xs disabled:opacity-50"
            >
              {addingPlayer ? "Adding..." : "Add Player"}
            </button>
            <button
              onClick={() => { setShowAddPlayer(false); setAddPlayerMsg(null); }}
              className="px-4 py-2 rounded-lg bg-surface-50 border border-surface-200 text-surface-500 font-body text-xs"
            >
              Cancel
            </button>
          </div>
          {addPlayerMsg && (
            <p className={`font-body text-xs text-center mt-2 ${addPlayerMsg.ok ? "text-green-400" : "text-red-400"}`}>
              {addPlayerMsg.text}
            </p>
          )}
        </div>
      )}

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-6">
        {/* Director mode toggle */}
        {canDirector && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setDirectorMode(false); resetForm(); }}
              className={`flex-1 rounded-lg py-2 px-3 font-mono text-[11px] font-semibold border transition-all
                ${!directorMode ? "bg-surface-200 border-surface-300 text-surface-800" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
            >
              My Match
            </button>
            <button
              onClick={() => { setDirectorMode(true); resetForm(); }}
              className={`flex-1 rounded-lg py-2 px-3 font-mono text-[11px] font-semibold border transition-all
                ${directorMode ? "bg-brand-800 border-brand-500 text-brand-300" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
            >
              Director Mode
            </button>
          </div>
        )}

        {/* Type toggle */}
        <div className="flex gap-2 mb-6">
          {["singles", "doubles"].map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); resetForm(); }}
              className={`flex-1 rounded-lg py-2.5 px-4 font-body text-sm border transition-all
                ${type === t ? "bg-surface-200 border-surface-300 text-surface-800" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
            >
              {t === "singles" ? `${sportEmoji} Singles` : "\u{1F465} Doubles"}
            </button>
          ))}
        </div>

        {/* Player selects */}
        {directorMode ? (
          <>
            {/* Director mode: pick winner(s) and loser(s) */}
            <div className="mb-1">
              <span className="font-mono text-[10px] text-green-400 uppercase tracking-widest font-semibold">
                Winner{type === "doubles" ? "s" : ""}
              </span>
            </div>
            <SelectField
              label={type === "singles" ? "Winner" : "Winner 1"}
              value={winner1}
              onChange={setWinner1}
              playerList={allPlayers}
            />
            {type === "doubles" && (
              <SelectField
                label="Winner 2"
                value={winner2}
                onChange={setWinner2}
                playerList={allPlayers}
              />
            )}

            <div className="mb-1 mt-2">
              <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest font-semibold">
                Loser{type === "doubles" ? "s" : ""}
              </span>
            </div>
            <SelectField
              label={type === "singles" ? "Loser" : "Loser 1"}
              value={loser1}
              onChange={setLoser1}
              playerList={allPlayers}
            />
            {type === "doubles" && (
              <SelectField
                label="Loser 2"
                value={loser2}
                onChange={setLoser2}
                playerList={allPlayers}
              />
            )}
          </>
        ) : (
          <>
            {/* Player mode: self is in the match */}
            {type === "singles" ? (
              <SelectField
                label="Opponent"
                value={opponent}
                onChange={setOpponent}
              />
            ) : (
              <>
                <SelectField
                  label="Your Partner"
                  value={partner}
                  onChange={setPartner}
                />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Opponent 1"
                    value={opp1}
                    onChange={setOpp1}
                    placeholder="Select..."
                  />
                  <SelectField
                    label="Opponent 2"
                    value={opp2}
                    onChange={setOpp2}
                    placeholder="Select..."
                  />
                </div>
              </>
            )}

            {/* Result (only in player mode) */}
            <div className="mb-4">
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Result
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setWon(true)}
                  className={`flex-1 rounded-lg py-2.5 px-4 font-body text-sm border transition-all
                    ${won ? "bg-green-950 border-green-800 text-green-400" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
                >
                  {"\u{1F389}"} Won
                </button>
                <button
                  onClick={() => setWon(false)}
                  className={`flex-1 rounded-lg py-2.5 px-4 font-body text-sm border transition-all
                    ${!won ? "bg-red-950 border-red-800 text-red-400" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
                >
                  {"\u{1F624}"} Lost
                </button>
              </div>
            </div>
          </>
        )}

        {/* Competition selector: League or Tournament */}
        <div className="mb-3.5">
          <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
            Tournament / League (optional)
          </label>

          {/* Tournament selector */}
          <select
            value={selectedTournament}
            onChange={(e) => {
              setSelectedTournament(e.target.value);
              if (e.target.value) setSelectedLeague(""); // clear league if tournament selected
            }}
            className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm mb-2"
          >
            <option value="">No tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {"\u{1F3C6}"} {t.name}
                {t.tournamentType === "team" ? " (Team)" : ""}
                {t.format === "round_robin" ? " - RR" : " - KO"}
              </option>
            ))}
          </select>

          {/* League selector (only shown when no tournament is selected) */}
          {!selectedTournament && leagues.length > 0 && (
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            >
              <option value="">No league</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {"\u{1F3C5}"} {l.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Team selectors (only for team tournaments) */}
        {isTeamTournament && tournamentTeams.length > 0 && (
          <div className="mb-3.5 bg-purple-950/10 border border-purple-800/20 rounded-lg p-3">
            <label className="block font-mono text-[10px] text-purple-400 uppercase tracking-widest mb-2">
              {"\u{1F465}"} Team Selection
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[9px] text-surface-400 uppercase tracking-widest mb-1">
                  Your Team / Winning Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                >
                  <option value="">Select team...</option>
                  {tournamentTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.players.map((p) => p.displayName.split(" ")[0]).join(", ")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] text-surface-400 uppercase tracking-widest mb-1">
                  Opponent Team / Losing Team
                </label>
                <select
                  value={selectedOpponentTeam}
                  onChange={(e) => setSelectedOpponentTeam(e.target.value)}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                >
                  <option value="">Select team...</option>
                  {tournamentTeams
                    .filter((t) => String(t.id) !== selectedTeam)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.players.map((p) => p.displayName.split(" ")[0]).join(", ")})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Show selected team players */}
            {selectedTeam && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tournamentTeams
                  .find((t) => String(t.id) === selectedTeam)
                  ?.players.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/30 border border-purple-800/30 text-[10px] font-body text-purple-400"
                    >
                      {p.displayName}
                    </span>
                  ))}
                <span className="text-surface-400 mx-1 text-[10px] self-center">vs</span>
                {selectedOpponentTeam &&
                  tournamentTeams
                    .find((t) => String(t.id) === selectedOpponentTeam)
                    ?.players.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/30 border border-red-800/30 text-[10px] font-body text-red-400"
                      >
                        {p.displayName}
                      </span>
                    ))}
              </div>
            )}
          </div>
        )}

        {/* Score */}
        <div className="mb-6">
          <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
            Score (optional)
          </label>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="e.g. 11-8, 11-6"
            className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2.5 text-surface-900 font-display font-bold text-sm disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Match"}
        </button>

        {msg && (
          <p
            className={`text-center font-body text-sm mt-3 ${msg.ok ? "text-green-400" : "text-red-400"}`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Recent Matches - Admin/Director can delete/edit */}
      {canDirector && (
        <div className="mt-6">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="flex items-center gap-2 font-mono text-[10px] text-surface-400 uppercase tracking-widest hover:text-surface-600 transition-all mb-3"
          >
            <span>{showRecent ? "\u25BC" : "\u25B6"}</span>
            <span>Edit Recent Matches</span>
          </button>

          {showRecent && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
              <p className="font-body text-xs text-surface-500 mb-3">
                Delete a wrong match to reverse ratings, then re-record the correct result.
              </p>
              {recentMatches.length === 0 ? (
                <p className="font-body text-sm text-surface-500 italic">No recent matches</p>
              ) : (
                <div className="space-y-2">
                  {recentMatches.map((m) => {
                    const { wNames, lNames } = formatMatchPlayers(m);
                    const isEditing = editingMatch === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`px-3 py-2.5 rounded-lg border ${isEditing ? "bg-surface-100 border-brand-700/30" : "bg-surface-50/50 border-surface-200/50"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-body text-sm text-surface-800">
                              <span className="text-green-400">{wNames}</span>
                              <span className="text-surface-400 mx-1.5">beat</span>
                              <span className="text-red-400">{lNames}</span>
                            </div>
                            <div className="flex gap-3 font-mono text-[10px] text-surface-400 mt-0.5">
                              <span>{m.match_type}</span>
                              {m.score && <span>{m.score}</span>}
                              <span>{new Date(m.played_at).toLocaleDateString()}</span>
                              {m.tournament_id && <span className="text-purple-400">Tournament</span>}
                              {m.league_id && <span className="text-blue-400">League</span>}
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            {!isEditing && (
                              <>
                                <button
                                  onClick={() => startEditMatch(m)}
                                  className="px-3 py-1.5 rounded-lg bg-blue-950/50 border border-blue-800/50 text-blue-400 font-body text-xs hover:bg-blue-900/50 transition-all"
                                >
                                  {"\u270F\uFE0F"} Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMatch(m.id)}
                                  disabled={deletingId === m.id}
                                  className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 font-body text-xs hover:bg-red-900/50 transition-all disabled:opacity-50"
                                >
                                  {deletingId === m.id ? "..." : "\u{1F5D1} Delete"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline Edit Form */}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-surface-200">
                            <div className="mb-3">
                              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                                Score
                              </label>
                              <input
                                value={editScore}
                                onChange={(e) => setEditScore(e.target.value)}
                                placeholder="e.g. 11-8, 11-6"
                                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                              />
                            </div>
                            <div className="mb-3">
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editSwap}
                                  onChange={(e) => setEditSwap(e.target.checked)}
                                  className="w-4 h-4 rounded border-surface-300 accent-orange-500"
                                />
                                <span className="font-body text-sm text-surface-700">
                                  Swap winner/loser <span className="text-surface-400 text-xs">(reverses and recalculates ratings)</span>
                                </span>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditMatch(m.id)}
                                disabled={editSaving}
                                className="flex-1 bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-1.5 text-surface-900 font-display font-bold text-xs disabled:opacity-50"
                              >
                                {editSaving ? "Saving..." : "Save Changes"}
                              </button>
                              <button
                                onClick={() => setEditingMatch(null)}
                                className="px-4 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-surface-500 font-body text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteMatch(m.id)}
                                disabled={deletingId === m.id}
                                className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 font-body text-xs hover:bg-red-900/50 transition-all disabled:opacity-50"
                              >
                                {deletingId === m.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
