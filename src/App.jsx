// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
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
import ScrollToTop from "./components/ScrollToTop.jsx";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import RosterManager from "./pages/admin/RosterManager.jsx";
import MatchManager from "./pages/admin/MatchManager.jsx";

function App() {
    return (
        <Router>
            <ScrollToTop />
            <ErrorBoundary>
                <Routes>
                    <Route path="/" element={<AppLayout />}>
                        {/* Homepage — league & division selector */}
                        <Route index element={<Homepage />} />

                        {/* Admin — match data entry */}
                        <Route path="admin" element={<AdminDashboard />} />
                        <Route path="admin/rosters" element={<RosterManager />} />
                        <Route path="admin/matches" element={<MatchManager />} />

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
    )
}

export default App