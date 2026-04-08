import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from "../api/client";

const SportContext = createContext(null);

const SPORTS = [
  { key: "ping_pong", label: "Ping Pong", emoji: "\u{1F3D3}", ratingSystem: "elo" },
  { key: "pickleball", label: "Pickleball", emoji: "\u{1F94F}", ratingSystem: "utr" },
  { key: "tennis", label: "Tennis", emoji: "\u{1F3BE}", ratingSystem: "utr" },
];

const RATING_TYPES = [
  { key: "skill", label: "Skill" },
  { key: "league", label: "League" },
  { key: "tournament", label: "Tournament" },
];

export function SportProvider({ children }) {
  const { player } = useAuth();
  const [sport, setSportState] = useState(
    () => localStorage.getItem("lsc_sport") || "ping_pong"
  );

  // Sync from player's default_sport on login
  useEffect(() => {
    if (player?.default_sport) {
      setSportState(player.default_sport);
      localStorage.setItem("lsc_sport", player.default_sport);
    }
  }, [player?.default_sport]);

  const setSport = useCallback((newSport) => {
    setSportState(newSport);
    localStorage.setItem("lsc_sport", newSport);
    // Persist to server (fire and forget)
    api.patch("/players/me/default-sport", { sport: newSport }).catch(() => {});
  }, []);

  const sportConfig = SPORTS.find((s) => s.key === sport) || SPORTS[0];

  return (
    <SportContext.Provider
      value={{
        sport,
        setSport,
        sportLabel: sportConfig.label,
        sportEmoji: sportConfig.emoji,
        ratingSystem: sportConfig.ratingSystem,
        isUtr: sportConfig.ratingSystem === "utr",
        ratingLabel: sportConfig.ratingSystem === "utr" ? "UTR" : "Elo",
        defaultRating: sportConfig.ratingSystem === "utr" ? 1.0 : 1000, // fallback; backend reads from DB
        SPORTS,
        RATING_TYPES,
      }}
    >
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  const ctx = useContext(SportContext);
  if (!ctx) throw new Error("useSport must be used within SportProvider");
  return ctx;
}
