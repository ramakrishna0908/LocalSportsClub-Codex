import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import Badge from "../components/Badge";

export default function MatchHistory() {
  const { player } = useAuth();
  const [filter, setFilter] = useState("my");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoint = filter === "my" ? "/matches/my?days=99999" : "/matches";
    api
      .get(endpoint)
      .then((res) => setMatches(res.data.matches))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl text-surface-900">
          Match History
        </h2>
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {[
            { key: "my", label: "My Matches" },
            { key: "all", label: "All" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                ${filter === t.key ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        {loading ? (
          <p className="text-center text-surface-400 font-body text-sm py-8">
            Loading...
          </p>
        ) : matches.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No matches found
          </p>
        ) : (
          <div className="flex flex-col">
            {matches.map((m) => {
              const players = m.players || [];
              const winners = players.filter((p) => p.team === "winner");
              const losers = players.filter((p) => p.team === "loser");

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-1.5 py-2 border-b border-surface-200/40"
                >
                  <Badge
                    color={m.match_type === "singles" ? "blue" : "amber"}
                  >
                    {m.match_type === "singles" ? "Singles" : "Doubles"}
                  </Badge>

                  <span className="flex-1 font-body text-[13px] text-surface-800 ml-1">
                    <span className="text-green-400 font-semibold">
                      {winners.map((w) => w.display_name).join(" & ")}
                    </span>
                    {" beat "}
                    <span className="text-red-400 font-semibold">
                      {losers.map((l) => l.display_name).join(" & ")}
                    </span>
                  </span>

                  {m.score && (
                    <span className="font-mono text-[11px] text-surface-500">
                      {m.score}
                    </span>
                  )}

                  <span className="font-mono text-[10px] text-surface-400 min-w-[65px] text-right">
                    {formatDate(m.played_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
