import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { profileService, godService } from '../services/database'
import { UserCheck, User, ExternalLink, ArrowLeft } from 'lucide-react'
import { getTierColor } from '../config/challengeTiers'
import { getRank, formatRank } from '../config/ranks'
import { getDivisionImage } from '../utils/divisionImages'
import { getLeagueLogo } from '../utils/leagueImages'
import RankBadge from '../components/RankBadge'
import GodpoolTierListDisplay from '../components/GodpoolTierListDisplay'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import passionCoin from '../assets/passion/passion.png'
import soloImage from '../assets/roles/solo.webp'
import jungleImage from '../assets/roles/jungle.webp'
import midImage from '../assets/roles/mid.webp'
import suppImage from '../assets/roles/supp.webp'
import adcImage from '../assets/roles/adc.webp'

const ROLE_IMAGES = { Solo: soloImage, Jungle: jungleImage, Mid: midImage, Support: suppImage, ADC: adcImage }

const ProfilePage = () => {
    const { playerSlug } = useParams()
    const navigate = useNavigate()
    const { user, linkedPlayer, login, loading: authLoading } = useAuth()

    const [profileData, setProfileData] = useState(null)
    const [gods, setGods] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedLeague, setSelectedLeague] = useState(null) // null = all leagues

    useEffect(() => {
        if (!playerSlug) return

        let cancelled = false

        const fetchProfile = async () => {
            setLoading(true)
            setError(null)
            try {
                const [data, godsList] = await Promise.all([
                    profileService.getPlayerProfile(playerSlug),
                    godService.getAll().catch(() => []),
                ])
                if (!cancelled) {
                    setProfileData(data)
                    setGods(Array.isArray(godsList) ? godsList : [])
                }
            } catch (err) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchProfile()
        return () => { cancelled = true }
    }, [playerSlug])

    // Reset league filter when navigating to a different profile
    useEffect(() => {
        setSelectedLeague(null)
    }, [playerSlug])

    if (loading) {
        return (
            <>
            <Navbar title="Profile" />
            <div className="max-w-5xl mx-auto pt-24 pb-8 px-4">
                <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                        <p className="text-(--color-text-secondary)">Loading profile...</p>
                    </div>
                </div>
            </div>
            </>
        )
    }

    if (error || !profileData) {
        return (
            <>
            <Navbar title="Profile" />
            <div className="max-w-3xl mx-auto pt-24 pb-8 px-4 text-center">
                <h2 className="text-2xl font-bold text-(--color-text) mb-4">Player Not Found</h2>
                <p className="text-(--color-text-secondary) mb-6">
                    {error || 'This player profile could not be loaded.'}
                </p>
                <Link to="/" className="text-(--color-accent) hover:underline">
                    ← Back to Home
                </Link>
            </div>
            </>
        )
    }

    const { player, allTimeStats, leagueBreakdowns, seasonHistory, gameHistory } = profileData

    // Determine active stats based on league filter
    const activeStats = selectedLeague
        ? leagueBreakdowns.find(l => l.league_id === selectedLeague) || allTimeStats
        : allTimeStats

    const gamesPlayed = parseInt(activeStats.games_played) || 0
    const wins = parseInt(activeStats.wins) || 0
    const totalKills = parseInt(activeStats.total_kills) || 0
    const totalDeaths = parseInt(activeStats.total_deaths) || 0
    const totalAssists = parseInt(activeStats.total_assists) || 0
    const totalDamage = parseInt(activeStats.total_damage) || 0
    const totalMitigated = parseInt(activeStats.total_mitigated) || 0
    const kda = totalDeaths === 0
        ? totalKills + (totalAssists / 2)
        : (totalKills + (totalAssists / 2)) / totalDeaths
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0

    const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))
    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    // Filter season history and game history by selected league
    const filteredSeasons = selectedLeague
        ? seasonHistory.filter(s => s.league_id === selectedLeague)
        : seasonHistory

    const filteredGames = selectedLeague
        ? (gameHistory || []).filter(g => g.league_id === selectedLeague)
        : (gameHistory || [])

    const isOwnProfile = linkedPlayer && linkedPlayer.slug === player.slug

    const avatarUrl = player.is_claimed && player.discord_id && player.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.png?size=128`
        : null

    return (
        <>
        <Navbar title={player.name} />
        <div className="max-w-5xl mx-auto pt-24 pb-8 px-4">
            {profileData && <PageTitle title={`${profileData.player.name} - SMITE 2 Player Profile & Stats`} description={`${profileData.player.name}'s competitive SMITE 2 profile. ${profileData.allTimeStats?.games_played || 0} games played across ${profileData.leagueBreakdowns?.length || 0} league${(profileData.leagueBreakdowns?.length || 0) !== 1 ? 's' : ''}. Full match history, KDA, damage, and career stats.`} />}

            {/* Profile Header */}
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 mb-6">
                <div className="flex items-center gap-5">
                    {/* Avatar */}
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt=""
                            className="w-20 h-20 rounded-full border-2 border-(--color-accent)/30"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl font-bold text-(--color-text-secondary)">
                                {player.name[0]?.toUpperCase()}
                            </span>
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        <h1 className="font-heading text-3xl font-bold text-(--color-text) mb-1">
                            {player.name}
                        </h1>
                        {player.discord_username && (
                            <p className="text-sm text-(--color-text-secondary)">@{player.discord_username}</p>
                        )}
                    </div>

                    {/* Rank — hidden on mobile, shown below card instead */}
                    {player.total_earned != null && (
                        <Link to="/challenges" className="hidden sm:flex flex-col items-center gap-1 flex-shrink-0 hover:opacity-80 transition-opacity">
                            <RankBadge totalEarned={player.total_earned} size="lg" />
                            <span className="text-xs font-semibold text-(--color-text-secondary)">
                                {formatRank(getRank(player.total_earned))}
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Rank — mobile only, below header card */}
            {player.total_earned != null && (
                <Link to="/challenges" className="flex sm:hidden justify-center py-3 mb-2 hover:opacity-80 transition-opacity">
                    <RankBadge totalEarned={player.total_earned} size="lg" showLabel />
                </Link>
            )}

            {/* Profile Tags */}
            <div className="flex items-center gap-2 mb-6">
                {player.is_claimed && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" />
                        Verified
                    </span>
                )}
                {isOwnProfile && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium">
                        Your Profile
                    </span>
                )}
                {player.tracker_url && (
                    <a
                        href={player.tracker_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-medium hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Tracker
                    </a>
                )}
                {player.passion_balance != null && (
                    <Link
                        to="/challenges"
                        className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20 text-(--color-accent) text-xs font-bold hover:bg-(--color-accent)/20 transition-colors"
                    >
                        <img src={passionCoin} alt="" className="w-4 h-4" />
                        {new Intl.NumberFormat().format(player.passion_balance)}
                    </Link>
                )}
            </div>

            {/* Badges */}
            {profileData.badges?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {profileData.badges.map((badge, i) => (
                        <BadgePill key={i} badge={badge} />
                    ))}
                </div>
            )}

            {/* Claim CTA Banner — hide if profile already claimed or current user already has a linked player */}
            {!player.is_claimed && !authLoading && !linkedPlayer && (
                <div
                    className="relative overflow-hidden rounded-xl border border-[#5865F2]/30 p-5 mb-6"
                    style={{ background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.08), var(--color-secondary))' }}
                >
                    <div
                        className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
                        style={{ background: 'radial-gradient(circle at top right, #5865F2, transparent 70%)' }}
                    />
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-[#5865F2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-heading text-lg font-bold text-(--color-text) mb-1">
                                Is this you? Claim this profile!
                            </h3>
                            <p className="text-sm text-(--color-text-secondary)">
                                Link your Discord and unlock your full competitive identity.
                                Show off your stats and track your career across every season.
                            </p>
                        </div>
                        {!user ? (
                            <button
                                onClick={login}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                                </svg>
                                Login to Claim
                            </button>
                        ) : !linkedPlayer ? (
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-claim-modal', { detail: { playerId: player.id, playerName: player.name } }))}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold transition-colors flex-shrink-0"
                            >
                                <User className="w-4 h-4" />
                                Claim This Profile
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {/* League Filter */}
            {leagueBreakdowns.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setSelectedLeague(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            !selectedLeague
                                ? 'bg-(--color-accent) text-(--color-primary)'
                                : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                        }`}
                    >
                        All Leagues
                    </button>
                    {leagueBreakdowns.map(league => (
                        <button
                            key={league.league_id}
                            onClick={() => setSelectedLeague(league.league_id)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                selectedLeague === league.league_id
                                    ? 'text-white'
                                    : 'bg-white/5 text-(--color-text-secondary) hover:bg-white/10'
                            }`}
                            style={selectedLeague === league.league_id && league.league_color ? { backgroundColor: league.league_color } : {}}
                        >
                            {league.league_name}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats Overview */}
            {gamesPlayed > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                        {[
                            { label: 'Games', value: gamesPlayed },
                            { label: 'Wins', value: wins },
                            {
                                label: 'Win Rate',
                                value: `${winRate.toFixed(0)}%`,
                                color: winRate >= 60 ? 'text-green-400' : winRate >= 45 ? 'text-yellow-400' : 'text-red-400',
                            },
                            {
                                label: 'KDA',
                                value: kda.toFixed(2),
                                color: kda >= 2 ? 'text-green-400' : kda >= 1.5 ? 'text-yellow-400' : 'text-red-400',
                            },
                            { label: 'Kills', value: totalKills },
                            { label: 'Deaths', value: totalDeaths },
                            { label: 'Assists', value: totalAssists },
                        ].map(stat => (
                            <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-4 text-center">
                                <div className={`text-xl font-bold font-heading ${stat.color || 'text-(--color-text)'}`}>
                                    {stat.value}
                                </div>
                                <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Averages */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
                        {[
                            { label: 'Avg Kills', value: (totalKills / gamesPlayed).toFixed(1) },
                            { label: 'Avg Deaths', value: (totalDeaths / gamesPlayed).toFixed(1) },
                            { label: 'Avg Assists', value: (totalAssists / gamesPlayed).toFixed(1) },
                            { label: 'Avg Damage', value: formatNumber(totalDamage / gamesPlayed) },
                            { label: 'Avg Mitigated', value: formatNumber(totalMitigated / gamesPlayed) },
                        ].map(stat => (
                            <div key={stat.label} className="bg-(--color-secondary) rounded-xl border border-white/10 p-3 text-center">
                                <div className="text-lg font-bold text-(--color-text)">{stat.value}</div>
                                <div className="text-xs text-(--color-text-secondary)">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* God Pool */}
                    <GodPool godStats={aggregateGodStats(filteredGames, gods)} />

                    {/* Godpool Tier List */}
                    <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />
                </>
            ) : (
                <>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center mb-8">
                        <p className="text-(--color-text-secondary)">No games played yet.</p>
                    </div>

                    {/* Godpool Tier List (show even with no games) */}
                    <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />
                </>
            )}

            {/* Season History */}
            {filteredSeasons.length > 0 && (
                <>
                    <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                        Season History
                    </h2>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[120px]">Season</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[120px]">Team</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">Role</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">Games</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">W-L</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider min-w-[70px]">KDA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredSeasons.map((season, index) => {
                                        const sGames = parseInt(season.games_played) || 0
                                        const sWins = parseInt(season.wins) || 0
                                        const sKills = parseInt(season.total_kills) || 0
                                        const sDeaths = parseInt(season.total_deaths) || 0
                                        const sAssists = parseInt(season.total_assists) || 0
                                        const sKda = sDeaths === 0
                                            ? sKills + (sAssists / 2)
                                            : (sKills + (sAssists / 2)) / sDeaths
                                        const divImg = getDivisionImage(season.league_slug, season.division_slug, season.division_tier)
                                        const leagueLogo = getLeagueLogo(season.league_slug)
                                        const seasonNum = season.season_name?.match(/\d+/)?.[0]
                                        const seasonPath = `/${season.league_slug}/${season.division_slug}/players/${player.slug}`

                                        return (
                                            <tr key={season.season_id} className={`${index % 2 === 0 ? '' : 'bg-white/[0.02]'} group cursor-pointer hover:bg-white/[0.04] transition-colors`} onClick={() => navigate(seasonPath)}>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div
                                                        className="inline-flex items-center gap-1.5"
                                                        title={`${season.league_name} · ${season.division_name} · ${season.season_name}`}
                                                    >
                                                        {leagueLogo ? (
                                                            <img src={leagueLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                        ) : season.league_color && (
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: season.league_color }}
                                                            />
                                                        )}
                                                        {divImg ? (
                                                            <img src={divImg} alt={season.division_name || ''} className="w-5 h-5 object-contain" />
                                                        ) : season.division_name && (
                                                            <span className="text-xs font-medium text-(--color-text)">{season.division_name}</span>
                                                        )}
                                                        {seasonNum && (
                                                            <span className="text-xs font-medium text-(--color-text-secondary)">S{seasonNum}</span>
                                                        )}
                                                        {season.is_active && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    {season.team_name ? (
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: season.team_color }}
                                                            />
                                                            <span className="text-sm text-(--color-text)">{season.team_name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-(--color-text-secondary)">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                    {season.role || '—'}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                    {sGames}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                                    {sGames > 0 ? `${sWins}-${sGames - sWins}` : '—'}
                                                </td>
                                                <td className="px-3 py-3 text-center text-sm font-medium">
                                                    <span className={
                                                        sGames === 0 ? 'text-(--color-text-secondary)' :
                                                        sKda >= 2 ? 'text-green-400' :
                                                        sKda >= 1.5 ? 'text-yellow-400' : 'text-red-400'
                                                    }>
                                                        {sGames > 0 ? sKda.toFixed(2) : '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Match History */}
            {filteredGames.length > 0 && (
                <>
                    <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4 mt-8">
                        Match History
                    </h2>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase">Date</th>
                                        {!selectedLeague && (
                                            <th className="px-2 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase min-w-[120px]">Season</th>
                                        )}
                                        <th className="px-3 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase">Opponent</th>
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase"></th>
                                        {filteredGames.some(g => g.role_played) && (
                                            <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Role</th>
                                        )}
                                        {filteredGames.some(g => g.god_played) && (
                                            <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">God</th>
                                        )}
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">K</th>
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">D</th>
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">A</th>
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Dmg</th>
                                        <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Mit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredGames.map((game, index) => {
                                        const isWin = game.winner_team_id === game.player_team_id
                                        const opponent = game.player_team_id === game.team1_id
                                            ? { name: game.team2_name, color: game.team2_color, slug: game.team2_slug }
                                            : { name: game.team1_name, color: game.team1_color, slug: game.team1_slug }
                                        const divImg = getDivisionImage(game.league_slug, game.division_slug, game.division_tier)
                                        const leagueLogo = getLeagueLogo(game.league_slug)
                                        const seasonNum = game.season_name?.match(/\d+/)?.[0]
                                        const matchPath = `/${game.league_slug}/${game.division_slug}/matches/${game.match_id}`

                                        return (
                                            <tr key={game.game_id} className={`${index % 2 === 0 ? '' : 'bg-white/[0.02]'} group cursor-pointer hover:bg-white/[0.04] transition-colors`} onClick={() => navigate(matchPath)}>
                                                <td className="px-3 py-2.5 text-sm whitespace-nowrap text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors">
                                                    {formatDate(game.date)}
                                                </td>
                                                {!selectedLeague && (
                                                    <td className="px-2 py-2.5 whitespace-nowrap">
                                                        <Link
                                                            to={`/${game.league_slug}/${game.division_slug}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                                            title={`${game.league_name} · ${game.division_name} · ${game.season_name}`}
                                                        >
                                                            {leagueLogo ? (
                                                                <img src={leagueLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                            ) : game.league_color && (
                                                                <div
                                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                    style={{ backgroundColor: game.league_color }}
                                                                />
                                                            )}
                                                            {divImg ? (
                                                                <img src={divImg} alt={game.division_name || ''} className="w-5 h-5 object-contain" />
                                                            ) : game.division_name && (
                                                                <span className="text-xs font-medium text-(--color-text)">{game.division_name}</span>
                                                            )}
                                                            {seasonNum && (
                                                                <span className="text-xs font-medium text-(--color-text-secondary)">S{seasonNum}</span>
                                                            )}
                                                        </Link>
                                                    </td>
                                                )}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: opponent.color }}
                                                        />
                                                        <span className="text-sm text-(--color-text)">
                                                            {opponent.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2.5 text-center">
                                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                        isWin
                                                            ? 'bg-green-400/10 text-green-400'
                                                            : 'bg-red-400/10 text-red-400'
                                                    }`}>
                                                        {isWin ? 'W' : 'L'}
                                                    </span>
                                                </td>
                                                {filteredGames.some(g => g.role_played) && (
                                                    <td className="px-2 py-2.5 text-center">
                                                        {game.role_played && ROLE_IMAGES[game.role_played] ? (
                                                            <img src={ROLE_IMAGES[game.role_played]} alt={game.role_played} title={game.role_played} className="w-4 h-4 object-contain inline-block" />
                                                        ) : (
                                                            <span className="text-sm text-(--color-text-secondary)">—</span>
                                                        )}
                                                    </td>
                                                )}
                                                {filteredGames.some(g => g.god_played) && (
                                                    <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                        {game.god_played || '—'}
                                                    </td>
                                                )}
                                                <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                    {game.kills}
                                                </td>
                                                <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                    {game.deaths}
                                                </td>
                                                <td className="px-2 py-2.5 text-center text-sm font-medium text-(--color-text)">
                                                    {game.assists}
                                                </td>
                                                <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                    {game.damage != null ? formatNumber(game.damage) : '—'}
                                                </td>
                                                <td className="px-2 py-2.5 text-center text-sm text-(--color-text)">
                                                    {game.mitigated != null ? formatNumber(game.mitigated) : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
        </>
    )
}

function aggregateGodStats(games, godsList) {
    const godMap = {}
    for (const game of games) {
        const name = game.god_played
        if (!name || name === 'Unknown') continue
        if (!godMap[name]) {
            const godInfo = godsList.find(g => g.name.toLowerCase() === name.toLowerCase())
            godMap[name] = {
                name, imageUrl: godInfo?.image_url || null,
                games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, mitigated: 0,
            }
        }
        const g = godMap[name]
        g.games++
        if (game.winner_team_id === game.player_team_id) g.wins++
        g.kills += parseInt(game.kills) || 0
        g.deaths += parseInt(game.deaths) || 0
        g.assists += parseInt(game.assists) || 0
        g.damage += parseInt(game.damage) || 0
        g.mitigated += parseInt(game.mitigated) || 0
    }
    return Object.values(godMap)
        .map(g => ({
            ...g,
            winRate: g.games > 0 ? (g.wins / g.games) * 100 : 0,
            kda: g.deaths === 0
                ? g.kills + (g.assists / 2)
                : (g.kills + (g.assists / 2)) / g.deaths,
            avgDamage: g.games > 0 ? g.damage / g.games : 0,
            avgMitigated: g.games > 0 ? g.mitigated / g.games : 0,
        }))
        .sort((a, b) => b.games - a.games)
}

function GodPool({ godStats }) {
    if (!godStats || godStats.length === 0) return null
    const formatNum = (num) => new Intl.NumberFormat().format(Math.round(num))
    return (
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                God Pool <span className="text-(--color-text-secondary)/60">({godStats.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {godStats.map(god => (
                    <div key={god.name} className="flex items-center gap-3 bg-(--color-secondary) rounded-lg border border-white/10 p-3">
                        {god.imageUrl ? (
                            <img src={god.imageUrl} alt={god.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary) flex-shrink-0">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-(--color-text) truncate">{god.name}</span>
                                <span className="text-xs text-(--color-text-secondary) flex-shrink-0">{god.games}G</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span className={god.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                                    {god.winRate.toFixed(0)}% WR
                                </span>
                                <span>{god.kda.toFixed(1)} KDA</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-(--color-text-secondary)">
                                <span>{formatNum(god.avgDamage)} dmg</span>
                                <span>{formatNum(god.avgMitigated)} mit</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function BadgePill({ badge }) {
    const [expanded, setExpanded] = useState(false)
    const color = getTierColor(badge.tier)

    return (
        <button
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1.5 rounded-full border text-xs font-bold cursor-pointer transition-all"
            style={{
                borderColor: `${color}60`,
                color: color,
                backgroundColor: `${color}${expanded ? '20' : '15'}`,
                padding: expanded ? '6px 12px' : '6px 12px',
            }}
        >
            <span>&#9733;</span>
            <span>{badge.badge_label}</span>
            {expanded && (
                <span className="text-[10px] font-normal opacity-70 ml-1">
                    — {badge.title}{badge.completed_at ? ` (${new Date(badge.completed_at).toLocaleDateString()})` : ''}
                </span>
            )}
        </button>
    )
}

export default ProfilePage
