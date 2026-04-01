import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/record", label: "Record", icon: "✏️" },
  { to: "/rankings", label: "Rankings", icon: "🏆" },
  { to: "/history", label: "History", icon: "📋" },
];

export default function Header() {
  const { player, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-surface-0/90 backdrop-blur-md border-b border-surface-200">
      <div className="max-w-4xl mx-auto px-5 py-2.5 flex items-center justify-between flex-wrap gap-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏓</span>
          <span className="font-display text-base text-surface-900">
            Ping Pong Club
          </span>
        </div>

        {/* Nav */}
        <nav className="flex gap-0.5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-body transition-all
                ${isActive ? "bg-surface-200/60 text-brand-300" : "text-surface-400 hover:text-surface-600"}`
              }
            >
              <span className="text-sm">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-xs text-brand-300">
            {player?.display_name?.[0]?.toUpperCase() || "?"}
          </span>
          <span className="font-body text-xs text-surface-600">
            {player?.display_name}
          </span>
          <button
            onClick={logout}
            className="text-surface-500 hover:text-surface-700 text-sm px-1"
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </div>
    </header>
  );
}
