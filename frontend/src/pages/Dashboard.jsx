import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";
import StatCard from "../components/StatCard";
import MatchRow from "../components/MatchRow";

function formatName(displayName) {
  if (!displayName) return "";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

const ranges = [
  { label: "7D", val: 7 },
  { label: "14D", val: 14 },
  { label: "30D", val: 30 },
  { label: "90D", val: 90 },
  { label: "All", val: 99999 },
];

export default function Dashboard() {
  const { player } = useAuth();
  const { sport, sportLabel, isUtr, ratingLabel, defaultRating } = useSport();
  const [days, setDays] = useState(7);
  const [matches, setMatches] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/matches/my", { params: { days, sport } }),
      api.get(`/players/${player.id}`, { params: { sport } }),
    ])
      .then(([matchRes, playerRes]) => {
        setMatches(matchRes.data.matches);
        // Build ratings lookup for current sport
        const sportRatings = {};
        (playerRes.data.ratings || [])
          .filter((r) => r.sport === sport)
          .forEach((r) => {
            sportRatings[r.rating_type] = r;
          });
        setRatings(sportRatings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days, sport, player.id]);

  const singlesMatches = matches.filter((m) => m.match_type === "singles");
  const doublesMatches = matches.filter((m) => m.match_type === "doubles");

  const countWins = (list) =>
    list.filter((m) =>
      m.players?.find((p) => p.player_id === player.id && p.team === "winner")
    ).length;

  const sWins = countWins(singlesMatches);
  const dWins = countWins(doublesMatches);

  const skillRating = ratings.skill || {};
  const leagueRating = ratings.league || {};
  const tournamentRating = ratings.tournament || {};

  const formatRating = (singles, doubles) => {
    if (isUtr) {
      const s = parseFloat(singles || 5.0).toFixed(2);
      const d = parseFloat(doubles || 5.0).toFixed(2);
      return `${s} / ${d}`;
    }
    return `${singles || 1000} / ${doubles || 1000}`;
  };

  const getSingles = (r) => isUtr ? r.singles_utr : r.singles_elo;
  const getDoubles = (r) => isUtr ? r.doubles_utr : r.doubles_elo;

  return (
    <div>
      {/* Header row */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl text-surface-900">
          Welcome back, {formatName(player?.display_name)}
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

      {/* Rating cards - 3 types */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard
          label={`Skill ${ratingLabel}`}
          value={formatRating(getSingles(skillRating), getDoubles(skillRating))}
          sub={`Singles / Doubles${isUtr ? " (UTR 1-16)" : ""}`}
          accentClass="text-brand-300"
        />
        <StatCard
          label={`League ${ratingLabel}`}
          value={formatRating(getSingles(leagueRating), getDoubles(leagueRating))}
          sub={`Singles / Doubles${isUtr ? " (UTR 1-16)" : ""}`}
          accentClass="text-blue-400"
        />
        <StatCard
          label={`Tournament ${ratingLabel}`}
          value={formatRating(getSingles(tournamentRating), getDoubles(tournamentRating))}
          sub={`Singles / Doubles${isUtr ? " (UTR 1-16)" : ""}`}
          accentClass="text-purple-400"
        />
      </div>

      {/* W/L cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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
          Recent {sportLabel} Matches
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
