import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import {
    matchService, profileService, vaultService, forgeService,
    challengeService, communityTeamService, scrimService, tradingService,
} from '../../services/database'

import { getDiscordAvatarUrl } from '../../utils/playerAvatar'
import ActionBar from './ActionBar'
import UpcomingMatches from './UpcomingMatches'
import RecentResults from './RecentResults'
import PassionStatus from './PassionStatus'
import VaultOverview from './VaultOverview'
import ForgePortfolio from './ForgePortfolio'
import ChallengesProgress from './ChallengesProgress'
import CoresClaim from './CoresClaim'
import TeamWidget from './TeamWidget'
import ScrimWidget from './ScrimWidget'

function getTimeGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

function formatGreetingDate() {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function SectionLabel({ children }) {
    return (
        <div className="col-span-full flex items-center gap-3 mt-2 -mb-1">
            <span className="text-xs font-heading font-bold uppercase tracking-widest text-(--color-text-secondary)/50">{children}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 ${i < 2 ? 'md:col-span-2 h-48' : 'h-40'}`}
                    >
                        <div
                            className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
                            style={{
                                background: 'linear-gradient(90deg, transparent, rgba(248,197,106,0.04), transparent)',
                                animationDelay: `${i * 150}ms`,
                            }}
                        />
                    </div>
                ))}
            </div>
            <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
        </div>
    )
}

export default function PlayerDashboard() {
    const { user, linkedPlayer } = useAuth()
    const passion = usePassion()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const results = await Promise.allSettled([
                matchService.getMyUpcoming(),                           // 0
                linkedPlayer?.slug
                    ? profileService.getPlayerProfile(linkedPlayer.slug) // 1
                    : Promise.resolve(null),
                vaultService.loadStartingFive(),                        // 2
                vaultService.loadGifts(),                               // 3
                tradingService.pending(),                               // 4
                communityTeamService.getPendingCount(),                  // 5
                scrimService.getIncoming(),                             // 6
                forgeService.getMarketStatuses(),                       // 7
                challengeService.getAll(),                              // 8
                communityTeamService.getMyTeams(),                      // 9
                scrimService.getMyScrims(),                             // 10
                scrimService.getCaptainTeams(),                         // 11
                vaultService.load(),                                    // 12
            ])

            const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null

            // Resolve Forge portfolio: find an open market from statuses object
            // getMarketStatuses returns { statuses: { [seasonId]: 'open'|'closed'|... } }
            let forgePortfolio = null
            let forgeLeagueSlug = null
            let marketClosed = true
            let forgeError = false
            const marketStatuses = val(7)
            const statusMap = marketStatuses?.statuses
            if (statusMap && typeof statusMap === 'object') {
                const openSeasonId = Object.keys(statusMap).find(id => statusMap[id] === 'open')
                if (openSeasonId) {
                    marketClosed = false
                    try {
                        forgePortfolio = await forgeService.getPortfolio(openSeasonId)
                    } catch (e) {
                        console.error('Forge portfolio load failed:', e)
                        forgeError = true
                    }
                }
            }

            // Extract challenge data
            const challengeData = val(8)
            const challenges = challengeData?.challenges
                ? Object.values(challengeData.challenges).flat()
                : []

            // Gift count: gifts response is { sent, received, unseenCount }
            const giftsData = val(3)
            const pendingGiftCount = giftsData?.received?.filter(g => !g.opened)?.length || 0

            // Starting Five income: pending if passionPending or coresPending > 0
            const startingFive = val(2)
            const incomeCollectible = (startingFive?.passionPending > 0 || startingFive?.coresPending > 0)

            setData({
                upcomingMatches: val(0)?.matches || [],
                profile: val(1),
                startingFive,
                giftsData,
                pendingGiftCount,
                incomeCollectible,
                pendingTrades: val(4)?.trades || [],
                teamPendingCount: val(5)?.count || 0,
                incomingScrims: val(6)?.scrims || [],
                forgePortfolio,
                forgeLeagueSlug,
                forgeError,
                marketClosed,
                challenges,
                claimableChallenges: challengeData?.claimableCount || 0,
                myTeams: val(9)?.teams || [],
                myScrims: val(10)?.scrims || [],
                captainTeams: val(11)?.captainTeams || val(11)?.teams || [],
                vaultData: val(12),
            })
            setLoading(false)
        }

        load()
    }, [linkedPlayer?.slug])

    if (loading) return <LoadingSkeleton />

    const hasTeam = data.myTeams.length > 0 || data.upcomingMatches.length > 0
    const isCaptain = data.captainTeams.length > 0

    return (
        <div className="relative max-w-7xl mx-auto px-4 py-6">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                    className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30"
                    style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
                />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            {/* Greeting */}
            <div className="relative mb-5">
                <div className="flex items-center gap-4">
                    {user?.discord_id && user?.discord_avatar && (
                        <div className="relative shrink-0">
                            <div
                                className="absolute -inset-2 rounded-full opacity-40 blur-md"
                                style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }}
                            />
                            <img
                                src={getDiscordAvatarUrl(user.discord_id, user.discord_avatar, 64)}
                                alt=""
                                className="relative w-12 h-12 rounded-full ring-2 ring-white/10"
                            />
                        </div>
                    )}
                    <div>
                        <h1 className="font-heading text-2xl font-bold">
                            {getTimeGreeting()}{user?.discord_username ? `, ${user.discord_username}` : ''}
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'color-mix(in srgb, var(--color-accent) 50%, var(--color-text-secondary))' }}>
                            {formatGreetingDate()}
                        </p>
                    </div>
                </div>
                <div className="mt-4 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Action Bar */}
                <ActionBar
                    canClaimPassion={passion.canClaimDaily}
                    canClaimCores={passion.ember?.canClaimDaily}
                    claimableChallenges={data.claimableChallenges}
                    incomeCollectible={data.incomeCollectible}
                    pendingGifts={data.pendingGiftCount}
                    pendingTrades={data.pendingTrades.length}
                    pendingTeamInvites={data.teamPendingCount}
                    incomingScrimRequests={data.incomingScrims.length}
                />

                <SectionLabel>Activity</SectionLabel>

                {/* Large widgets */}
                <UpcomingMatches matches={data.upcomingMatches} hasTeam={hasTeam} />
                <PassionStatus
                    balance={passion.balance}
                    rank={passion.rank}
                    nextRank={passion.nextRank}
                    totalEarned={passion.totalEarned}
                    currentStreak={passion.currentStreak}
                    canClaimDaily={passion.canClaimDaily}
                    onClaimDaily={passion.claimDaily}
                />
                <RecentResults games={data.profile?.gameHistory} linkedPlayer={linkedPlayer} />

                <SectionLabel>Collection</SectionLabel>

                {/* Medium widgets */}
                <VaultOverview
                    vaultData={data.vaultData}
                    startingFive={data.startingFive}
                    pendingGifts={data.pendingGiftCount}
                    pendingTrades={data.pendingTrades.length}
                />
                <ForgePortfolio
                    portfolio={data.forgePortfolio}
                    marketClosed={data.marketClosed}
                    forgeLeagueSlug={data.forgeLeagueSlug}
                    error={data.forgeError}
                />

                <CoresClaim
                    balance={passion.ember?.balance}
                    currentStreak={passion.ember?.currentStreak}
                    canClaimDaily={passion.ember?.canClaimDaily}
                    onClaimDaily={passion.claimEmberDaily}
                />

                <SectionLabel>Community</SectionLabel>

                {/* Bottom row */}
                <ChallengesProgress
                    challenges={data.challenges}
                    claimableCount={data.claimableChallenges}
                />
                <TeamWidget teams={data.myTeams} pendingCount={data.teamPendingCount} />
                <ScrimWidget
                    scrims={data.myScrims}
                    incomingCount={data.incomingScrims.length}
                    isCaptain={isCaptain}
                />
            </div>
        </div>
    )
}
