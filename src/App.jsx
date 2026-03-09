// src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PassionProvider } from './context/PassionContext'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import AdminLayout from './components/layout/AdminLayout'
import CodexLayout from './components/layout/CodexLayout'
import DivisionLayout from './components/layout/DivisionLayout'
import ScrollToTop from './components/ScrollToTop'

// Eager — critical path (first paint)
import Homepage from './pages/Homepage'
import NotFound from './pages/NotFound'

// Lazy page wrapper — each page gets its own chunk + Suspense boundary
function PageLoader() {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-gray-400">Loading...</div></div>
}

function lp(importFn) {
    const Component = lazy(importFn)
    return function LazyPage(props) {
        return <Suspense fallback={<PageLoader />}><Component {...props} /></Suspense>
    }
}

// ── Division pages ──
const DivisionOverview = lp(() => import('./pages/division/DivisionOverview'))
const Standings = lp(() => import('./pages/division/Standings'))
const Matches = lp(() => import('./pages/division/Matches'))
const MatchDetail = lp(() => import('./pages/division/MatchDetail'))
const Teams = lp(() => import('./pages/division/Teams'))
const TeamDetail = lp(() => import('./pages/division/TeamDetail'))
const PlayerProfile = lp(() => import('./pages/division/PlayerProfile'))
const Stats = lp(() => import('./pages/Stats'))
const Rankings = lp(() => import('./pages/Rankings'))
const TierListFeed = lp(() => import('./pages/division/TierListFeed'))
const Transactions = lp(() => import('./pages/division/Transactions'))
const LeagueOverview = lp(() => import('./pages/LeagueOverview'))
const LeaguesBrowse = lp(() => import('./pages/LeaguesBrowse'))

// ── Admin pages ──
const AdminLanding = lp(() => import('./pages/admin/AdminLanding'))
const AdminDashboard = lp(() => import('./pages/admin/AdminDashboard'))
const RosterManager = lp(() => import('./pages/admin/RosterManager'))
const MatchManager = lp(() => import('./pages/admin/MatchManager'))
const PlayerManager = lp(() => import('./pages/admin/PlayerManager'))
const LeagueManager = lp(() => import('./pages/admin/LeagueManager'))
const UserManager = lp(() => import('./pages/admin/UserManager'))
const ClaimManager = lp(() => import('./pages/admin/ClaimManager'))
const PermissionManager = lp(() => import('./pages/admin/PermissionManager'))
const AuditLog = lp(() => import('./pages/admin/AuditLog'))
const ScheduleManager = lp(() => import('./pages/admin/ScheduleManager'))
const DiscordQueue = lp(() => import('./pages/admin/DiscordQueue'))
const DiscordReview = lp(() => import('./pages/admin/DiscordReview'))
const BannedContentManager = lp(() => import('./pages/admin/BannedContentManager'))
const ChallengeManager = lp(() => import('./pages/admin/ChallengeManager'))
const DebugTools = lp(() => import('./pages/admin/DebugTools'))
const DataReportManager = lp(() => import('./pages/admin/DataReportManager'))
const OrgManager = lp(() => import('./pages/admin/OrgManager'))
const FeedbackManager = lp(() => import('./pages/admin/FeedbackManager'))
const TeamManager = lp(() => import('./pages/admin/TeamManager'))
const LeagueStaff = lp(() => import('./pages/admin/LeagueStaff'))
const DiscordRosterSync = lp(() => import('./pages/admin/DiscordRosterSync'))
const RoleSync = lp(() => import('./pages/admin/RoleSync'))
const ForgeConfig = lp(() => import('./pages/admin/ForgeConfig'))
const ForgeAdmin = lp(() => import('./pages/admin/ForgeAdmin'))
const ReferralManager = lp(() => import('./pages/admin/ReferralManager'))
const CommunityTeamAdmin = lp(() => import('./pages/admin/CommunityTeamAdmin'))
const ScrimAdmin = lp(() => import('./pages/admin/ScrimAdmin'))
const StageManager = lp(() => import('./pages/admin/StageManager'))
const StaffSettings = lp(() => import('./pages/admin/StaffSettings'))
const SingleMatchReport = lp(() => import('./pages/admin/SingleMatchReport'))
const CardPreview = lp(() => import('./pages/admin/CardPreview'))
const CardClashAdmin = lp(() => import('./pages/admin/CardClashAdmin'))
const ArcadeNpcManager = lp(() => import('./pages/admin/ArcadeNpcManager'))

// ── Codex pages ──
const CodexDashboard = lp(() => import('./pages/codex/CodexDashboard'))
const CodexItems = lp(() => import('./pages/codex/CodexItems'))
const CodexGods = lp(() => import('./pages/codex/CodexGods'))
const CodexImages = lp(() => import('./pages/codex/CodexImages'))
const CodexWordle = lp(() => import('./pages/codex/CodexWordle'))

// ── Public feature pages ──
const ProfilePage = lp(() => import('./pages/ProfilePage'))
const DraftSimulator = lp(() => import('./pages/DraftSimulator'))
const TierListPage = lp(() => import('./pages/TierListPage'))
const PassionLeaderboard = lp(() => import('./pages/PassionLeaderboard'))
const Challenges = lp(() => import('./pages/Challenges'))
const CoinFlip = lp(() => import('./pages/CoinFlip'))
const PassionShop = lp(() => import('./pages/PassionShop'))
const ReferralPage = lp(() => import('./pages/ReferralPage'))
const Predictions = lp(() => import('./pages/Predictions'))
const MatchupDetail = lp(() => import('./pages/MatchupDetail'))
const FeaturedStream = lp(() => import('./pages/FeaturedStream'))
const AGLSignup = lp(() => import('./pages/AGLSignup'))
const OrgPage = lp(() => import('./pages/OrgPage'))
const FantasyForge = lp(() => import('./pages/FantasyForge'))
const ForgePlayerPage = lp(() => import('./pages/forge/ForgePlayerPage'))
const GodTierList = lp(() => import('./pages/GodTierList'))
const ScrimPlanner = lp(() => import('./pages/ScrimPlanner'))
const MyTeams = lp(() => import('./pages/MyTeams'))
const TheArcade = lp(() => import('./pages/TheArcade'))
const Feedback = lp(() => import('./pages/Feedback'))
const Support = lp(() => import('./pages/Support'))
const Features = lp(() => import('./pages/Features'))
const Players = lp(() => import('./pages/Players'))
const SnoozOverlay = lp(() => import('./pages/SnoozOverlay'))
const CardClashPage = lp(() => import('./pages/CardClashPage'))
const CardSharePage = lp(() => import('./pages/cardclash/CardSharePage'))
const BgRemover = lp(() => import('./pages/BgRemover'))

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
                        <Route path="cardclash/share/:token" element={<CardSharePage />} />

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
                                <Route path="cardclash" element={<ProtectedRoute requiredPermission="cardclash_manage"><CardClashAdmin /></ProtectedRoute>} />
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
                            <Route path="cardclash" element={<ProtectedRoute requiredPermission="codex_edit" redirectTo="/"><CardClashPage /></ProtectedRoute>} />
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
