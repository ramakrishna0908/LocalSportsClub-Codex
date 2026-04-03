import { useState, useEffect } from "react";
import { useSport } from "../context/SportContext";
import api from "../api/client";

const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
const medalColors = ["text-brand-300", "text-surface-600", "text-amber-700"];

export default function Rankings() {
  const { sport, RATING_TYPES, isUtr, ratingLabel } = useSport();
  const [tab, setTab] = useState("singles");
  const [ratingType, setRatingType] = useState("skill");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/rankings/${tab}`, { params: { sport, ratingType } })
      .then((res) => setRankings(res.data.rankings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab, sport, ratingType]);

  const formatRating = (val) => {
    if (isUtr) return parseFloat(val).toFixed(2);
    return val;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-2xl text-surface-900">Leaderboard</h2>
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {["singles", "doubles"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
                ${tab === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Rating type toggle */}
      <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200 mb-5 w-fit">
        {RATING_TYPES.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setRatingType(rt.key)}
            className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
              ${ratingType === rt.key ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        {/* Header row */}
        <div className="grid grid-cols-[44px_1fr_70px_50px_50px_55px] gap-1.5 px-1.5 pb-3 border-b border-surface-200">
          {["#", "Player", ratingLabel, "P", "W", "Win%"].map((h) => (
            <span
              key={h}
              className="font-mono text-[10px] text-surface-400 uppercase tracking-wider"
            >
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-surface-400 font-body text-sm py-8">
            Loading...
          </p>
        ) : rankings.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No players yet
          </p>
        ) : (
          rankings.map((p, i) => (
            <div
              key={p.id}
              className="grid grid-cols-[44px_1fr_70px_50px_50px_55px] gap-1.5 px-1.5 py-2.5 border-b border-surface-200/50 items-center"
            >
              <span
                className={`font-display text-sm ${i < 3 ? medalColors[i] : "text-surface-400"}`}
              >
                {i < 3 ? medals[i] : i + 1}
              </span>

              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[11px] text-brand-300 shrink-0">
                  {p.displayName[0].toUpperCase()}
                </span>
                <div>
                  <div className="font-body text-[13px] text-surface-800">
                    {p.displayName}
                  </div>
                  <div className="font-mono text-[10px] text-surface-400">
                    @{p.username}
                  </div>
                </div>
              </div>

              <span className="font-mono text-sm text-brand-300 font-bold">
                {formatRating(p.rating)}
              </span>
              <span className="font-mono text-xs text-surface-500">
                {p.played}
              </span>
              <span className="font-mono text-xs text-green-400">
                {p.wins}
              </span>
              <span className="font-mono text-xs text-surface-500">
                {p.played > 0 ? `${p.winRate}%` : "\u2014"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
