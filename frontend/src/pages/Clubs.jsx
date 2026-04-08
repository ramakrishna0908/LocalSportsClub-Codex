import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function Clubs() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [msg, setMsg] = useState(null);

  const fetchClubs = () => {
    setLoading(true);
    api
      .get("/clubs")
      .then((res) => setClubs(res.data.clubs))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const createClub = async () => {
    setMsg(null);
    try {
      if (!form.name) throw new Error("Club name is required");
      await api.post("/clubs", form);
      setShowCreate(false);
      setForm({ name: "", description: "" });
      fetchClubs();
    } catch (err) {
      setMsg(err.response?.data?.error || err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl text-surface-900">Clubs</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 font-display font-bold text-xs text-surface-900"
        >
          {showCreate ? "Cancel" : "+ New Club"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Club name"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
            />
            <button
              onClick={createClub}
              className="w-full bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2.5 text-surface-900 font-display font-bold text-sm"
            >
              Create Club
            </button>
            {msg && <p className="text-red-400 font-body text-sm text-center">{msg}</p>}
          </div>
        </div>
      )}

      {/* Club list */}
      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : clubs.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">No clubs yet. Create one!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {clubs.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/clubs/${c.id}`)}
              className="w-full text-left bg-surface-100/70 border border-surface-200 rounded-xl p-4 hover:border-brand-700/40 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-display text-sm text-surface-900">{c.name}</span>
                <span className="shrink-0 inline-block px-2 py-0.5 rounded-full bg-brand-900/30 border border-brand-700/40 text-[10px] font-mono font-semibold text-brand-300">
                  {c.adminCount} admin{c.adminCount !== 1 ? "s" : ""}
                </span>
              </div>
              {c.description && (
                <p className="font-body text-[12px] text-surface-500 mb-2 line-clamp-2">{c.description}</p>
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-surface-400">
                  {c.leagueCount} league{c.leagueCount !== 1 ? "s" : ""}
                </span>
                <span className="font-mono text-[10px] text-surface-400">
                  {c.tournamentCount} tournament{c.tournamentCount !== 1 ? "s" : ""}
                </span>
                <span className="font-mono text-[10px] text-surface-400">
                  by {c.createdByName}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
