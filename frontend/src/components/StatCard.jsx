export default function StatCard({ label, value, sub, accentClass = "text-brand-300" }) {
  return (
    <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
      <div className="font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
        {label}
      </div>
      <div className={`font-display text-3xl tracking-tight ${accentClass}`}>
        {value}
      </div>
      <div className="font-body text-[11px] text-surface-400 mt-1">{sub}</div>
    </div>
  );
}
