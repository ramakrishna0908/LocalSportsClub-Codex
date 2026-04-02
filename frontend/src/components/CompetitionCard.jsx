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

export default function CompetitionCard({ name, matchType, status, dateInfo, playerCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-100/70 border border-surface-200 rounded-xl p-5 hover:border-surface-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h3 className="font-display text-base text-surface-900 leading-tight">
          {name}
        </h3>
        <Badge color={statusColors[status] || "slate"}>
          {statusLabels[status] || status}
        </Badge>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <Badge color={matchType === "singles" ? "blue" : "amber"}>
          {matchType === "singles" ? "Singles" : "Doubles"}
        </Badge>

        <span className="font-mono text-[11px] text-surface-400">
          {dateInfo}
        </span>

        <span className="font-mono text-[11px] text-surface-500">
          {playerCount} player{playerCount !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
