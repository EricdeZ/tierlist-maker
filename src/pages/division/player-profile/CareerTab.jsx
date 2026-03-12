import { Link, useNavigate } from 'react-router-dom'
import { getDivisionImage } from '../../../utils/divisionImages'
import { getLeagueLogo } from '../../../utils/leagueImages'
import { roleImages, formatNumber, formatDate } from './profileUtils'

export default function CareerTab({
    profileData, selectedLeague, setSelectedLeague,
    careerStats, filteredSeasons, filteredGames,
    player, leagueSlug, divisionSlug, season, setActiveTab,
    godStats, gods, isOwnProfile, StatCards, AveragesRow, GodPool, GodpoolTierListDisplay,
}) {
    const navigate = useNavigate()

    if (!profileData) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4" />
                    <p className="text-(--color-text-secondary)">Loading career data...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* League Filter */}
            {profileData.leagueBreakdowns?.length > 1 && (
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
                    {profileData.leagueBreakdowns.map(league => (
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

            {/* Career Stats */}
            {careerStats && careerStats.gamesPlayed > 0 ? (
                <>
                    <StatCards stats={careerStats} />
                    <AveragesRow stats={careerStats} />
                </>
            ) : (
                <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-8 text-center mb-8">
                    <p className="text-(--color-text-secondary)">No games played yet.</p>
                </div>
            )}

            {/* God Pool */}
            <GodPool godStats={godStats} />

            {/* Godpool Tier List */}
            <GodpoolTierListDisplay playerSlug={player.slug} isOwnProfile={isOwnProfile} gods={gods} />

            {/* Season History */}
            {filteredSeasons.length > 0 && (
                <SeasonHistory
                    filteredSeasons={filteredSeasons}
                    player={player}
                    leagueSlug={leagueSlug}
                    divisionSlug={divisionSlug}
                    season={season}
                    setActiveTab={setActiveTab}
                    navigate={navigate}
                />
            )}

            {/* All Match History */}
            {filteredGames.length > 0 && (
                <CareerMatchHistory
                    filteredGames={filteredGames}
                    selectedLeague={selectedLeague}
                    navigate={navigate}
                />
            )}
        </>
    )
}

function SeasonHistory({ filteredSeasons, player, leagueSlug, divisionSlug, season, setActiveTab, navigate }) {
    return (
        <>
            <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
                Season History
            </h2>
            <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden mb-8">
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
                            {filteredSeasons.map((s, index) => {
                                const sGames = parseInt(s.games_played) || 0
                                const sWins = parseInt(s.wins) || 0
                                const sKills = parseInt(s.total_kills) || 0
                                const sDeaths = parseInt(s.total_deaths) || 0
                                const sAssists = parseInt(s.total_assists) || 0
                                const sKda = sDeaths === 0
                                    ? sKills + (sAssists / 2)
                                    : (sKills + (sAssists / 2)) / sDeaths
                                const divImg = getDivisionImage(s.league_slug, s.division_slug, s.division_tier)
                                const leagueLogo = getLeagueLogo(s.league_slug)
                                const seasonNum = s.season_name?.match(/\d+/)?.[0]
                                const seasonPath = `/${s.league_slug}/${s.division_slug}/players/${player.slug}`
                                const isCurrent = s.league_slug === leagueSlug && s.division_slug === divisionSlug && s.season_id === season?.id

                                return (
                                    <tr
                                        key={s.season_id}
                                        className={`${index % 2 === 0 ? '' : 'bg-white/[0.02]'} ${isCurrent ? 'ring-1 ring-inset ring-(--color-accent)/30 bg-(--color-accent)/5' : ''} group cursor-pointer hover:bg-white/[0.04] transition-colors`}
                                        onClick={() => {
                                            if (isCurrent) {
                                                setActiveTab('season')
                                            } else {
                                                navigate(seasonPath)
                                            }
                                        }}
                                    >
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <div
                                                className="inline-flex items-center gap-1.5"
                                                title={`${s.league_name} · ${s.division_name} · ${s.season_name}`}
                                            >
                                                {leagueLogo ? (
                                                    <img src={leagueLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                                                ) : s.league_color && (
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: s.league_color }}
                                                    />
                                                )}
                                                {divImg ? (
                                                    <img src={divImg} alt={s.division_name || ''} className="w-5 h-5 object-contain" />
                                                ) : s.division_name && (
                                                    <span className="text-xs font-medium text-(--color-text)">{s.division_name}</span>
                                                )}
                                                {seasonNum && (
                                                    <span className="text-xs font-medium text-(--color-text-secondary)">S{seasonNum}</span>
                                                )}
                                                {s.is_active && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {s.team_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: s.team_color }}
                                                    />
                                                    <span className="text-sm text-(--color-text)">{s.team_name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-(--color-text-secondary)">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center text-sm text-(--color-text)">
                                            {s.role ? s.role.toUpperCase() : '—'}
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
    )
}

function CareerMatchHistory({ filteredGames, selectedLeague, navigate }) {
    const hasRoles = filteredGames.some(g => g.role_played)
    const hasGods = filteredGames.some(g => g.god_played)

    return (
        <>
            <h2 className="font-heading text-xl font-bold text-(--color-text) mb-4">
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
                                {hasRoles && (
                                    <th className="px-2 py-3 text-center text-xs font-medium text-(--color-text-secondary) uppercase">Role</th>
                                )}
                                {hasGods && (
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
                                        {hasRoles && (
                                            <td className="px-2 py-2.5 text-center">
                                                {game.role_played && roleImages[game.role_played.toUpperCase()] ? (
                                                    <img src={roleImages[game.role_played.toUpperCase()]} alt={game.role_played} title={game.role_played} className="w-4 h-4 object-contain inline-block" />
                                                ) : (
                                                    <span className="text-sm text-(--color-text-secondary)">—</span>
                                                )}
                                            </td>
                                        )}
                                        {hasGods && (
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
    )
}
