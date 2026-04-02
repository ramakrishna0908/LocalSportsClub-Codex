const medals = ["🥇", "🥈", "🥉"];
const medalColors = ["text-brand-300", "text-surface-600", "text-amber-700"];

export default function StandingsTable({ standings, loading }) {
  return (
    <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
      <div className="grid grid-cols-[44px_1fr_50px_50px_50px_55px] gap-1.5 px-1.5 pb-3 border-b border-surface-200">
        {["#", "Player", "W", "L", "P", "Pts"].map((h) => (
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
      ) : standings.length === 0 ? (
        <p className="text-center text-surface-400 font-body text-sm py-8 italic">
          No standings yet
        </p>
      ) : (
        standings.map((p, i) => (
          <div
            key={p.id}
            className="grid grid-cols-[44px_1fr_50px_50px_50px_55px] gap-1.5 px-1.5 py-2.5 border-b border-surface-200/50 items-center"
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

            <span className="font-mono text-xs text-green-400">{p.wins}</span>
            <span className="font-mono text-xs text-red-400">{p.losses}</span>
            <span className="font-mono text-xs text-surface-500">{p.played}</span>
            <span className="font-mono text-sm text-brand-300 font-bold">{p.points}</span>
          </div>
        ))
      )}
    </div>
  );
}
