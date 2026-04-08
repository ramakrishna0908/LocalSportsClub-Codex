import Badge from "./Badge";

const statusColors = {
  upcoming: "slate",
  active: "green",
  completed: "slate",
  registration: "blue",
  in_progress: "amber",
};

const statusLabels = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  registration: "Registration",
  in_progress: "In Progress",
};

export default function CompetitionCard({ name, matchType, status, dateInfo, playerCount, countLabel, badge, formatBadge, clubName, onClick }) {
  const label = countLabel || "player";
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-100/70 border border-surface-200 rounded-xl p-5 hover:border-surface-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base text-surface-900 leading-tight">
            {name}
          </h3>
          {badge && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-purple-950/40 border border-purple-800/50 text-purple-400">
              {badge}
            </span>
          )}
          {formatBadge && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-surface-200/60 border border-surface-300/50 text-surface-500">
              {formatBadge}
            </span>
          )}
        </div>
        <Badge color={statusColors[status] || "slate"}>
          {statusLabels[status] || status}
        </Badge>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <Badge color={matchType === "singles" ? "blue" : matchType === "both" ? "green" : "amber"}>
          {matchType === "singles" ? "Singles" : matchType === "both" ? "Singles & Doubles" : "Doubles"}
        </Badge>

        <span className="font-mono text-[11px] text-surface-400">
          {dateInfo}
        </span>

        <span className="font-mono text-[11px] text-surface-500">
          {playerCount} {label}{playerCount !== 1 ? "s" : ""}
        </span>
        {clubName && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-surface-200/60 border border-surface-300/50 text-surface-400">
            {clubName}
          </span>
        )}
      </div>
    </button>
  );
}
