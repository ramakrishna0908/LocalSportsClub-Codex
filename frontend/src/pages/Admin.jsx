import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function formatName(displayName) {
  if (!displayName) return "";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

const roleColors = {
  admin: "text-red-400 bg-red-950/30 border-red-800",
  director: "text-blue-400 bg-blue-950/30 border-blue-800",
  user: "text-surface-400 bg-surface-100 border-surface-300",
};

const roleLabels = { admin: "Admin", director: "Director", user: "User" };

export default function Admin() {
  const { player } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [msg, setMsg] = useState(null);
  const [groupShuffleMode, setGroupShuffleMode] = useState("both");
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/players")
      .then((res) => setPlayers(res.data.players))
      .catch(console.error)
      .finally(() => setLoading(false));
    api
      .get("/settings")
      .then((res) => {
        setGroupShuffleMode(res.data.settings?.group_shuffle_mode || "both");
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false));
  }, []);

  const handleRoleChange = async (playerId, newRole) => {
    setUpdating(playerId);
    setMsg(null);
    try {
      await api.patch("/auth/role", { playerId, role: newRole });
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, role: newRole } : p))
      );
      setMsg({ text: "Role updated", ok: true });
    } catch (err) {
      setMsg({ text: err.response?.data?.error || "Failed to update role", ok: false });
    } finally {
      setUpdating(null);
      setTimeout(() => setMsg(null), 2000);
    }
  };

  const handleGroupModeChange = async (newMode) => {
    try {
      await api.patch("/settings", { key: "group_shuffle_mode", value: newMode });
      setGroupShuffleMode(newMode);
      setMsg({ text: "Setting updated", ok: true });
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      setMsg({ text: err.response?.data?.error || "Failed to update setting", ok: false });
    }
  };

  if (player?.role !== "admin") {
    return (
      <p className="text-center text-surface-400 font-body text-sm py-8">
        Admin access required
      </p>
    );
  }

  return (
    <div>
      {/* Club Settings */}
      <h2 className="font-display text-2xl text-surface-900 mb-6">
        Club Settings
      </h2>

      <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-body text-sm text-surface-700 font-semibold">
              Group Shuffle Mode
            </h3>
            <p className="font-body text-[11px] text-surface-400 mt-1">
              Controls which grouping methods directors can use when shuffling league groups.
            </p>
          </div>
          <div className="flex gap-1 bg-surface-50 rounded-lg p-1 border border-surface-200">
            {[
              { key: "sequential", label: "Tiered Only" },
              { key: "snake", label: "Balanced Only" },
              { key: "both", label: "Both" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleGroupModeChange(opt.key)}
                className={`px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold transition-all
                  ${groupShuffleMode === opt.key
                    ? "bg-surface-200 text-brand-300"
                    : "text-surface-400 hover:text-surface-600"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
            <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1">Tiered</p>
            <p className="font-body text-[11px] text-surface-500">
              Top ranked in Group A, next tier in Group B. Creates skill-based divisions.
            </p>
          </div>
          <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
            <p className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-1">Balanced</p>
            <p className="font-body text-[11px] text-surface-500">
              Snake draft spreads top players across all groups for competitive balance.
            </p>
          </div>
        </div>
      </div>

      <h2 className="font-display text-2xl text-surface-900 mb-6">
        User Management
      </h2>

      {msg && (
        <p className={`font-body text-sm mb-4 ${msg.ok ? "text-green-400" : "text-red-400"}`}>
          {msg.text}
        </p>
      )}

      {loading ? (
        <p className="text-center text-surface-400 font-body text-sm py-8">Loading...</p>
      ) : (
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-surface-400 uppercase tracking-widest">
                  Player
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-surface-400 uppercase tracking-widest">
                  Username
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-surface-400 uppercase tracking-widest">
                  Current Role
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-surface-400 uppercase tracking-widest">
                  Change Role
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-surface-200/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-800 to-brand-900 border border-brand-700 flex items-center justify-center font-display font-bold text-[10px] text-brand-300">
                        {p.display_name?.[0]?.toUpperCase() || "?"}
                      </span>
                      <span className="font-body text-sm text-surface-700">
                        {formatName(p.display_name)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">
                    @{p.username}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-mono ${roleColors[p.role] || roleColors.user}`}>
                      {roleLabels[p.role] || p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.id === player.id ? (
                      <span className="font-mono text-[10px] text-surface-400">You</span>
                    ) : (
                      <div className="flex gap-1">
                        {["admin", "director", "user"].map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(p.id, role)}
                            disabled={p.role === role || updating === p.id}
                            className={`px-2 py-1 rounded text-[11px] font-mono transition-all
                              ${p.role === role
                                ? "opacity-30 cursor-default bg-surface-200 text-surface-500"
                                : "bg-surface-50 border border-surface-300 text-surface-600 hover:text-surface-800 hover:border-surface-400"
                              } ${updating === p.id ? "opacity-50" : ""}`}
                          >
                            {roleLabels[role]}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
