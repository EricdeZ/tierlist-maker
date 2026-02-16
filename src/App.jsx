// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PassionProvider } from './context/PassionContext'
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
import LeaguesBrowse from "./pages/LeaguesBrowse.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";

// Admin
import AdminLayout from './components/layout/AdminLayout'
import AdminLanding from "./pages/admin/AdminLanding.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import RosterManager from "./pages/admin/RosterManager.jsx";
import MatchManager from "./pages/admin/MatchManager.jsx";
import PlayerManager from "./pages/admin/PlayerManager.jsx";
import LeagueManager from "./pages/admin/LeagueManager.jsx";
import UserManager from "./pages/admin/UserManager.jsx";
import ClaimManager from "./pages/admin/ClaimManager.jsx";
import PermissionManager from "./pages/admin/PermissionManager.jsx";
import AuditLog from "./pages/admin/AuditLog.jsx";
import ScheduleManager from "./pages/admin/ScheduleManager.jsx";
import DiscordQueue from "./pages/admin/DiscordQueue.jsx";
import DiscordReview from "./pages/admin/DiscordReview.jsx";
import BannedContentManager from "./pages/admin/BannedContentManager.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import DraftSimulator from "./pages/DraftSimulator.jsx";
import TierListPage from "./pages/TierListPage.jsx";
import PassionLeaderboard from "./pages/PassionLeaderboard.jsx";
import Challenges from "./pages/Challenges.jsx";
import CoinFlip from "./pages/CoinFlip.jsx";
import PassionShop from "./pages/PassionShop.jsx";
import ChallengeManager from "./pages/admin/ChallengeManager.jsx";
import DebugTools from "./pages/admin/DebugTools.jsx";
import Predictions from "./pages/Predictions.jsx";
import MatchupDetail from "./pages/MatchupDetail.jsx";
import FeaturedStream from "./pages/FeaturedStream.jsx";

function App() {
    return (
        <AuthProvider>
            <Router>
            <PassionProvider>
                <ScrollToTop />
                <ErrorBoundary>
                    <Routes>
                        <Route path="/" element={<AppLayout />}>
                            {/* Homepage — league & division selector */}
                            <Route index element={<Homepage />} />

                            {/* Admin pages (nested under AdminLayout with shared navbar) */}
                            <Route path="admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                                <Route index element={<AdminLanding />} />
                                <Route path="matchreport" element={<ProtectedRoute requiredPermission="match_report"><AdminDashboard /></ProtectedRoute>} />
                                <Route path="rosters" element={<ProtectedRoute requiredPermission="roster_manage"><RosterManager /></ProtectedRoute>} />
                                <Route path="matches" element={<ProtectedRoute requiredPermission="match_manage"><MatchManager /></ProtectedRoute>} />
                                <Route path="players" element={<ProtectedRoute requiredPermission="player_manage"><PlayerManager /></ProtectedRoute>} />
                                <Route path="leagues" element={<ProtectedRoute requiredPermission="league_manage"><LeagueManager /></ProtectedRoute>} />
                                <Route path="users" element={<ProtectedRoute requiredPermission="user_manage"><UserManager /></ProtectedRoute>} />
                                <Route path="claims" element={<ProtectedRoute requiredPermission="claim_manage"><ClaimManager /></ProtectedRoute>} />
                                <Route path="permissions" element={<ProtectedRoute requiredPermission="permission_manage"><PermissionManager /></ProtectedRoute>} />
                                <Route path="auditlog" element={<ProtectedRoute requiredPermission="audit_log_view"><AuditLog /></ProtectedRoute>} />
                                <Route path="schedule" element={<ProtectedRoute requiredPermission="match_schedule"><ScheduleManager /></ProtectedRoute>} />
                                <Route path="discord" element={<ProtectedRoute requiredPermission="match_report"><DiscordQueue /></ProtectedRoute>} />
                                <Route path="discord-review" element={<ProtectedRoute requiredPermission="match_report"><DiscordReview /></ProtectedRoute>} />
                                <Route path="banned-content" element={<ProtectedRoute requiredPermission="league_manage"><BannedContentManager /></ProtectedRoute>} />
                                <Route path="challenges" element={<ProtectedRoute requiredPermission="league_manage"><ChallengeManager /></ProtectedRoute>} />
                                <Route path="debug" element={<ProtectedRoute requiredPermission="permission_manage"><DebugTools /></ProtectedRoute>} />
                            </Route>

                            {/* Passion pages */}
                            <Route path="leaderboard" element={<PassionLeaderboard />} />
                            <Route path="challenges" element={<Challenges />} />
                            <Route path="coinflip" element={<CoinFlip />} />
                            <Route path="shop" element={<PassionShop />} />
                            <Route path="predictions" element={<Predictions />} />
                            <Route path="matchup/:scheduledMatchId" element={<MatchupDetail />} />

                            {/* Featured stream */}
                            <Route path="twitch" element={<FeaturedStream />} />

                            {/* Draft simulator */}
                            <Route path="draft" element={<DraftSimulator />} />

                            {/* Standalone tier list */}
                            <Route path="tierlist" element={<TierListPage />} />

                            {/* Enhanced player profile (cross-season) */}
                            <Route path="profile/:playerSlug" element={<ProfilePage />} />

                            {/* All leagues browse page */}
                            <Route path="leagues" element={<LeaguesBrowse />} />

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
            </PassionProvider>
            </Router>
        </AuthProvider>
    )
}

export default App
