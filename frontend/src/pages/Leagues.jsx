import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";
import CompetitionCard from "../components/CompetitionCard";

const statusFilters = ["all", "active", "upcoming", "completed"];

export default function Leagues() {
  const { player } = useAuth();
  const { sport } = useSport();
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", matchType: "singles", startDate: "", endDate: "" });
  const [msg, setMsg] = useState(null);

  const fetchLeagues = () => {
    setLoading(true);
    const params = { sport };
    if (filter !== "all") params.status = filter;
    api
      .get("/leagues", { params })
      .then((res) => setLeagues(res.data.leagues))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeagues();
  }, [filter, sport]);

  const createLeague = async () => {
    setMsg(null);
    try {
      if (!form.name || !form.startDate || !form.endDate) {
        throw new Error("Name, start date, and end date are required");
      }
      await api.post("/leagues", { ...form, sport });
      setShowCreate(false);
      setForm({ name: "", description: "", matchType: "singles", startDate: "", endDate: "" });
      fetchLeagues();
    } catch (err) {
      setMsg(err.response?.data?.error || err.message);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl text-surface-900">Leagues</h2>
        {(player?.role === "admin" || player?.role === "director") && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
          >
            {showCreate ? "Cancel" : "+ New League"}
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
              placeholder="League name"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <div className="grid grid-cols-3 gap-3">
              <select
                value={form.matchType}
                onChange={(e) => setForm({ ...form, matchType: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>
            <button
              onClick={createLeague}
              className="w-full bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2.5 text-surface-900 font-display font-bold text-sm"
            >
              Create League
            </button>
            {msg && <p className="text-red-400 font-body text-sm text-center">{msg}</p>}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200 mb-5 w-fit">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
              ${filter === s ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* League list */}
      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : leagues.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">No leagues found</p>
      ) : (
        <div className="flex flex-col gap-3">
          {leagues.map((l) => (
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
    </div>
  );
}
