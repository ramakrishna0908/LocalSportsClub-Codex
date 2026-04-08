import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";
import CompetitionCard from "../components/CompetitionCard";

const statusFilters = ["all", "in_progress", "registration", "upcoming", "completed"];
const statusLabels = {
  all: "All",
  in_progress: "Active",
  registration: "Registration",
  upcoming: "Upcoming",
  completed: "Completed",
};

export default function Tournaments() {
  const { player } = useAuth();
  const { sport } = useSport();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    matchType: "singles",
    tournamentDate: "",
    maxPlayers: "",
    tournamentType: "individual",
    format: "knockout",
    clubId: "",
  });
  const [msg, setMsg] = useState(null);
  const [clubs, setClubs] = useState([]);

  const fetchTournaments = () => {
    setLoading(true);
    const params = { sport };
    if (filter !== "all") params.status = filter;
    if (typeFilter !== "all") params.tournamentType = typeFilter;
    api
      .get("/tournaments", { params })
      .then((res) => setTournaments(res.data.tournaments))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTournaments();
  }, [filter, typeFilter, sport]);

  useEffect(() => {
    api.get("/clubs").then((res) => setClubs(res.data.clubs || [])).catch(() => {});
  }, []);

  const createTournament = async () => {
    setMsg(null);
    try {
      if (!form.name || !form.tournamentDate) {
        throw new Error("Name and date are required");
      }
      const payload = {
        ...form,
        sport,
        maxPlayers: form.maxPlayers ? parseInt(form.maxPlayers) : undefined,
      };
      if (!payload.clubId) delete payload.clubId;
      await api.post("/tournaments", payload);
      setShowCreate(false);
      setForm({
        name: "",
        description: "",
        matchType: "singles",
        tournamentDate: "",
        maxPlayers: "",
        tournamentType: "individual",
        format: "knockout",
        clubId: "",
      });
      fetchTournaments();
    } catch (err) {
      setMsg(err.response?.data?.error || err.message);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl text-surface-900">Tournaments</h2>
        {(player?.role === "admin" || player?.role === "director") && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            {showCreate ? "Cancel" : "+ New Tournament"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tournament name"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1 block">
                  Tournament Type
                </label>
                <select
                  value={form.tournamentType}
                  onChange={(e) => setForm({ ...form, tournamentType: e.target.value })}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                >
                  <option value="individual">Individual</option>
                  <option value="team">Team</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1 block">
                  Format
                </label>
                <select
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value })}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                >
                  <option value="knockout">Knockout</option>
                  <option value="round_robin">Round Robin</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
                {form.tournamentType === "team" && (
                  <option value="both">Both (Singles & Doubles)</option>
                )}
              </select>
              <select
                value={form.clubId}
                onChange={(e) => setForm({ ...form, clubId: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              >
                <option value="">No Club</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.tournamentDate}
                onChange={(e) => setForm({ ...form, tournamentDate: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
              <input
                type="number"
                value={form.maxPlayers}
                onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })}
                placeholder={form.tournamentType === "team" ? "Max teams" : "Max players"}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>
            <button
              onClick={createTournament}
              className="w-full bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2.5 text-surface-900 font-display font-bold text-sm"
            >
              Create Tournament
            </button>
            {msg && <p className="text-red-400 font-body text-sm text-center">{msg}</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Type filter */}
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {["all", "individual", "team"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
                ${typeFilter === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {t === "all" ? "All Types" : t === "individual" ? "\u{1F464} Individual" : "\u{1F465} Team"}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                ${filter === s ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament list */}
      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : tournaments.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">No tournaments found</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <CompetitionCard
              key={t.id}
              name={t.name}
              matchType={t.matchType}
              status={t.status}
              dateInfo={formatDate(t.tournamentDate)}
              playerCount={t.tournamentType === "team" ? t.teamCount : t.playerCount}
              countLabel={t.tournamentType === "team" ? "teams" : "players"}
              badge={t.tournamentType === "team" ? "TEAM" : null}
              formatBadge={t.format === "round_robin" ? "RR" : "KO"}
              clubName={t.clubName}
              onClick={() => navigate(`/tournaments/${t.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
