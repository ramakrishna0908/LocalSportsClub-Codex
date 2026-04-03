import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSport } from "../context/SportContext";
import api from "../api/client";
import Badge from "../components/Badge";
import CompetitionCard from "../components/CompetitionCard";

const tabs = ["leagues", "tournaments", "matches"];

export default function CompetitionHistory() {
  const { sport } = useSport();
  const navigate = useNavigate();
  const [tab, setTab] = useState("leagues");
  const [leagues, setLeagues] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "leagues") {
      api
        .get("/leagues", { params: { status: "completed", sport } })
        .then((res) => setLeagues(res.data.leagues))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (tab === "tournaments") {
      api
        .get("/tournaments", { params: { status: "completed", sport } })
        .then((res) => setTournaments(res.data.tournaments))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      api
        .get("/matches", { params: { sport } })
        .then((res) => setMatches(res.data.matches))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tab, sport]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl text-surface-900">History</h2>
        <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all capitalize
                ${tab === t ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : tab === "leagues" ? (
        leagues.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No completed leagues yet
          </p>
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
        )
      ) : tab === "tournaments" ? (
        tournaments.length === 0 ? (
          <p className="text-center text-surface-400 font-body text-sm py-8 italic">
            No completed tournaments yet
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tournaments.map((t) => (
              <CompetitionCard
                key={t.id}
                name={t.name}
                matchType={t.matchType}
                status={t.status}
                dateInfo={formatDate(t.tournamentDate)}
                playerCount={t.playerCount}
                onClick={() => navigate(`/tournaments/${t.id}`)}
              />
            ))}
          </div>
        )
      ) : (
        /* Matches tab */
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
          {matches.length === 0 ? (
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
                    <Badge color={m.match_type === "singles" ? "blue" : "amber"}>
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
      )}
    </div>
  );
}
