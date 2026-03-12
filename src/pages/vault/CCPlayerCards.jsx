import { useState, useCallback, useRef, useEffect } from 'react'
import { globalPlayerService, profileService } from '../../services/database'
import TradingCard from '../../components/TradingCard'
import PlayerAvatar from '../../components/PlayerAvatar'
import { RARITIES, getHoloEffect } from '../../data/vault/economy'
import { Search, Loader2, User } from 'lucide-react'

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

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
      <div className="mb-6 cd-section-accent pb-3">
        <h1 className="text-2xl font-bold text-[var(--cd-text)] cd-head">Player Cards</h1>
        <p className="text-sm text-[var(--cd-text-mid)] mt-1">
          Search for any player to see their trading card in all 6 rarities
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cd-text-dim)]" />
          <input
            type="text"
            placeholder="Search player name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              search(e.target.value)
            }}
            className="w-full cd-input rounded-lg pl-10 pr-3 py-2.5 text-sm"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cd-cyan)] animate-spin" />}
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--cd-surface)] border border-[var(--cd-border)] rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto cd-stagger">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlayer(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rgba(0,229,255,0.04) cd-row-hover transition-colors text-left cursor-pointer"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.team_color || '#6b7280', boxShadow: `0 0 6px ${p.team_color || '#6b7280'}66` }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-xs text-[var(--cd-text-mid)] truncate">
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
          <div className="cd-spinner w-8 h-8" />
        </div>
      )}

      {/* Player cards */}
      {cardProps && !loadingProfile && (
        <>
          {/* Player info header */}
          <div className="cd-panel cd-corners flex items-center gap-4 mb-6 p-4 rounded-xl relative overflow-hidden">
            <div className="cd-data-overlay" />
            <PlayerAvatar
              discordId={cardProps._discordId}
              discordAvatar={cardProps._discordAvatar}
              isConnected={cardProps.isConnected}
              mostPlayedGod={cardProps._mostPlayedGod}
              playerName={cardProps.playerName}
              teamColor={cardProps.teamColor}
              allowDiscordAvatar={cardProps._allowDiscordAvatar}
              size={48}
              className="ring-1 ring-[var(--cd-cyan-dim)] relative z-1"
            />
            <div className="relative z-1">
              <h2 className="text-lg font-bold cd-head" style={{ letterSpacing: '0.08em' }}>{cardProps.playerName}</h2>
              <p className="text-sm text-[var(--cd-text-mid)]">
                {cardProps.teamName || 'Free Agent'}
                {cardProps.seasonName ? ` · ${cardProps.seasonName}` : ''}
                {cardProps.role ? ` · ${cardProps.role}` : ''}
              </p>
            </div>
            <div className="ml-auto text-right relative z-1">
              <div className="text-2xl font-black text-[var(--cd-cyan)] cd-text-glow-strong cd-num">{cardProps.stats?.gamesPlayed || 0}</div>
              <div className="text-xs text-[var(--cd-text-dim)] uppercase tracking-wider cd-head">Games</div>
            </div>
          </div>

          {/* Rarity filter */}
          <div className="flex gap-1 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedRarity('all')}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold cursor-pointer transition-all cd-head ${
                selectedRarity === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cd-pill hover:bg-[var(--cd-border)]'
              }`}
            >
              All Rarities
            </button>
            {RARITY_ORDER.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRarity(r)}
                className={`px-3 py-1.5 text-xs rounded-lg font-bold capitalize cursor-pointer transition-all cd-head ${
                  selectedRarity === r ? 'text-black' : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cd-pill hover:bg-[var(--cd-border)]'
                }`}
                style={selectedRarity === r ? { backgroundColor: RARITIES[r]?.color, boxShadow: `0 0 10px ${RARITIES[r]?.color}44` } : undefined}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="flex flex-wrap gap-8 cd-stagger">
            {rarities.map((rarity) => {
              const info = RARITIES[rarity]
              const holoEffect = getHoloEffect(rarity)
              return (
                <div key={rarity} className="flex flex-col items-center gap-2">
                  <TradingCard {...cardProps} rarity={rarity} size={240} holo={{ rarity: holoEffect, holoType: 'reverse' }} />
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
        <div className="text-center py-20 text-[var(--cd-text-dim)]">
          <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-bold cd-head">Search for a player above</p>
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

  // Compute best god from team-filtered games
  const bestGod = computeBestGod(teamGames)

  // Compute most played god across all games (for avatar fallback)
  const mostPlayedGod = computeMostPlayedGod(gameHistory || [])

  // Discord avatar URL (TradingCard handles fallback chain internally)
  const allowAvatar = player.allow_discord_avatar !== false
  const avatarUrl = allowAvatar && player.discord_id && player.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
    : null

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
    isConnected: player.is_claimed,
    // Raw data for PlayerAvatar in header
    _discordId: player.discord_id,
    _discordAvatar: player.discord_avatar,
    _mostPlayedGod: mostPlayedGod,
    _allowDiscordAvatar: allowAvatar,
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

  gods.sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
  const best = gods[0]
  const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

  return {
    name: best.name,
    imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
    games: best.games,
    winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
  }
}

function computeMostPlayedGod(gameHistory) {
  if (!gameHistory?.length) return null
  const counts = {}
  for (const g of gameHistory) {
    if (!g.god_played) continue
    counts[g.god_played] = (counts[g.god_played] || 0) + 1
  }
  const entries = Object.entries(counts)
  if (!entries.length) return null
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return entries[0][0] // god name string (e.g. "Zeus")
}
