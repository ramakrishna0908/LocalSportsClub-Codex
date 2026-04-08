import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem("lsc_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setPlayer(res.data.player))
      .catch(() => localStorage.removeItem("lsc_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (username, password) => {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("lsc_token", res.data.token);
      setPlayer(res.data.player);
      navigate("/");
    },
    [navigate]
  );

  const register = useCallback(
    async ({ username, displayName, password, email, sports }) => {
      const res = await api.post("/auth/register", {
        username,
        displayName,
        password,
        email: email || undefined,
        sports,
      });
      localStorage.setItem("lsc_token", res.data.token);
      setPlayer(res.data.player);
      navigate("/");
    },
    [navigate]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — token might already be invalid
    }
    localStorage.removeItem("lsc_token");
    setPlayer(null);
    navigate("/login");
  }, [navigate]);

  // Refresh player data (after match recorded, etc.)
  const refreshPlayer = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setPlayer(res.data.player);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{ player, loading, login, register, logout, refreshPlayer }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
