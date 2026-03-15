import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePassion } from '../../context/PassionContext'
import {
    matchService, profileService, vaultService, forgeService,
    challengeService, communityTeamService, scrimService, tradingService,
} from '../../services/database'

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

            // Resolve Forge portfolio: find active market, then fetch portfolio
            let forgePortfolio = null
            let forgeLeagueSlug = null
            let marketClosed = true
            let forgeError = false
            const marketStatuses = val(7)
            if (marketStatuses?.seasons) {
                const activeSeason = marketStatuses.seasons.find(s => s.status === 'open')
                if (activeSeason) {
                    marketClosed = false
                    forgeLeagueSlug = activeSeason.leagueSlug
                    try {
                        forgePortfolio = await forgeService.getPortfolio(activeSeason.seasonId)
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

            setData({
                upcomingMatches: val(0)?.matches || [],
                profile: val(1),
                startingFive: val(2),
                gifts: val(3),
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
                captainTeams: val(11)?.teams || [],
                vaultData: val(12),
            })
            setLoading(false)
        }

        load()
    }, [linkedPlayer?.slug])

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`rounded-xl border border-white/10 bg-white/5 animate-pulse ${i < 2 ? 'md:col-span-2 h-48' : 'h-40'}`} />
                    ))}
                </div>
            </div>
        )
    }

    const hasTeam = data.myTeams.length > 0 || data.upcomingMatches.length > 0
    const isCaptain = data.captainTeams.length > 0
    const pendingGiftCount = data.gifts?.gifts?.filter(g => !g.opened)?.length || 0

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Greeting */}
            <h1 className="font-heading text-2xl font-bold mb-5">
                Welcome back{user?.discord_username ? `, ${user.discord_username}` : ''}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Action Bar */}
                <ActionBar
                    canClaimPassion={passion.canClaimDaily}
                    canClaimCores={passion.ember?.canClaimDaily}
                    claimableChallenges={data.claimableChallenges}
                    incomeCollectible={data.startingFive?.incomeCollectible}
                    pendingGifts={pendingGiftCount}
                    pendingTrades={data.pendingTrades.length}
                    pendingTeamInvites={data.teamPendingCount}
                    incomingScrimRequests={data.incomingScrims.length}
                />

                {/* Large widgets */}
                <UpcomingMatches matches={data.upcomingMatches} hasTeam={hasTeam} />
                {/* Passion spans 2 rows on desktop */}
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

                {/* Medium widgets */}
                <VaultOverview
                    vaultData={data.vaultData}
                    startingFive={data.startingFive}
                    pendingGifts={pendingGiftCount}
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
