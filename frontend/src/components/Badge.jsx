const colorMap = {
  green: "bg-green-950 text-green-400 border-green-800",
  red: "bg-red-950 text-red-400 border-red-800",
  blue: "bg-blue-950 text-blue-400 border-blue-800",
  amber: "bg-amber-950 text-amber-400 border-amber-800",
  slate: "bg-surface-100 text-surface-600 border-surface-300",
};

export default function Badge({ children, color = "slate" }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border whitespace-nowrap ${colorMap[color] || colorMap.slate}`}
    >
      {children}
    </span>
  );
}
