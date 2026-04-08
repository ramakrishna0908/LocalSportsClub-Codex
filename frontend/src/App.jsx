import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SportProvider } from "./context/SportContext";
import Header from "./components/Header";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RecordMatch from "./pages/RecordMatch";
import Rankings from "./pages/Rankings";
import MatchHistory from "./pages/MatchHistory";
import Leagues from "./pages/Leagues";
import LeagueDetail from "./pages/LeagueDetail";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import CompetitionHistory from "./pages/CompetitionHistory";
import Admin from "./pages/Admin";
import Analytics from "./pages/Analytics";
import Help from "./pages/Help";
import Clubs from "./pages/Clubs";
import ClubDetail from "./pages/ClubDetail";

function ProtectedRoute({ children }) {
  const { player, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">🏅</div>
          <p className="font-display text-lg text-surface-800">Loading...</p>
        </div>
      </div>
    );
  }
  if (!player) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { player, loading } = useAuth();
  if (loading) return null;
  if (player) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SportProvider>
            <div className="min-h-screen bg-surface-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(120,90,40,0.08)_0%,transparent_60%),radial-gradient(ellipse_at_80%_100%,rgba(60,40,20,0.06)_0%,transparent_50%)]">
              <Header />
              <main className="max-w-4xl mx-auto px-5 py-6 pb-16">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/record" element={<RecordMatch />} />
                  <Route path="/rankings" element={<Rankings />} />
                  <Route path="/leagues" element={<Leagues />} />
                  <Route path="/leagues/:id" element={<LeagueDetail />} />
                  <Route path="/tournaments" element={<Tournaments />} />
                  <Route path="/tournaments/:id" element={<TournamentDetail />} />
                  <Route path="/clubs" element={<Clubs />} />
                  <Route path="/clubs/:id" element={<ClubDetail />} />
                  <Route path="/history" element={<CompetitionHistory />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            </SportProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
