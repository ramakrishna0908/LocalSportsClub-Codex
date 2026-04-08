import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const statusEmoji = {
  registration: "\u{1F4DD}",
  in_progress: "\u26A1",
  active: "\u26A1",
  upcoming: "\u{1F4C5}",
};

const statusLabel = {
  registration: "Registration Open",
  in_progress: "In Progress",
  active: "Active",
  upcoming: "Upcoming",
};

const statusBorder = {
  registration: "border-blue-800/40 bg-blue-950/10",
  in_progress: "border-amber-800/40 bg-amber-950/10",
  active: "border-green-800/40 bg-green-950/10",
  upcoming: "border-surface-300/40 bg-surface-100/40",
};

const statusTextColor = {
  registration: "text-blue-400",
  in_progress: "text-amber-400",
  active: "text-green-400",
  upcoming: "text-surface-500",
};

export default function Dashboard() {
  const { player } = useAuth();
  const { sport, sportLabel, isUtr, ratingLabel } = useSport();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [matches, setMatches] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [top5Singles, setTop5Singles] = useState([]);
  const [top5Doubles, setTop5Doubles] = useState([]);
  const [myRank, setMyRank] = useState({ singles: null, doubles: null });

  // Active competitions
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/matches/my", { params: { days, sport } }),
      api.get(`/players/${player.id}`, { params: { sport } }),
      api.get("/rankings/singles", { params: { sport, ratingType: "skill" } }),
      api.get("/rankings/doubles", { params: { sport, ratingType: "skill" } }),
    ])
      .then(([matchRes, playerRes, singlesRes, doublesRes]) => {
        setMatches(matchRes.data.matches);
        const sportRatings = {};
        (playerRes.data.ratings || [])
          .filter((r) => r.sport === sport)
          .forEach((r) => {
            sportRatings[r.rating_type] = r;
          });
        setRatings(sportRatings);

        const sRankings = singlesRes.data.rankings || [];
        const dRankings = doublesRes.data.rankings || [];
        setTop5Singles(sRankings.slice(0, 5));
        setTop5Doubles(dRankings.slice(0, 5));

        const mySinglesIdx = sRankings.findIndex((r) => r.id === player.id);
        const myDoublesIdx = dRankings.findIndex((r) => r.id === player.id);
        setMyRank({
          singles: mySinglesIdx >= 0 ? mySinglesIdx + 1 : null,
          doublesRank: myDoublesIdx >= 0 ? myDoublesIdx + 1 : null,
          singlesRating: mySinglesIdx >= 0 ? sRankings[mySinglesIdx].rating : null,
          doublesRating: myDoublesIdx >= 0 ? dRankings[myDoublesIdx].rating : null,
          top5SinglesThreshold: sRankings.length >= 5 ? sRankings[4].rating : null,
          top5DoublesThreshold: dRankings.length >= 5 ? dRankings[4].rating : null,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days, sport, player.id]);

  // Load active tournaments & leagues
  useEffect(() => {
    // Fetch tournaments: registration, in_progress, upcoming
    Promise.all([
      api.get("/tournaments", { params: { sport, status: "registration" } }),
      api.get("/tournaments", { params: { sport, status: "in_progress" } }),
      api.get("/tournaments", { params: { sport, status: "upcoming" } }),
    ])
      .then(([regRes, progRes, upRes]) => {
        setActiveTournaments([
          ...regRes.data.tournaments,
          ...progRes.data.tournaments,
          ...upRes.data.tournaments,
        ]);
      })
      .catch(console.error);

    // Fetch active + registration leagues (deduplicated)
    Promise.all([
      api.get("/leagues", { params: { sport, status: "active" } }),
      api.get("/leagues", { params: { sport, status: "registration" } }),
    ])
      .then(([activeRes, regRes]) => {
        const all = [
          ...(regRes.data.leagues || []),
          ...(activeRes.data.leagues || []),
        ];
        const seen = new Set();
        setActiveLeagues(all.filter((l) => {
          if (seen.has(l.id)) return false;
          seen.add(l.id);
          return true;
        }));
      })
      .catch(console.error);
  }, [sport]);

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
      const s = parseFloat(singles || 1.0).toFixed(2);
      const d = parseFloat(doubles || 1.0).toFixed(2);
      return `${s} / ${d}`;
    }
    return `${singles || 1000} / ${doubles || 1000}`;
  };

  const getSingles = (r) => isUtr ? r.singles_utr : r.singles_elo;
  const getDoubles = (r) => isUtr ? r.doubles_utr : r.doubles_elo;

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const hasActiveCompetitions = activeTournaments.length > 0 || activeLeagues.length > 0;

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

      {/* Active Competitions Banner */}
      {hasActiveCompetitions && (
        <div className="mb-6">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            {"\u{1F3C6}"} Active Competitions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tournaments */}
            {activeTournaments.map((t) => {
              const isRegistered = false; // We'll check below
              return (
                <button
                  key={`t-${t.id}`}
                  onClick={() => navigate(`/tournaments/${t.id}`)}
                  className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${statusBorder[t.status] || "border-surface-200 bg-surface-100/70"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{"\u{1F3C6}"}</span>
                      <span className="font-display text-sm text-surface-900 truncate">
                        {t.name}
                      </span>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${statusTextColor[t.status] || "text-surface-500"}`}>
                      <span>{statusEmoji[t.status]}</span>
                      {statusLabel[t.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-amber-950/40 border border-amber-800/50 text-amber-400">
                      TOURNAMENT
                    </span>
                    {t.tournamentType === "team" && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-purple-950/40 border border-purple-800/50 text-purple-400">
                        TEAM
                      </span>
                    )}
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-surface-200/60 border border-surface-300/50 text-surface-500">
                      {t.format === "round_robin" ? "ROUND ROBIN" : "KNOCKOUT"}
                    </span>
                    <span className={`text-[10px] font-mono ${t.matchType === "singles" ? "text-blue-400" : t.matchType === "both" ? "text-green-400" : "text-amber-400"}`}>
                      {t.matchType === "singles" ? "Singles" : t.matchType === "both" ? "S&D" : "Doubles"}
                    </span>
                    <span className="text-surface-400 text-[10px] font-mono">
                      {formatDate(t.tournamentDate)}
                    </span>
                    <span className="text-surface-500 text-[10px] font-mono">
                      {t.tournamentType === "team"
                        ? `${t.teamCount} team${t.teamCount !== 1 ? "s" : ""}`
                        : `${t.playerCount} player${t.playerCount !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  {t.status === "registration" && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-body text-blue-400 font-semibold">
                        {"\u{1F449}"} Tap to register
                      </span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* Leagues */}
            {activeLeagues.map((l) => (
              <button
                key={`l-${l.id}`}
                onClick={() => navigate(`/leagues/${l.id}`)}
                className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${statusBorder[l.status] || statusBorder.active}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{"\u{1F3C5}"}</span>
                    <span className="font-display text-sm text-surface-900 truncate">
                      {l.name}
                    </span>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${statusTextColor[l.status] || statusTextColor.active}`}>
                    <span>{statusEmoji[l.status] || statusEmoji.active}</span>
                    {statusLabel[l.status] || "Active"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-green-950/40 border border-green-800/50 text-green-400">
                    LEAGUE
                  </span>
                  <span className={`text-[10px] font-mono ${l.matchType === "singles" ? "text-blue-400" : "text-amber-400"}`}>
                    {l.matchType === "singles" ? "Singles" : "Doubles"}
                  </span>
                  {l.startDate && (
                    <span className="text-surface-400 text-[10px] font-mono">
                      {formatDate(l.startDate)} — {formatDate(l.endDate)}
                    </span>
                  )}
                  <span className="text-surface-500 text-[10px] font-mono">
                    {l.playerCount} player{l.playerCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {l.status === "registration" && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-body text-blue-400 font-semibold">
                      {"\u{1F449}"} Tap to register
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Top 5 Leaderboard & Goal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        {/* Top 5 Singles */}
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            {"\u{1F3C6}"} Top 5 Singles
          </h3>
          {top5Singles.length === 0 ? (
            <p className="font-body text-sm text-surface-500 italic">No players yet</p>
          ) : (
            <div className="space-y-1.5">
              {top5Singles.map((p, i) => {
                const isMeInTop5 = p.id === player.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${isMeInTop5 ? "bg-brand-900/30 border border-brand-700/40" : "hover:bg-surface-50/50"}`}
                  >
                    <span className="font-display text-sm w-6 text-center shrink-0">
                      {i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : <span className="text-surface-400">{i + 1}</span>}
                    </span>
                    <span className={`flex-1 font-body text-sm truncate ${isMeInTop5 ? "text-brand-300 font-semibold" : "text-surface-800"}`}>
                      {p.displayName}
                    </span>
                    <span className="font-mono text-sm text-brand-300 font-bold">
                      {isUtr ? parseFloat(p.rating).toFixed(2) : p.rating}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {myRank.singles && myRank.singles > 5 && myRank.top5SinglesThreshold && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <div className="flex items-center gap-2">
                <span className="text-sm">{"\u{1F3AF}"}</span>
                <span className="font-body text-xs text-surface-500">
                  Your rank: <span className="text-surface-800 font-semibold">#{myRank.singles}</span>
                  {" \u2022 "}
                  Need <span className="text-brand-300 font-semibold">
                    {isUtr
                      ? (parseFloat(myRank.top5SinglesThreshold) - parseFloat(myRank.singlesRating)).toFixed(2)
                      : Math.max(0, myRank.top5SinglesThreshold - myRank.singlesRating)
                    }
                  </span> more {ratingLabel} to reach Top 5
                </span>
              </div>
            </div>
          )}
          {myRank.singles && myRank.singles <= 5 && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <div className="flex items-center gap-2">
                <span className="text-sm">{"\u2B50"}</span>
                <span className="font-body text-xs text-green-400 font-semibold">
                  You're in the Top 5! Rank #{myRank.singles}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Top 5 Doubles */}
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
          <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
            {"\u{1F3C6}"} Top 5 Doubles
          </h3>
          {top5Doubles.length === 0 ? (
            <p className="font-body text-sm text-surface-500 italic">No players yet</p>
          ) : (
            <div className="space-y-1.5">
              {top5Doubles.map((p, i) => {
                const isMeInTop5 = p.id === player.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 px-2 py-1.5 rounded-lg ${isMeInTop5 ? "bg-brand-900/30 border border-brand-700/40" : "hover:bg-surface-50/50"}`}
                  >
                    <span className="font-display text-sm w-6 text-center shrink-0">
                      {i === 0 ? "\u{1F947}" : i === 1 ? "\u{1F948}" : i === 2 ? "\u{1F949}" : <span className="text-surface-400">{i + 1}</span>}
                    </span>
                    <span className={`flex-1 font-body text-sm truncate ${isMeInTop5 ? "text-brand-300 font-semibold" : "text-surface-800"}`}>
                      {p.displayName}
                    </span>
                    <span className="font-mono text-sm text-brand-300 font-bold">
                      {isUtr ? parseFloat(p.rating).toFixed(2) : p.rating}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {myRank.doublesRank && myRank.doublesRank > 5 && myRank.top5DoublesThreshold && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <div className="flex items-center gap-2">
                <span className="text-sm">{"\u{1F3AF}"}</span>
                <span className="font-body text-xs text-surface-500">
                  Your rank: <span className="text-surface-800 font-semibold">#{myRank.doublesRank}</span>
                  {" \u2022 "}
                  Need <span className="text-brand-300 font-semibold">
                    {isUtr
                      ? (parseFloat(myRank.top5DoublesThreshold) - parseFloat(myRank.doublesRating)).toFixed(2)
                      : Math.max(0, myRank.top5DoublesThreshold - myRank.doublesRating)
                    }
                  </span> more {ratingLabel} to reach Top 5
                </span>
              </div>
            </div>
          )}
          {myRank.doublesRank && myRank.doublesRank <= 5 && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <div className="flex items-center gap-2">
                <span className="text-sm">{"\u2B50"}</span>
                <span className="font-body text-xs text-green-400 font-semibold">
                  You're in the Top 5! Rank #{myRank.doublesRank}
                </span>
              </div>
            </div>
          )}
        </div>
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
