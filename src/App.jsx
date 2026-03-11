// src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
import TierListFeed from "./pages/division/TierListFeed.jsx";
import Transactions from "./pages/division/Transactions.jsx"
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
import ReferralPage from "./pages/ReferralPage.jsx";
import ChallengeManager from "./pages/admin/ChallengeManager.jsx";
import DebugTools from "./pages/admin/DebugTools.jsx";
import DataReportManager from "./pages/admin/DataReportManager.jsx";
import Predictions from "./pages/Predictions.jsx";
import MatchupDetail from "./pages/MatchupDetail.jsx";
import FeaturedStream from "./pages/FeaturedStream.jsx"
import AGLSignup from "./pages/AGLSignup.jsx";
import OrgPage from "./pages/OrgPage.jsx";
import OrgManager from "./pages/admin/OrgManager.jsx";
import FantasyForge from "./pages/FantasyForge.jsx";
import ForgePlayerPage from "./pages/forge/ForgePlayerPage.jsx";
import GodTierList from "./pages/GodTierList.jsx";
import ScrimPlanner from "./pages/ScrimPlanner.jsx";
import MyTeams from "./pages/MyTeams.jsx";
import TheArcade from "./pages/TheArcade.jsx";
import Feedback from "./pages/Feedback.jsx";
import Support from "./pages/Support.jsx";
import FeedbackManager from "./pages/admin/FeedbackManager.jsx";
import TeamManager from "./pages/admin/TeamManager.jsx";
import ArcadeNpcManager from "./pages/admin/ArcadeNpcManager.jsx";
import LeagueStaff from "./pages/admin/LeagueStaff.jsx";
import DiscordRosterSync from "./pages/admin/DiscordRosterSync.jsx";
import RoleSync from "./pages/admin/RoleSync.jsx";
import ForgeConfig from "./pages/admin/ForgeConfig.jsx";
import ForgeAdmin from "./pages/admin/ForgeAdmin.jsx";
import ReferralManager from "./pages/admin/ReferralManager.jsx";
import CommunityTeamAdmin from "./pages/admin/CommunityTeamAdmin.jsx";
import ScrimAdmin from "./pages/admin/ScrimAdmin.jsx";
import StageManager from "./pages/admin/StageManager.jsx";
import StaffSettings from "./pages/admin/StaffSettings.jsx";
import SingleMatchReport from "./pages/admin/SingleMatchReport.jsx";
import CardPreview from "./pages/admin/CardPreview.jsx";
import VaultAdmin from "./pages/admin/VaultAdmin.jsx";
import VendingRestock from "./pages/admin/VendingRestock.jsx";
import PackCreator from "./pages/admin/PackCreator.jsx";
import RedeemCodes from "./pages/admin/RedeemCodes.jsx";
import Features from "./pages/Features.jsx";
import Players from "./pages/Players.jsx";
import SnoozOverlay from "./pages/SnoozOverlay.jsx";
import VaultPage from "./pages/VaultPage.jsx";
import CardSharePage from "./pages/vault/CardSharePage.jsx";
const BinderSharePage = lazy(() => import("./pages/vault/BinderSharePage.jsx"));
import BgRemover from "./pages/BgRemover.jsx";
// Codex
import CodexLayout from './components/layout/CodexLayout'
import CodexDashboard from "./pages/codex/CodexDashboard.jsx";
import CodexItems from "./pages/codex/CodexItems.jsx";
import CodexGods from "./pages/codex/CodexGods.jsx";
import CodexImages from "./pages/codex/CodexImages.jsx";
import CodexWordle from "./pages/codex/CodexWordle.jsx";

