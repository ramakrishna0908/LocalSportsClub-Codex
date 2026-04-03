import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return setError("Please fill in all fields");
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-1">{"\u{1F3C5}"}</div>
          <h1 className="font-display text-3xl text-surface-900 tracking-tight">
            Local Sports Club
          </h1>
          <p className="font-body text-sm text-surface-500 mt-2">
            Track your games. Climb the ranks.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-6">
          <h2 className="font-display text-xl text-surface-900 mb-6">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoFocus
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-900 rounded-lg px-3.5 py-2.5 text-red-400 font-body text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-700 to-brand-600 border border-brand-500 rounded-lg py-2.5 text-surface-900 font-display font-bold text-sm disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center font-body text-xs text-surface-500 mt-5">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-300 hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
