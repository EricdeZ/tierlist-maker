// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import DivisionLayout from './components/layout/DivisionLayout'
import Homepage from './pages/Homepage'
import NotFound from './pages/NotFound'

// Division pages
import DivisionOverview from './pages/division/DivisionOverview'
import Standings from './pages/division/Standings'
import Matches from './pages/division/Matches'
import MatchDetail from './pages/division/MatchDetail'
import Teams from './pages/division/Teams'
import TeamDetail from './pages/division/TeamDetail'
import PlayerProfile from './pages/division/PlayerProfile'
import Stats from "./pages/Stats.jsx";
import Rankings from "./pages/Rankings.jsx";
import LeagueOverview from "./pages/LeagueOverview.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";

// Admin
import AdminLanding from "./pages/admin/AdminLanding.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import RosterManager from "./pages/admin/RosterManager.jsx";
import MatchManager from "./pages/admin/MatchManager.jsx";
import PlayerManager from "./pages/admin/PlayerManager.jsx";
import LeagueManager from "./pages/admin/LeagueManager.jsx";
import UserManager from "./pages/admin/UserManager.jsx";
import ClaimManager from "./pages/admin/ClaimManager.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import DraftSimulator from "./pages/DraftSimulator.jsx";
import TierListPage from "./pages/TierListPage.jsx";

function App() {
    return (
        <AuthProvider>
            <Router>
                <ScrollToTop />
                <ErrorBoundary>
                    <Routes>
                        <Route path="/" element={<AppLayout />}>
                            {/* Homepage — league & division selector */}
                            <Route index element={<Homepage />} />

                            {/* Admin pages (protected) */}
                            <Route path="admin" element={<ProtectedRoute requireAdmin><AdminLanding /></ProtectedRoute>} />
                            <Route path="admin/matchreport" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
                            <Route path="admin/rosters" element={<ProtectedRoute requireAdmin><RosterManager /></ProtectedRoute>} />
                            <Route path="admin/matches" element={<ProtectedRoute requireAdmin><MatchManager /></ProtectedRoute>} />
                            <Route path="admin/players" element={<ProtectedRoute requireAdmin><PlayerManager /></ProtectedRoute>} />
                            <Route path="admin/leagues" element={<ProtectedRoute requireAdmin><LeagueManager /></ProtectedRoute>} />
                            <Route path="admin/users" element={<ProtectedRoute requireAdmin><UserManager /></ProtectedRoute>} />
                            <Route path="admin/claims" element={<ProtectedRoute requireAdmin><ClaimManager /></ProtectedRoute>} />

                            {/* Draft simulator */}
                            <Route path="draft" element={<DraftSimulator />} />

                            {/* Standalone tier list */}
                            <Route path="tierlist" element={<TierListPage />} />

                            {/* Enhanced player profile (cross-season) */}
                            <Route path="profile/:playerSlug" element={<ProfilePage />} />

                            {/* League overview page */}
                            <Route path=":leagueSlug" element={<LeagueOverview />} />

                            {/* Division-scoped pages (context provided by DivisionLayout) */}
                            <Route path=":leagueSlug/:divisionSlug" element={<DivisionLayout />}>
                                <Route index element={<DivisionOverview />} />
                                <Route path="standings" element={<Standings />} />
                                <Route path="matches" element={<Matches />} />
                                <Route path="matches/:matchId" element={<MatchDetail />} />
                                <Route path="stats" element={<Stats />} />
                                <Route path="rankings" element={<Rankings />} />
                                <Route path="teams" element={<Teams />} />
                                <Route path="teams/:teamSlug" element={<TeamDetail />} />
                                <Route path="players/:playerSlug" element={<PlayerProfile />} />
                            </Route>

                            {/* 404 */}
                            <Route path="*" element={<NotFound />} />
                        </Route>
                    </Routes>
                </ErrorBoundary>
            </Router>
        </AuthProvider>
    )
}

export default App
