import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function RecordMatch() {
  const { player, refreshPlayer } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState("singles");
  const [players, setPlayers] = useState([]);
  const [opponent, setOpponent] = useState("");
  const [partner, setPartner] = useState("");
  const [opp1, setOpp1] = useState("");
  const [opp2, setOpp2] = useState("");
  const [won, setWon] = useState(true);
  const [score, setScore] = useState("");
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/players")
      .then((res) =>
        setPlayers(res.data.players.filter((p) => p.id !== player.id))
      )
      .catch(console.error);
  }, [player.id]);

  const submit = async () => {
    setMsg(null);
    setSubmitting(true);

    try {
      let body;
      if (type === "singles") {
        if (!opponent) throw new Error("Select an opponent");
        body = {
          matchType: "singles",
          winners: won ? [player.id] : [parseInt(opponent)],
          losers: won ? [parseInt(opponent)] : [player.id],
          score: score || undefined,
        };
      } else {
        if (!partner || !opp1 || !opp2) throw new Error("Select all players");
        const ids = new Set([
          player.id,
          parseInt(partner),
          parseInt(opp1),
          parseInt(opp2),
        ]);
        if (ids.size !== 4) throw new Error("All 4 players must be different");
        body = {
          matchType: "doubles",
          winners: won
            ? [player.id, parseInt(partner)]
            : [parseInt(opp1), parseInt(opp2)],
          losers: won
            ? [parseInt(opp1), parseInt(opp2)]
            : [player.id, parseInt(partner)],
          score: score || undefined,
        };
      }

      await api.post("/matches", body);
      await refreshPlayer();
      setMsg({ text: "Match recorded!", ok: true });
      setOpponent("");
      setPartner("");
      setOpp1("");
      setOpp2("");
      setScore("");
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

  const SelectField = ({ label, value, onChange, placeholder }) => (
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
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl text-surface-900 mb-5">
        Record Match Result
      </h2>

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-6">
        {/* Type toggle */}
        <div className="flex gap-2 mb-6">
          {["singles", "doubles"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2.5 px-4 font-body text-sm border transition-all
                ${type === t ? "bg-surface-200 border-surface-300 text-surface-800" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
            >
              {t === "singles" ? "🏓 Singles" : "👥 Doubles"}
            </button>
          ))}
        </div>

        {/* Player selects */}
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

        {/* Result */}
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
              🎉 Won
            </button>
            <button
              onClick={() => setWon(false)}
              className={`flex-1 rounded-lg py-2.5 px-4 font-body text-sm border transition-all
                ${!won ? "bg-red-950 border-red-800 text-red-400" : "bg-surface-50/50 border-surface-200 text-surface-500"}`}
            >
              😤 Lost
            </button>
          </div>
        </div>

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
    </div>
  );
}
