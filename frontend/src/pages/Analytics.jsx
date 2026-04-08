import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const ranges = [
  { label: "7D", val: 7 },
  { label: "30D", val: 30 },
  { label: "90D", val: 90 },
  { label: "All", val: 99999 },
];

const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

// --- MOVERS TAB ---
function MoversTab({ sport, isUtr, ratingLabel, playerId }) {
  const [days, setDays] = useState(30);
  const [matchType, setMatchType] = useState("singles");
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/analytics/movers", { params: { sport, matchType, days } })
      .then((res) => setMovers(res.data.movers))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sport, matchType, days]);

  const formatRating = (val) => {
    if (isUtr) return (val / 100).toFixed(2);
    return val;
  };

  const formatDelta = (val) => {
    if (isUtr) {
      const d = (val / 100).toFixed(2);
      return val >= 0 ? `+${d}` : d;
    }
    return val >= 0 ? `+${val}` : val;
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {["singles", "doubles"].map((t) => (
            <button
              key={t}
              onClick={() => setMatchType(t)}
              className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
                ${matchType === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
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

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
        <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
          {"\u{1F680}"} Fastest Improvers
        </h3>

        {loading ? (
          <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
        ) : movers.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No matches in this period
          </p>
        ) : (
          <div className="space-y-1.5">
            {movers.map((m, i) => {
              const isMe = m.id === playerId;
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                    ${isMe ? "bg-brand-900/20 border border-brand-700/30" : "hover:bg-surface-50/50"}`}
                >
                  <span className="font-display text-sm w-6 text-center shrink-0">
                    {i < 3 ? medals[i] : <span className="text-surface-400">{i + 1}</span>}
                  </span>
                  <span className={`flex-1 font-body text-sm truncate ${isMe ? "text-brand-300 font-semibold" : "text-surface-800"}`}>
                    {m.displayName}
                  </span>
                  <span className={`font-mono text-sm font-bold ${m.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatDelta(m.delta)}
                  </span>
                  <span className="font-mono text-[10px] text-surface-400 w-24 text-right hidden sm:block">
                    {formatRating(m.startRating)} {"\u2192"} {formatRating(m.endRating)}
                  </span>
                  <span className="font-mono text-[10px] text-surface-400 w-10 text-right">
                    {m.matchesPlayed}G
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

// --- MATCHUPS TAB ---
function MatchupsTab({ sport, isUtr, ratingLabel }) {
  const [matchType, setMatchType] = useState("singles");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/analytics/suggestions", { params: { sport, matchType } })
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sport, matchType]);

  const formatRating = (val) => {
    if (isUtr) return parseFloat(val).toFixed(2);
    return Math.round(val);
  };

  const probColor = (p) => {
    if (p >= 0.55) return "text-green-400";
    if (p <= 0.45) return "text-red-400";
    return "text-yellow-400";
  };

  const probBarColor = (p) => {
    if (p >= 0.55) return "bg-green-500";
    if (p <= 0.45) return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <div>
      <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200 mb-5 w-fit">
        {["singles", "doubles"].map((t) => (
          <button
            key={t}
            onClick={() => setMatchType(t)}
            className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
              ${matchType === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : !data ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">No data</p>
      ) : (
        <>
          {/* My Rating */}
          <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-4 mb-5">
            <span className="font-mono text-[10px] text-surface-400 uppercase tracking-widest">Your {ratingLabel}</span>
            <span className="font-mono text-lg text-brand-300 font-bold ml-3">{formatRating(data.myRating)}</span>
          </div>

          {/* Singles Suggestions */}
          {matchType === "singles" && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
              <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
                {"\u{1F3AF}"} Suggested Opponents
              </h3>
              {data.suggestions.length === 0 ? (
                <p className="font-body text-sm text-surface-500 italic">No players in your rating range</p>
              ) : (
                <div className="space-y-2">
                  {data.suggestions.map((s) => (
                    <div
                      key={s.opponent.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg bg-surface-50/50 border border-surface-200/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center font-display text-sm text-surface-600 shrink-0">
                        {s.opponent.displayName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm text-surface-800">{s.opponent.displayName}</div>
                        <div className="font-mono text-[10px] text-surface-400">
                          {ratingLabel}: {formatRating(s.opponent.rating)}
                          {s.daysSinceLastMatch !== null
                            ? ` \u2022 Last played ${s.daysSinceLastMatch}d ago`
                            : " \u2022 Never played"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-mono text-sm font-bold ${probColor(s.winProbability)}`}>
                          {Math.round(s.winProbability * 100)}%
                        </div>
                        <div className="w-16 h-1.5 bg-surface-200 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${probBarColor(s.winProbability)}`}
                            style={{ width: `${Math.round(s.winProbability * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Doubles Suggestions */}
          {matchType === "doubles" && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
              <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
                {"\u{1F465}"} Balanced Team Pairings
              </h3>
              {data.doublesSuggestions.length === 0 ? (
                <p className="font-body text-sm text-surface-500 italic">Need at least 3 other players for doubles suggestions</p>
              ) : (
                <div className="space-y-3">
                  {data.doublesSuggestions.map((ds, i) => (
                    <div
                      key={i}
                      className={`px-4 py-3 rounded-lg border ${i === 0 ? "bg-green-950/20 border-green-800/30" : "bg-surface-50/50 border-surface-200/50"}`}
                    >
                      {i === 0 && (
                        <span className="font-mono text-[10px] text-green-400 uppercase tracking-widest font-semibold">
                          {"\u2B50"} Best Balance
                        </span>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1">
                          <div className="font-body text-sm text-surface-800">
                            {ds.team1.map((p) => p.displayName).join(" & ")}
                          </div>
                          <span className="font-mono text-[10px] text-surface-400">
                            Total: {formatRating(ds.team1Total)}
                          </span>
                        </div>
                        <span className="font-display text-sm text-surface-400">vs</span>
                        <div className="flex-1 text-right">
                          <div className="font-body text-sm text-surface-800">
                            {ds.team2.map((p) => p.displayName).join(" & ")}
                          </div>
                          <span className="font-mono text-[10px] text-surface-400">
                            Total: {formatRating(ds.team2Total)}
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-[10px] text-surface-400 mt-1">
                        Rating gap: {formatRating(ds.ratingGap)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- MY STATS TAB ---
function MyStatsTab({ sport, isUtr, ratingLabel }) {
  const [matchType, setMatchType] = useState("singles");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/analytics/trends", { params: { sport, matchType } })
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sport, matchType]);

  const formatRating = (val) => {
    if (isUtr) return (val / 100).toFixed(2);
    return val;
  };

  const chartData =
    data?.ratingProgression.map((m, i) => ({
      name: new Date(m.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rating: isUtr ? m.eloAfter / 100 : m.eloAfter,
      index: i + 1,
    })) || [];

  const winRateData =
    data?.rollingWinRate.map((r) => ({
      name: new Date(r.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      winRate: r.winRate,
      matchIndex: r.matchIndex,
    })) || [];

  return (
    <div>
      <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200 mb-5 w-fit">
        {["singles", "doubles"].map((t) => (
          <button
            key={t}
            onClick={() => setMatchType(t)}
            className={`px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
              ${matchType === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : !data ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">No data</p>
      ) : data.ratingProgression.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">
          No {matchType} matches yet. Play some games!
        </p>
      ) : (
        <>
          {/* Streaks */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-4 text-center">
              <div className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1">Current</div>
              <div className={`font-display text-xl font-bold ${data.streaks.currentType === "win" ? "text-green-400" : data.streaks.currentType === "loss" ? "text-red-400" : "text-surface-400"}`}>
                {data.streaks.currentLength}
              </div>
              <div className="font-mono text-[10px] text-surface-400 capitalize">
                {data.streaks.currentType === "none" ? "--" : `${data.streaks.currentType} streak`}
              </div>
            </div>
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-4 text-center">
              <div className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1">Best Win</div>
              <div className="font-display text-xl font-bold text-green-400">{data.streaks.bestWin}</div>
              <div className="font-mono text-[10px] text-surface-400">in a row</div>
            </div>
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-4 text-center">
              <div className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1">Worst Loss</div>
              <div className="font-display text-xl font-bold text-red-400">{data.streaks.worstLoss}</div>
              <div className="font-mono text-[10px] text-surface-400">in a row</div>
            </div>
          </div>

          {/* Rating Progression Chart */}
          {chartData.length > 1 && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
              <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
                {"\u{1F4C8}"} {ratingLabel} Progression
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2520" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#8a7e6e" }}
                    tickLine={false}
                    axisLine={{ stroke: "#3a3530" }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "#8a7e6e" }}
                    tickLine={false}
                    axisLine={{ stroke: "#3a3530" }}
                    label={{ value: ratingLabel, angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#8a7e6e" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1714",
                      border: "1px solid #3a3530",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#8a7e6e" }}
                    formatter={(val) => [isUtr ? val.toFixed(2) : val, ratingLabel]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#c0a050"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#c0a050" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rolling Win Rate Chart */}
          {winRateData.length > 0 && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-5">
              <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
                {"\u{1F3AF}"} Win Rate (Rolling 10 Matches)
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={winRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2520" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#8a7e6e" }}
                    tickLine={false}
                    axisLine={{ stroke: "#3a3530" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "#8a7e6e" }}
                    tickLine={false}
                    axisLine={{ stroke: "#3a3530" }}
                    label={{ value: "Win %", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#8a7e6e" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1714",
                      border: "1px solid #3a3530",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#8a7e6e" }}
                    formatter={(val) => [`${val}%`, "Win Rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="winRate"
                    stroke="#4ade80"
                    fill="#4ade8020"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Head-to-Head */}
          {data.headToHead.length > 0 && (
            <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
              <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-4">
                {"\u{1F93C}"} Head-to-Head Record
              </h3>
              <div className="space-y-1.5">
                {data.headToHead.map((h) => (
                  <div
                    key={h.opponentId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-50/50"
                  >
                    <div className="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center font-display text-xs text-surface-600 shrink-0">
                      {h.opponentName.charAt(0)}
                    </div>
                    <span className="flex-1 font-body text-sm text-surface-800 truncate">
                      {h.opponentName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm text-green-400 font-bold">{h.wins}W</span>
                      <span className="text-surface-400">-</span>
                      <span className="font-mono text-sm text-red-400 font-bold">{h.losses}L</span>
                    </div>
                    <span className="font-mono text-[10px] text-surface-400 w-10 text-right">
                      {h.winRate}%
                    </span>
                    {/* Mini win rate bar */}
                    <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full ${h.winRate >= 50 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${h.winRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- MAIN ANALYTICS PAGE ---
const TABS = [
  { key: "movers", label: "Movers", icon: "\u{1F680}" },
  { key: "matchups", label: "Matchups", icon: "\u{1F3AF}" },
  { key: "stats", label: "My Stats", icon: "\u{1F4CA}" },
];

export default function Analytics() {
  const { player } = useAuth();
  const { sport, sportLabel, sportEmoji, isUtr, ratingLabel } = useSport();
  const [tab, setTab] = useState("movers");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{"\u{1F4C8}"}</span>
        <div>
          <h2 className="font-display text-2xl text-surface-900">Analytics</h2>
          <p className="font-body text-sm text-surface-500">
            {sportEmoji} {sportLabel} insights and trends
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 px-3 font-body text-sm transition-all
              ${tab === t.key ? "bg-surface-200 text-brand-300 font-semibold" : "text-surface-400 hover:text-surface-600"}`}
          >
            <span className="text-sm">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "movers" && (
        <MoversTab sport={sport} isUtr={isUtr} ratingLabel={ratingLabel} playerId={player.id} />
      )}
      {tab === "matchups" && (
        <MatchupsTab sport={sport} isUtr={isUtr} ratingLabel={ratingLabel} />
      )}
      {tab === "stats" && (
        <MyStatsTab sport={sport} isUtr={isUtr} ratingLabel={ratingLabel} />
      )}
    </div>
  );
}
