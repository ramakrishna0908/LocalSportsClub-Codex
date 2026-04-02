export default function BracketView({ bracket }) {
  if (!bracket || bracket.length === 0) {
    return (
      <p className="text-center text-surface-400 font-body text-sm py-8 italic">
        Bracket not generated yet
      </p>
    );
  }

  // Group by round
  const rounds = {};
  bracket.forEach((slot) => {
    if (!rounds[slot.round]) rounds[slot.round] = [];
    rounds[slot.round].push(slot);
  });

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  const totalRounds = roundNumbers.length;

  const roundLabel = (round) => {
    const fromEnd = totalRounds - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semis";
    if (fromEnd === 2) return "Quarters";
    return `Round ${round}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max py-2">
        {roundNumbers.map((round) => (
          <div key={round} className="flex flex-col gap-3">
            <span className="font-mono text-[10px] text-surface-400 uppercase tracking-wider text-center mb-1">
              {roundLabel(round)}
            </span>

            <div
              className="flex flex-col gap-3 justify-around flex-1"
              style={{ minWidth: 180 }}
            >
              {rounds[round]
                .sort((a, b) => a.position - b.position)
                .map((slot) => (
                  <MatchupBox key={slot.id} slot={slot} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchupBox({ slot }) {
  const { player1Id, player1Name, player2Id, player2Name, winnerId } = slot;

  return (
    <div className="bg-surface-100/70 border border-surface-200 rounded-lg overflow-hidden">
      <PlayerSlot
        name={player1Name}
        playerId={player1Id}
        isWinner={winnerId && winnerId === player1Id}
        isLoser={winnerId && winnerId !== player1Id}
      />
      <div className="border-t border-surface-200/60" />
      <PlayerSlot
        name={player2Name}
        playerId={player2Id}
        isWinner={winnerId && winnerId === player2Id}
        isLoser={winnerId && winnerId !== player2Id}
      />
    </div>
  );
}

function PlayerSlot({ name, playerId, isWinner, isLoser }) {
  if (!playerId) {
    return (
      <div className="px-3 py-2 font-mono text-[11px] text-surface-300 italic">
        BYE
      </div>
    );
  }

  return (
    <div
      className={`px-3 py-2 font-body text-[13px] flex items-center gap-2 transition-colors
        ${isWinner ? "bg-green-950/40 text-green-400 font-semibold" : ""}
        ${isLoser ? "text-surface-400" : ""}
        ${!isWinner && !isLoser ? "text-surface-700" : ""}`}
    >
      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[9px] text-brand-300 shrink-0">
        {name?.[0]?.toUpperCase() || "?"}
      </span>
      <span className="truncate">{name || "TBD"}</span>
      {isWinner && <span className="ml-auto text-[10px]">W</span>}
    </div>
  );
}
