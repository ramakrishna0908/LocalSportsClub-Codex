import Badge from "./Badge";

export default function MatchRow({ match, currentPlayerId }) {
  const players = match.players || [];
  const winners = players.filter((p) => p.team === "winner");
  const losers = players.filter((p) => p.team === "loser");
  const myEntry = players.find((p) => p.player_id === currentPlayerId);
  const won = myEntry?.team === "winner";

  const eloDiff =
    myEntry?.elo_after != null && myEntry?.elo_before != null
      ? myEntry.elo_after - myEntry.elo_before
      : null;

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const opponentText = () => {
    if (match.match_type === "singles") {
      const opp = won ? losers[0] : winners[0];
      return `vs ${opp?.display_name || "?"}`;
    }
    if (won) {
      const partner = winners.find((w) => w.player_id !== currentPlayerId);
      return `w/ ${partner?.display_name || "?"} vs ${losers.map((l) => l.display_name).join(" & ")}`;
    }
    const partner = losers.find((l) => l.player_id !== currentPlayerId);
    return `w/ ${partner?.display_name || "?"} vs ${winners.map((w) => w.display_name).join(" & ")}`;
  };

  return (
    <div className="flex items-center gap-2 px-1.5 py-2 border-b border-surface-200/40 text-sm">
      <Badge color={match.match_type === "singles" ? "blue" : "amber"}>
        {match.match_type === "singles" ? "S" : "D"}
      </Badge>

      <span className="flex-1 font-body text-[13px] text-surface-800 ml-1">
        {opponentText()}
      </span>

      {match.score && (
        <span className="font-mono text-[11px] text-surface-500">
          {match.score}
        </span>
      )}

      {myEntry && <Badge color={won ? "green" : "red"}>{won ? "W" : "L"}</Badge>}

      {eloDiff !== null && (
        <span
          className={`font-mono text-[11px] min-w-[36px] text-right ${eloDiff >= 0 ? "text-green-400" : "text-red-400"}`}
        >
          {eloDiff >= 0 ? "+" : ""}
          {eloDiff}
        </span>
      )}

      <span className="font-mono text-[10px] text-surface-400 min-w-[62px] text-right">
        {formatDate(match.played_at)}
      </span>
    </div>
  );
}
