import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSport } from "../context/SportContext";
import api from "../api/client";

function formatName(displayName) {
  if (!displayName) return "";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

const baseTabs = [
  { to: "/", label: "Dashboard", icon: "\u{1F4CA}" },
  { to: "/record", label: "Record", icon: "\u270F\uFE0F" },
  { to: "/rankings", label: "Rankings", icon: "\u{1F3C6}" },
  { to: "/leagues", label: "Leagues", icon: "\u{1F3C5}" },
  { to: "/tournaments", label: "Tourneys", icon: "\u{1F3AF}" },
  { to: "/history", label: "History", icon: "\u{1F4CB}" },
];

export default function Header() {
  const { player, logout } = useAuth();
  const { sport, setSport, sportLabel, sportEmoji, SPORTS } = useSport();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);
  const menuRef = useRef(null);
  const tabs = player?.role === "admin"
    ? [...baseTabs, { to: "/admin", label: "Admin", icon: "\u2699\uFE0F" }]
    : baseTabs;

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setShowPasswordForm(false);
        setPwMsg(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) {
      return setPwMsg({ text: "Fill in all fields", ok: false });
    }
    if (pwForm.new.length < 6) {
      return setPwMsg({ text: "New password must be at least 6 characters", ok: false });
    }
    if (pwForm.new !== pwForm.confirm) {
      return setPwMsg({ text: "New passwords do not match", ok: false });
    }
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: pwForm.current,
        newPassword: pwForm.new,
      });
      setPwMsg({ text: "Password changed!", ok: true });
      setPwForm({ current: "", new: "", confirm: "" });
      setTimeout(() => {
        setShowPasswordForm(false);
        setPwMsg(null);
      }, 1500);
    } catch (err) {
      setPwMsg({ text: err.response?.data?.error || "Failed", ok: false });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-0/90 backdrop-blur-md border-b border-surface-200">
      <div className="max-w-4xl mx-auto px-5 py-2.5 flex items-center justify-between flex-wrap gap-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{sportEmoji}</span>
          <span className="font-display text-base text-surface-900">
            {sportLabel} Club
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

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setShowPasswordForm(false); setPwMsg(null); }}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-surface-100 transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-xs text-brand-300">
              {player?.display_name?.[0]?.toUpperCase() || "?"}
            </span>
            <span className="font-body text-xs text-surface-600">
              {formatName(player?.display_name)}
            </span>
            <span className={`text-surface-400 text-[10px] transition-transform ${menuOpen ? "rotate-180" : ""}`}>
              {"\u25BC"}
            </span>
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface-100 border border-surface-200 rounded-xl shadow-lg overflow-hidden z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="font-body text-sm text-surface-800 font-semibold">{formatName(player?.display_name)}</p>
                <p className="font-mono text-[10px] text-surface-400">@{player?.username}</p>
              </div>

              {/* Sport Selection */}
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-2">
                  Switch Sport
                </p>
                <div className="flex flex-col gap-1">
                  {SPORTS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => { setSport(s.key); setMenuOpen(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all
                        ${sport === s.key
                          ? "bg-surface-200 text-surface-800"
                          : "text-surface-500 hover:bg-surface-50 hover:text-surface-700"
                        }`}
                    >
                      <span className="text-base">{s.emoji}</span>
                      <span className="font-body text-sm">{s.label}</span>
                      {sport === s.key && (
                        <span className="ml-auto font-mono text-[10px] text-brand-300">{"\u2713"} Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Sport */}
              <div className="px-4 py-3 border-b border-surface-200">
                <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-2">
                  Default Sport
                </p>
                <select
                  value={player?.default_sport || "ping_pong"}
                  onChange={(e) => {
                    setSport(e.target.value);
                  }}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-sm"
                >
                  {SPORTS.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Change Password */}
              <div className="px-4 py-3 border-b border-surface-200">
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="flex items-center gap-2.5 w-full text-left text-surface-500 hover:text-surface-700 transition-all"
                  >
                    <span className="text-sm">{"\u{1F512}"}</span>
                    <span className="font-body text-sm">Change Password</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest">
                      Change Password
                    </p>
                    <input
                      type="password"
                      value={pwForm.current}
                      onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                      placeholder="Current password"
                      className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-xs"
                    />
                    <input
                      type="password"
                      value={pwForm.new}
                      onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })}
                      placeholder="New password"
                      className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-xs"
                    />
                    <input
                      type="password"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-surface-800 font-body text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="flex-1 bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-1.5 text-surface-900 font-display font-bold text-xs disabled:opacity-50"
                      >
                        {pwLoading ? "Saving..." : "Update"}
                      </button>
                      <button
                        onClick={() => { setShowPasswordForm(false); setPwMsg(null); setPwForm({ current: "", new: "", confirm: "" }); }}
                        className="px-3 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-surface-500 font-body text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    {pwMsg && (
                      <p className={`font-body text-xs text-center ${pwMsg.ok ? "text-green-400" : "text-red-400"}`}>
                        {pwMsg.text}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Sign Out */}
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-red-400 hover:bg-red-950/30 transition-all"
              >
                <span className="text-sm">{"\u23FB"}</span>
                <span className="font-body text-sm">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
