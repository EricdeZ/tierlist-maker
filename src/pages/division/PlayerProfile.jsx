// src/pages/division/PlayerProfile.jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useDivision } from '../../context/DivisionContext'
import { useAuth } from '../../context/AuthContext'
import { statsService, profileService, godService, forgeService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import GodpoolTierListDisplay from '../../components/GodpoolTierListDisplay'
import { ArrowLeft } from 'lucide-react'
import { FEATURE_FLAGS } from '../../config/featureFlags'
import { computeStats, aggregateGodStats } from './player-profile/profileUtils'
import PlayerHeader from './player-profile/PlayerHeader'
import { StatCards, AveragesRow } from './player-profile/StatCards'
import GodPool from './player-profile/GodPool'
import ForgeBanner from './player-profile/ForgeBanner'
import MatchHistory from './player-profile/MatchHistory'
import CareerTab from './player-profile/CareerTab'

const PlayerProfile = () => {
    const { leagueSlug, divisionSlug, playerSlug } = useParams()
    const { players, teams, season, division, loading: divisionLoading } = useDivision()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()

    const [gameHistory, setGameHistory] = useState([])
    const [playerStats, setPlayerStats] = useState(null)
    const [profileData, setProfileData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [activeTab, setActiveTab] = useState('season')
    const [selectedLeague, setSelectedLeague] = useState(null)
    const [gods, setGods] = useState([])
    const [forgeSpark, setForgeSpark] = useState(null)

    const basePath = `/${leagueSlug}/${divisionSlug}`
    const player = players?.find(p => p.slug === playerSlug)
    const team = teams?.find(t => t.id === player?.team_id)

    useEffect(() => {
        if (!player || !season) return

        let cancelled = false

        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const [games, allStats, profile, godsList, forgeData] = await Promise.all([
                    statsService.getPlayerGameStats(season.id, player.id),
                    statsService.getPlayerStats(season.id),
                    profileService.getPlayerProfile(player.slug).catch(() => null),
                    godService.getAll().catch(() => []),
                    forgeService.getMarket(season.id).catch(() => null),
                ])
                if (cancelled) return

                setGameHistory(Array.isArray(games) ? games : [])
                const stats = Array.isArray(allStats) ? allStats.find(s => s.id === player.id) : null
                setPlayerStats(stats || null)
                setProfileData(profile)
                setGods(Array.isArray(godsList) ? godsList : [])
                const spark = forgeData?.players?.find(p => p.playerSlug === player.slug)
                setForgeSpark(spark || null)
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchData()
        return () => { cancelled = true }
    }, [player, season])

    if (!player) {
        if (divisionLoading) return null
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <h2 className="text-2xl font-bold text-(--color-text) mb-4">Player Not Found</h2>
                <Link to={`${basePath}/stats`} className="text-(--color-accent) hover:underline">
                    ← Back to Stats
                </Link>
            </div>
        )
    }

    const seasonStats = computeStats(playerStats)

    // Career data from profile API
    const careerActiveStats = profileData
        ? (selectedLeague
            ? profileData.leagueBreakdowns?.find(l => l.league_id === selectedLeague) || profileData.allTimeStats
            : profileData.allTimeStats)
        : null
    const careerStats = careerActiveStats ? computeStats(careerActiveStats) : null

    const filteredSeasons = profileData
        ? (selectedLeague
            ? profileData.seasonHistory?.filter(s => s.league_id === selectedLeague)
            : profileData.seasonHistory) || []
        : []

    const filteredGames = profileData
        ? (selectedLeague
            ? (profileData.gameHistory || []).filter(g => g.league_id === selectedLeague)
            : (profileData.gameHistory || []))
        : []

    const totalEarned = profileData?.player?.total_earned ?? null
    const passionBalance = profileData?.player?.passion_balance ?? null
    const isOwnProfile = linkedPlayer && linkedPlayer.id === player.id

    // Compute most played god for avatar fallback
    const mostPlayedGod = (() => {
        const games = profileData?.gameHistory
        if (!games?.length) return null
        const counts = {}
        for (const g of games) {
            if (g.god_played) counts[g.god_played] = (counts[g.god_played] || 0) + 1
        }
        const entries = Object.entries(counts)
        if (!entries.length) return null
        entries.sort((a, b) => b[1] - a[1])
        return entries[0][0]
    })()

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {player && <PageTitle title={`${player.name} - ${division?.name || ''}`} description={`${player.name}'s stats in the ${division?.name || ''} division. KDA, damage, win rate, and game-by-game performance.`} />}

            {/* Back arrow + breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-(--color-text-secondary) mb-4">
                <Link to={`${basePath}/stats`} className="inline-flex items-center gap-1.5 hover:text-(--color-accent) transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Stats
                </Link>
                {team && (
                    <>
                        <span>/</span>
                        <Link to={`${basePath}/teams/${team.slug}`} className="hover:text-(--color-accent) transition-colors">
                            {team.name}
                        </Link>
                    </>
                )}
                <span>/</span>
                <span className="text-(--color-text)">{player.name}</span>
            </div>

            <PlayerHeader
                player={player}
                team={team}
                basePath={basePath}
                discordId={profileData?.player?.discord_id}
                discordAvatar={profileData?.player?.discord_avatar}
                isConnected={profileData?.player?.is_claimed}
                allowDiscordAvatar={profileData?.player?.allow_discord_avatar}
                mostPlayedGod={mostPlayedGod}
                totalEarned={totalEarned}
                profileData={profileData}
                passionBalance={passionBalance}
                isOwnProfile={isOwnProfile}
                user={user}
                linkedPlayer={linkedPlayer}
                authLoading={authLoading}
                login={login}
            />

            {/* Tab Toggle */}
            <div className="flex gap-1 p-1 bg-(--color-secondary) rounded-lg border border-white/10 mb-6">
                <button
                    onClick={() => setActiveTab('season')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        activeTab === 'season'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    Current Season
                </button>
                <button
                    onClick={() => setActiveTab('career')}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                        activeTab === 'career'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    Career
                </button>
            </div>

            {/* Current Season Tab */}
            {activeTab === 'season' && (
                loading ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                            <p className="text-(--color-text-secondary)">Loading player stats...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-red-400 mb-3">Failed to Load Stats</h2>
                        <p className="text-red-300/80">{error}</p>
                    </div>
                ) : (
                    <>
                        <StatCards stats={seasonStats} />
                        {seasonStats.gamesPlayed > 0 && <AveragesRow stats={seasonStats} />}
                        {forgeSpark && FEATURE_FLAGS.FORGE_RELEASED && (
                            <ForgeBanner spark={forgeSpark} leagueSlug={leagueSlug} divisionSlug={divisionSlug} />
                        )}
                        <GodPool godStats={aggregateGodStats(gameHistory, gods)} />
                        <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />
                        <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">Match History</h2>
                        <MatchHistory gameHistory={gameHistory} basePath={basePath} />
                    </>
                )
            )}

            {/* Career Tab */}
            {activeTab === 'career' && (
                <CareerTab
                    profileData={profileData}
                    selectedLeague={selectedLeague}
                    setSelectedLeague={setSelectedLeague}
                    careerStats={careerStats}
                    filteredSeasons={filteredSeasons}
                    filteredGames={filteredGames}
                    player={player}
                    leagueSlug={leagueSlug}
                    divisionSlug={divisionSlug}
                    season={season}
                    setActiveTab={setActiveTab}
                    godStats={aggregateGodStats(filteredGames, gods)}
                    gods={gods}
                    isOwnProfile={isOwnProfile}
                    StatCards={StatCards}
                    AveragesRow={AveragesRow}
                    GodPool={GodPool}
                    GodpoolTierListDisplay={GodpoolTierListDisplay}
                />
            )}

        </div>
    )
}

export default PlayerProfile
