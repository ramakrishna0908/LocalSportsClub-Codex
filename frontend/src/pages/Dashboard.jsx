import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import StatCard from "../components/StatCard";
import MatchRow from "../components/MatchRow";

const ranges = [
  { label: "7D", val: 7 },
  { label: "14D", val: 14 },
  { label: "30D", val: 30 },
  { label: "90D", val: 90 },
  { label: "All", val: 99999 },
];

export default function Dashboard() {
  const { player } = useAuth();
  const [days, setDays] = useState(7);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/matches/my", { params: { days } })
      .then((res) => setMatches(res.data.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const singlesMatches = matches.filter((m) => m.match_type === "singles");
  const doublesMatches = matches.filter((m) => m.match_type === "doubles");

  const countWins = (list) =>
    list.filter((m) =>
      m.players?.find((p) => p.player_id === player.id && p.team === "winner")
    ).length;

  const sWins = countWins(singlesMatches);
  const dWins = countWins(doublesMatches);

  return (
    <div>
      {/* Header row */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl text-surface-900">
          Welcome back, {player?.display_name}
        </h2>
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {ranges.map((r) => (
            <button
              key={r.val}
              onClick={() => setDays(r.val)}
              className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                ${days === r.val ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Singles Elo"
          value={player?.singles_elo || 1000}
          sub={`${singlesMatches.length} matches`}
          accentClass="text-brand-300"
        />
        <StatCard
          label="Doubles Elo"
          value={player?.doubles_elo || 1000}
          sub={`${doublesMatches.length} matches`}
          accentClass="text-blue-400"
        />
        <StatCard
          label="Singles W/L"
          value={`${sWins}/${singlesMatches.length - sWins}`}
          sub={
            singlesMatches.length
              ? `${Math.round((sWins / singlesMatches.length) * 100)}% win rate`
              : "No matches"
          }
          accentClass="text-green-400"
        />
        <StatCard
          label="Doubles W/L"
          value={`${dWins}/${doublesMatches.length - dWins}`}
          sub={
            doublesMatches.length
              ? `${Math.round((dWins / doublesMatches.length) * 100)}% win rate`
              : "No matches"
          }
          accentClass="text-red-400"
        />
      </div>

      {/* Recent Matches */}
      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
          Recent Matches
        </h3>

        {loading ? (
          <p className="text-center text-surface-400 font-body text-sm py-8">
            Loading...
          </p>
        ) : matches.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No matches in this period. Time to play!
          </p>
        ) : (
          <div className="flex flex-col">
            {matches.slice(0, 20).map((m) => (
              <MatchRow key={m.id} match={m} currentPlayerId={player.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
