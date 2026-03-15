import { useState, useCallback, useRef, useEffect } from 'react'
import { globalPlayerService, profileService, vaultAdminService } from '../../../services/database'
import TradingCard from '../../../components/TradingCard'
import { Search, Loader2, User, Link2, Copy, Check } from 'lucide-react'

const HOLO_OPTIONS = [
  { value: 'unique', label: 'Unique (Radiant + Rainbow)' },
  { value: 'common', label: 'Common' },
  { value: 'holo', label: 'Holo' },
  { value: 'amazing', label: 'Amazing' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'galaxy', label: 'Galaxy' },
  { value: 'vstar', label: 'V-Star' },
  { value: 'shiny', label: 'Shiny' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'radiant', label: 'Radiant' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'rainbow-alt', label: 'Rainbow Alt' },
  { value: 'cosmos', label: 'Cosmos' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'secret', label: 'Secret' },
  { value: 'gold', label: 'Gold' },
]

const RARITY_OPTIONS = [
  { value: 'unique', label: 'Unique' },
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'mythic', label: 'Mythic' },
]

export default function CCAdminShare() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerData, setPlayerData] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [holoEffect, setHoloEffect] = useState('gold')
  const [rarity, setRarity] = useState('legendary')
  const [shareLink, setShareLink] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
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
    setShareLink(null)
    setLoadingProfile(true)
    try {
      const data = await profileService.getPlayerProfile(player.slug)
      setPlayerData(data)
    } catch {
      setPlayerData(null)
    }
    setLoadingProfile(false)
  }

  useEffect(() => {
    if (!results.length) return
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setResults([])
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [results.length])

  const cardProps = playerData ? buildCardProps(playerData) : null

  const handleGenerate = async () => {
    if (!selectedPlayer) return
    setGenerating(true)
    try {
      const data = await vaultAdminService.generateShareLink(selectedPlayer.slug, holoEffect, rarity)
      const url = `${window.location.origin}/vault/share/${data.token}`
      setShareLink(url)
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  const handleCopy = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Player Card Share Links</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Generate shareable preview links for player trading cards
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Player search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5">Player</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search player name..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); search(e.target.value) }}
                className="w-full bg-[var(--color-bg)] border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-amber-500/50"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
            </div>

            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg)] border border-white/10 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlayer(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left cursor-pointer"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.team_color || '#6b7280' }} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{p.name}</div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {p.team_name || 'Free Agent'}{p.league_name ? ` \u00b7 ${p.league_name}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Holo + Rarity selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5">Holo Effect</label>
              <select
                value={holoEffect}
                onChange={e => { setHoloEffect(e.target.value); setShareLink(null) }}
                className="w-full bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)]"
              >
                {HOLO_OPTIONS.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1.5">Rarity</label>
              <select
                value={rarity}
                onChange={e => { setRarity(e.target.value); setShareLink(null) }}
                className="w-full bg-[var(--color-bg)] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)]"
              >
                {RARITY_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedPlayer || generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Share Link'}
          </button>

          {/* Share link output */}
          {shareLink && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="text-xs text-emerald-400 font-bold">Share link ready</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-[var(--color-bg)] border border-white/10 rounded px-3 py-2 text-xs font-mono text-[var(--color-text-secondary)]"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 font-bold cursor-pointer transition-colors"
                >
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="flex flex-col items-center gap-4">
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Preview</h4>

          {loadingProfile ? (
            <div className="py-20">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : cardProps ? (
            <TradingCard {...cardProps} rarity={rarity} holo={{ rarity: holoEffect, holoType: 'reverse' }} />
          ) : (
            <div className="py-20 text-center text-[var(--color-text-secondary)]">
              <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-xs">Select a player to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function buildCardProps(data) {
  if (!data) return null
  const { player, seasonHistory, gameHistory } = data

  const latestSeason = seasonHistory?.[0]
  const role = latestSeason?.role || 'ADC'
  const teamId = latestSeason?.team_id

  const teamGames = teamId
    ? (gameHistory || []).filter(g => g.player_team_id === teamId)
    : gameHistory || []

  let avatarUrl = null
  if (player.discord_id && player.discord_avatar) {
    avatarUrl = `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.webp?size=256`
  }

  let gamesPlayed = 0, wins = 0, kills = 0, deaths = 0, assists = 0, totalDamage = 0, totalMitigated = 0
  const godMap = {}
  for (const g of teamGames) {
    gamesPlayed++
    if (g.winner_team_id === g.player_team_id) wins++
    kills += parseInt(g.kills) || 0
    deaths += parseInt(g.deaths) || 0
    assists += parseInt(g.assists) || 0
    totalDamage += parseInt(g.damage) || 0
    totalMitigated += parseInt(g.mitigated) || 0
    if (g.god_played) {
      if (!godMap[g.god_played]) godMap[g.god_played] = { name: g.god_played, games: 0, wins: 0 }
      godMap[g.god_played].games++
      if (g.winner_team_id === g.player_team_id) godMap[g.god_played].wins++
    }
  }

  const gods = Object.values(godMap).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
  const best = gods[0] || null
  let bestGod = null
  if (best) {
    const slug = best.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    bestGod = {
      name: best.name,
      imageUrl: `https://smitebrain.com/cdn-cgi/image/width=80,height=80,f=auto,fit=cover/https://images.smitebrain.com/images/gods/icons/${slug}`,
      games: best.games,
      winRate: best.games > 0 ? (best.wins / best.games) * 100 : 0,
    }
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
