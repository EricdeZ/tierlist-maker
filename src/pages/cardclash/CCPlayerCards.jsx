import { useState, useCallback, useRef, useEffect } from 'react'
import { globalPlayerService, profileService } from '../../services/database'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { RARITIES } from '../../data/cardclash/economy'
import { Search, Loader2, User } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// Map CC rarities to TradingCardHolo effect names
const RARITY_HOLO_MAP = {
  common: 'common',
  uncommon: 'holo',
  rare: 'galaxy',
  epic: 'cosmos',
  legendary: 'gold',
}

export default function CCPlayerCards() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerData, setPlayerData] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [selectedRarity, setSelectedRarity] = useState('all')
  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  const search = useCallback((term) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!term || term.length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await globalPlayerService.search(term)
        setResults(data || [])
      } catch {
        setResults([])
      }
      setSearching(false)
    }, 250)
  }, [])

  const selectPlayer = async (player) => {
    setQuery(player.name)
    setResults([])
    setSelectedPlayer(player)
    setLoadingProfile(true)
    try {
      const data = await profileService.getPlayerProfile(player.slug)
      setPlayerData(data)
    } catch {
      setPlayerData(null)
    }
    setLoadingProfile(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!results.length) return
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setResults([])
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [results.length])

  const cardProps = buildCardProps(playerData)
  const rarities = selectedRarity === 'all' ? RARITY_ORDER : [selectedRarity]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Player Cards</h1>
        <p className="text-sm text-gray-400 mt-1">
          Search for any player to see their trading card in all 6 rarities
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search player name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              search(e.target.value)
            }}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left cursor-pointer"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.team_color || '#6b7280' }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.team_name || 'Free Agent'}{p.league_name ? ` · ${p.league_name}` : ''}
                    {p.main_role ? ` · ${p.main_role}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingProfile && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      )}

      {/* Player cards */}
      {cardProps && !loadingProfile && (
        <>
          {/* Player info header */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
              {cardProps.avatarUrl ? (
                <img src={cardProps.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold">{cardProps.playerName}</h2>
              <p className="text-sm text-gray-400">
                {cardProps.teamName || 'Free Agent'}
                {cardProps.seasonName ? ` · ${cardProps.seasonName}` : ''}
                {cardProps.role ? ` · ${cardProps.role}` : ''}
              </p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-black text-amber-400">{cardProps.stats?.gamesPlayed || 0}</div>
              <div className="text-xs text-gray-500 uppercase">Games</div>
            </div>
          </div>

          {/* Rarity filter */}
          <div className="flex gap-1 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedRarity('all')}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold cursor-pointer transition-colors ${
                selectedRarity === 'all' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            >
              All Rarities
            </button>
            {RARITY_ORDER.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRarity(r)}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold capitalize cursor-pointer transition-colors ${
                  selectedRarity === r ? 'text-black' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }`}
                style={selectedRarity === r ? { backgroundColor: RARITIES[r]?.color } : undefined}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="flex flex-wrap gap-8">
            {rarities.map((rarity) => {
              const info = RARITIES[rarity]
              const holoEffect = RARITY_HOLO_MAP[rarity]
              return (
                <div key={rarity} className="flex flex-col items-center gap-2">
                  <TradingCardHolo rarity={holoEffect} role={cardProps.role} holoType="reverse">
                    <TradingCard {...cardProps} variant="player" />
                  </TradingCardHolo>
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: info?.color }}
                  >
                    {info?.name || rarity}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!selectedPlayer && !loadingProfile && (
        <div className="text-center py-20 text-gray-600">
          <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">Search for a player above</p>
          <p className="text-sm mt-1">Their card will be generated with real stats in all 6 rarities</p>
        </div>
      )}
    </div>
  )
}

function buildCardProps(data) {
  if (!data) return null

  const { player, seasonHistory, gameHistory } = data

  // Use most recent season for team/role info
  const latestSeason = seasonHistory?.[0]
  const role = latestSeason?.role || 'ADC'
  const teamId = latestSeason?.team_id

  // Filter game history to only games on this team
  const teamGames = teamId
    ? (gameHistory || []).filter(g => g.player_team_id === teamId)
    : gameHistory || []

  // Build avatar URL from Discord data
  let avatarUrl = null
  if (player.discord_id && player.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
  }

  // Compute best god from team-filtered games
  const bestGod = computeBestGod(teamGames)

  // Compute stats from team-filtered games
  let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
  for (const g of teamGames) {
    gamesPlayed++
    if (g.winner_team_id === g.player_team_id) wins++
    kills += parseInt(g.kills) || 0
    deaths += parseInt(g.deaths) || 0
    assists += parseInt(g.assists) || 0
    totalDamage += parseInt(g.damage) || 0
    totalMitigated += parseInt(g.mitigated) || 0
  }

  return {
    playerName: player.name,
    teamName: latestSeason?.team_name || null,
    teamColor: latestSeason?.team_color || '#6366f1',
    seasonName: latestSeason?.season_name || '',
    leagueName: latestSeason?.league_name || '',
    divisionName: latestSeason?.division_name || '',
    role: role.toUpperCase(),
    avatarUrl,
    stats: {
      gamesPlayed,
      wins,
      winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
      kda: deaths > 0 ? (kills + assists / 2) / deaths : kills + assists / 2,
      avgDamage: gamesPlayed > 0 ? totalDamage / gamesPlayed : 0,
      avgMitigated: gamesPlayed > 0 ? totalMitigated / gamesPlayed : 0,
      totalKills: kills,
      totalDeaths: deaths,
      totalAssists: assists,
    },
    bestGod,
  }
}

function computeBestGod(gameHistory) {
  if (!gameHistory?.length) return null

  const godMap = {}
  for (const game of gameHistory) {
    if (!game.god_played) continue
    if (!godMap[game.god_played]) {
      godMap[game.god_played] = { name: game.god_played, games: 0, wins: 0 }
    }
    godMap[game.god_played].games++
    if (game.winner_team_id === game.player_team_id) {
      godMap[game.god_played].wins++
    }
  }

  const gods = Object.values(godMap)
  if (!gods.length) return null

  gods.sort((a, b) => b.games - a.games)
  const best = gods[0]
  const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

  return {
    name: best.name,
    imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
    games: best.games,
    winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
  }
}
