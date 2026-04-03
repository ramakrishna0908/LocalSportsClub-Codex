import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.username || !form.displayName || !form.password) {
      return setError("Please fill in all required fields");
    }
    if (form.username.length < 3) {
      return setError("Username must be at least 3 characters");
    }
    if (form.password.length < 6) {
      return setError("Password must be at least 6 characters");
    }
    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);
    try {
      await register({
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        email: form.email,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
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
            Create your account and start tracking
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-6">
          <h2 className="font-display text-xl text-surface-900 mb-6">
            Register
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                  Username *
                </label>
                <input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  placeholder="john_doe"
                  autoFocus
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                  Display Name *
                </label>
                <input
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                Email (optional)
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="john@example.com"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1.5">
                  Confirm *
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3.5 py-2.5 text-surface-800 font-body text-sm"
                />
              </div>
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
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center font-body text-xs text-surface-500 mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