function App() {
    return (
        <AuthProvider>
            <Router>
            <PassionProvider>
                <ScrollToTop />
                <ErrorBoundary>
                    <Routes>
                        {/* Stream overlay — standalone, no app chrome */}
                        <Route path="snooz/:week" element={<SnoozOverlay />} />

                        {/* Card Clash share — standalone, no app chrome */}
                        <Route path="vault/share/:token" element={<CardSharePage />} />
                        <Route path="vault/binder/:token" element={<Suspense fallback={null}><BinderSharePage /></Suspense>} />

                        <Route path="/" element={<AppLayout />}>
                            {/* Homepage — league & division selector */}
                            <Route index element={<Homepage />} />

                            {/* Admin pages (nested under AdminLayout with shared navbar) */}
                            <Route path="admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                                <Route index element={<AdminLanding />} />
                                <Route path="matchreport" element={<ProtectedRoute requiredPermission="match_report"><AdminDashboard /></ProtectedRoute>} />
                                <Route path="matchreport/:scheduledMatchId" element={<ProtectedRoute requiredPermission="match_report"><AdminDashboard /></ProtectedRoute>} />
                                <Route path="report/:scheduledMatchId" element={<ProtectedRoute requiredPermission="match_report"><SingleMatchReport /></ProtectedRoute>} />
                                <Route path="rosters" element={<ProtectedRoute requiredPermission="roster_manage"><RosterManager /></ProtectedRoute>} />
                                <Route path="matches" element={<ProtectedRoute requiredPermission={["match_manage", "match_manage_own"]}><MatchManager /></ProtectedRoute>} />
                                <Route path="matches/:matchId" element={<ProtectedRoute requiredPermission={["match_manage", "match_manage_own"]}><MatchManager /></ProtectedRoute>} />
                                <Route path="players" element={<ProtectedRoute requiredPermission="player_manage"><PlayerManager /></ProtectedRoute>} />
                                <Route path="leagues" element={<ProtectedRoute requiredPermission="league_manage"><LeagueManager /></ProtectedRoute>} />
                                <Route path="users" element={<ProtectedRoute requiredPermission="user_manage"><UserManager /></ProtectedRoute>} />
                                <Route path="claims" element={<ProtectedRoute requiredPermission="claim_manage"><ClaimManager /></ProtectedRoute>} />
                                <Route path="permissions" element={<ProtectedRoute requiredPermission="permission_manage"><PermissionManager /></ProtectedRoute>} />
                                <Route path="auditlog" element={<ProtectedRoute requiredPermission="audit_log_view"><AuditLog /></ProtectedRoute>} />
                                <Route path="schedule" element={<ProtectedRoute requiredPermission="match_schedule"><ScheduleManager /></ProtectedRoute>} />
                                <Route path="stages" element={<ProtectedRoute requiredPermission="match_schedule"><StageManager /></ProtectedRoute>} />
                                <Route path="discord" element={<ProtectedRoute requiredPermission="match_report"><DiscordQueue /></ProtectedRoute>} />
                                <Route path="discord-review" element={<ProtectedRoute requiredPermission="match_report"><DiscordReview /></ProtectedRoute>} />
                                <Route path="banned-content" element={<ProtectedRoute requiredPermission="league_manage"><BannedContentManager /></ProtectedRoute>} />
                                <Route path="challenges" element={<ProtectedRoute requiredPermission="league_manage"><ChallengeManager /></ProtectedRoute>} />
                                <Route path="debug" element={<ProtectedRoute requiredPermission="permission_manage"><DebugTools /></ProtectedRoute>} />
                                <Route path="forge-config" element={<ProtectedRoute requiredPermission="league_manage"><ForgeConfig /></ProtectedRoute>} />
                                <Route path="forge-admin" element={<ProtectedRoute requiredPermission="permission_manage"><ForgeAdmin /></ProtectedRoute>} />
                                <Route path="data-reports" element={<ProtectedRoute requiredPermission="league_manage"><DataReportManager /></ProtectedRoute>} />
                                <Route path="orgs" element={<ProtectedRoute requiredPermission="league_manage"><OrgManager /></ProtectedRoute>} />
                                <Route path="feedback" element={<ProtectedRoute requiredPermission="feedback_manage"><FeedbackManager /></ProtectedRoute>} />
                                <Route path="teams" element={<ProtectedRoute requiredPermission="team_manage"><TeamManager /></ProtectedRoute>} />
                                <Route path="leaguestaff" element={<ProtectedRoute requiredPermission="league_staff_manage"><LeagueStaff /></ProtectedRoute>} />
                                <Route path="roster-sync" element={<ProtectedRoute requiredPermission="roster_manage"><DiscordRosterSync /></ProtectedRoute>} />
                                <Route path="role-sync" element={<ProtectedRoute requiredPermission="roster_manage"><RoleSync /></ProtectedRoute>} />
                                <Route path="arcade-npcs" element={<ProtectedRoute requiredPermission="league_manage"><ArcadeNpcManager /></ProtectedRoute>} />
                                <Route path="referrals" element={<ProtectedRoute requiredPermission="league_manage"><ReferralManager /></ProtectedRoute>} />
                                <Route path="community-teams" element={<ProtectedRoute requiredPermission="league_manage"><CommunityTeamAdmin /></ProtectedRoute>} />
                                <Route path="scrim-admin" element={<ProtectedRoute requiredPermission="league_manage"><ScrimAdmin /></ProtectedRoute>} />
                                <Route path="card-preview" element={<ProtectedRoute requiredPermission="permission_manage"><CardPreview /></ProtectedRoute>} />
                                <Route path="vault" element={<ProtectedRoute requiredPermission="cardclash_manage"><VaultAdmin /></ProtectedRoute>} />
                                <Route path="vending-restock" element={<ProtectedRoute requiredPermission="permission_manage"><VendingRestock /></ProtectedRoute>} />
                                <Route path="pack-creator" element={<ProtectedRoute requiredPermission="permission_manage"><PackCreator /></ProtectedRoute>} />
                                <Route path="redeem-codes" element={<ProtectedRoute requiredPermission="permission_manage"><RedeemCodes /></ProtectedRoute>} />
                                <Route path="settings" element={<StaffSettings />} />
                            </Route>

                            {/* Codex pages (nested under CodexLayout with shared navbar) */}
                            <Route path="codex" element={<ProtectedRoute requiredPermission="codex_edit" redirectTo="/"><CodexLayout /></ProtectedRoute>}>
                                <Route index element={<CodexDashboard />} />
                                <Route path="items" element={<CodexItems />} />
                                <Route path="gods" element={<CodexGods />} />
                                <Route path="wordle" element={<CodexWordle />} />
                                <Route path="images" element={<CodexImages />} />
                            </Route>

                            {/* Passion pages */}
                            <Route path="leaderboard" element={<PassionLeaderboard />} />
                            <Route path="challenges" element={<Challenges />} />
                            <Route path="coinflip" element={<CoinFlip />} />
                            <Route path="shop" element={<PassionShop />} />
                            <Route path="referral" element={<ReferralPage />} />
                            <Route path="predictions" element={<Predictions />} />
                            <Route path="matchup/:scheduledMatchId" element={<MatchupDetail />} />
                            <Route path="forge" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/portfolio" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/leaderboard" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/challenges" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/wiki" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug/portfolio" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug/leaderboard" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug/challenges" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug/wiki" element={<FantasyForge />} />
                            <Route path="forge/:leagueSlug/:divisionSlug/player/:playerSlug" element={<ForgePlayerPage />} />
                            <Route path="vault" element={<VaultPage />} />
                            <Route path="scrims" element={<ScrimPlanner />} />
                            <Route path="team" element={<MyTeams />} />
                            <Route path="bring-your-own-team" element={<MyTeams />} />
                            <Route path="arcade" element={<TheArcade />} />
                            <Route path="arcade/:lobbyId" element={<TheArcade />} />
                            <Route path="feedback" element={<Feedback />} />
                            <Route path="support" element={<Support />} />
                            <Route path="features" element={<Features />} />
                            <Route path="players" element={<Players />} />
                            <Route path="transactions" element={<Transactions />} />
                            <Route path="bg-remove" element={<BgRemover />} />
                            {/* Featured stream */}
                            <Route path="twitch" element={<FeaturedStream />} />

                            {/* Draft simulator */}
                            <Route path="draft" element={<DraftSimulator />} />

                            {/* Standalone tier list */}
                            <Route path="tierlist" element={<TierListPage />} />

                            {/* God tier list */}
                            <Route path="god-tierlist" element={<GodTierList />} />

                            {/* Enhanced player profile (cross-season) */}
                            <Route path="profile/:playerSlug" element={<ProfilePage />} />

                            {/* AGL signup page */}
                            <Route path="agl/signup" element={<AGLSignup />} />

                            {/* Organization page */}
                            <Route path="org/:orgSlug" element={<OrgPage />} />

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
                                <Route path="tierlist" element={<TierListFeed />} />
                                <Route path="tierlist/create" element={<Rankings />} />
                                <Route path="rankings" element={<Navigate to="../tierlist" replace />} />
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
