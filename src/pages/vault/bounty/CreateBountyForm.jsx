import { useState, useMemo, useRef, useCallback } from 'react'
import { RARITIES } from '../../../data/vault/economy'
import { GODS } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import { CONSUMABLES } from '../../../data/vault/buffs'
import { bountyService } from '../../../services/database'
import WantedPoster from '../components/WantedPoster'
import { X, Loader2 } from 'lucide-react'

const CARD_TYPES = ['god', 'player', 'item', 'consumable']

const ROLE_LABELS = { solo: 'Solo', jungle: 'Jungle', mid: 'Mid', support: 'Support', adc: 'ADC' }

const STATIC_CARD_DATA = {
  god: GODS.map(g => ({
    name: g.name,
    detail: `${g.class} · ${ROLE_LABELS[g.role] || g.role}`,
    avatar: null,
    godId: g.slug,
  })),
  item: ITEMS.map(i => ({ name: i.name, detail: i.category, avatar: null, godId: `item-${i.id}` })),
  consumable: CONSUMABLES.map(c => ({ name: c.name, detail: null, avatar: null, godId: `consumable-${c.id}` })),
}
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique']
const HOLO_OPTIONS = [
  { value: 'holo', label: 'Holo' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'full', label: 'Full Art' },
  { value: 'any_holo', label: 'All' },
]
const MAX_BOUNTIES = 3

export default function CreateBountyForm({ onSubmit, onClose, emberBalance, activeBountyCount }) {
  const [cardType, setCardType] = useState('god')
  const [cardName, setCardName] = useState('')
  const [targetGodId, setTargetGodId] = useState('')
  const [searchText, setSearchText] = useState('')
  const [rarity, setRarity] = useState('common')
  const [holoType, setHoloType] = useState('holo')
  const [coreReward, setCoreReward] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [playerResults, setPlayerResults] = useState([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const debounceRef = useRef(null)

  const atMax = activeBountyCount >= MAX_BOUNTIES
  const isPlayer = cardType === 'player'
  const isStatic = cardType in STATIC_CARD_DATA

  const staticMatches = useMemo(() => {
    if (!isStatic || !searchText) return []
    const q = searchText.toLowerCase()
    return STATIC_CARD_DATA[cardType].filter(c => c.name.toLowerCase().includes(q)).slice(0, 20)
  }, [cardType, searchText, isStatic])

  const searchPlayerDefs = useCallback((term) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!term || term.length < 2) {
      setPlayerResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setPlayerSearching(true)
      try {
        const res = await bountyService.searchPlayers(term)
        setPlayerResults((res.players || []).map(p => ({
          name: p.player_name,
          detail: [p.role?.toUpperCase(), p.team_name, p.division_name, p.season_slug].filter(Boolean).join(' · '),
          avatar: p.avatar_url,
          teamColor: p.team_color,
          godId: `player-${p.player_id}-t${p.team_id}`,
        })))
      } catch {
        setPlayerResults([])
      }
      setPlayerSearching(false)
    }, 250)
  }, [])

  const searchMatches = isPlayer ? playerResults : staticMatches

  const previewBounty = useMemo(() => {
    if (!cardName) return null
    return {
      id: 0,
      card_type: cardType,
      card_name: cardName,
      rarity,
      holo_type: holoType,
      core_reward: coreReward,
      target_god_id: targetGodId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      avatar_url: selectedAvatar,
    }
  }, [cardType, cardName, rarity, holoType, coreReward, targetGodId, selectedAvatar])

  const handleSubmit = async () => {
    if (!cardName.trim() || !targetGodId) {
      setError('Select a specific card from the search results')
      return
    }
    if (coreReward < 1) {
      setError('Reward must be at least 1 Core')
      return
    }
    if (coreReward > emberBalance) {
      setError('Insufficient Core balance')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        cardType,
        cardName: cardName.trim(),
        rarity,
        holoType,
        coreReward,
        targetGodId,
      })
    } catch (err) {
      setError(err.message || 'Failed to post bounty')
    } finally {
      setSubmitting(false)
    }
  }

  const selectCard = (card) => {
    setCardName(card.name)
    setTargetGodId(card.godId)
    setSearchText(isPlayer ? `${card.name} — ${card.detail}` : card.name)
    setShowDropdown(false)
    setSelectedAvatar(card.avatar || null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg p-6"
        style={{
          background: 'var(--cd-surface)',
          border: '1px solid var(--cd-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <h2
          className="font-bold tracking-[0.2em] mb-6"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 20,
            color: '#ff8c00',
            textShadow: '0 0 16px rgba(255,140,0,0.3)',
          }}
        >
          POST A BOUNTY
        </h2>

        {error && (
          <div className="mb-4 px-3 py-2 rounded text-sm bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Form fields */}
          <div className="flex-1 space-y-4">
            {/* Card Type */}
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5 cd-head">Card Type</label>
              <div className="flex flex-wrap gap-1.5">
                {CARD_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => { setCardType(t); setCardName(''); setTargetGodId(''); setSearchText(''); setPlayerResults([]); setSelectedAvatar(null) }}
                    className={`text-[10px] sm:text-xs px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
                      cardType === t
                        ? 'border-[#ff8c00]/50 text-[#ff8c00] bg-[#ff8c00]/10'
                        : 'border-white/10 text-white/30 hover:text-white/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Name */}
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5 cd-head">Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value)
                    setCardName('')
                    setTargetGodId('')
                    setShowDropdown(true)
                    if (isPlayer) searchPlayerDefs(e.target.value)
                  }}
                  onFocus={() => searchText && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder={`Search ${cardType}s...`}
                  className="w-full bg-black/30 border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded placeholder-white/20 focus:outline-none focus:border-[#ff8c00]/40"
                />
                {isPlayer && playerSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-white/30" />
                )}
                {showDropdown && searchMatches.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded border"
                    style={{ background: 'var(--cd-surface)', borderColor: 'var(--cd-border)' }}
                  >
                    {searchMatches.map(c => (
                      <button
                        key={c.godId}
                        onClick={() => selectCard(c)}
                        className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white cursor-pointer flex items-center gap-2"
                      >
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt=""
                            className="w-5 h-5 rounded-full shrink-0 object-cover"
                          />
                        ) : isPlayer ? (
                          <div
                            className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold"
                            style={{ background: c.teamColor ? `${c.teamColor}33` : 'rgba(255,255,255,0.1)', color: c.teamColor || 'rgba(255,255,255,0.4)' }}
                          >
                            {c.name.charAt(0)}
                          </div>
                        ) : null}
                        <span>{c.name}</span>
                        {c.detail && <span className="ml-auto text-[10px] text-white/30 truncate">{c.detail}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rarity */}
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5 cd-head">Rarity</label>
              <div className="flex flex-wrap gap-1.5">
                {RARITY_ORDER.map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      setRarity(r)
                      if (r === 'common') setHoloType('none')
                      else if (holoType === 'none') setHoloType('holo')
                    }}
                    className={`text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
                      rarity === r
                        ? 'border-current bg-current/10'
                        : 'border-white/10 text-white/30 hover:text-white/50'
                    }`}
                    style={rarity === r ? { color: RARITIES[r].color } : {}}
                  >
                    {RARITIES[r].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Holo Type — common is always non-holo */}
            {rarity !== 'common' && (
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5 cd-head">Holo Type</label>
              <div className="flex flex-wrap gap-1.5">
                {HOLO_OPTIONS.map(h => (
                  <button
                    key={h.value}
                    onClick={() => setHoloType(h.value)}
                    className={`text-[10px] sm:text-xs px-2.5 py-1 rounded border transition-all cursor-pointer cd-head ${
                      holoType === h.value
                        ? 'border-[var(--cd-purple)]/50 text-[var(--cd-purple)] bg-[var(--cd-purple)]/10'
                        : 'border-white/10 text-white/30 hover:text-white/50'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Core Reward */}
            <div>
              <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1.5 cd-head">Core Reward</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={coreReward}
                  onChange={(e) => setCoreReward(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-24 bg-black/30 border border-[var(--cd-border)] text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#ff8c00]/40"
                />
                <span className="text-xs text-white/30">
                  Balance: <span className="text-[#ff8c00]">{emberBalance}</span> Core
                </span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center gap-2 sm:w-[180px] shrink-0">
            <div className="text-[10px] text-white/30 uppercase tracking-wider cd-head">Preview</div>
            {previewBounty ? (
              <WantedPoster bounty={previewBounty} size="sm" />
            ) : (
              <div
                className="w-[160px] h-[240px] rounded flex items-center justify-center"
                style={{
                  background: 'rgba(20, 15, 8, 0.5)',
                  border: '1px dashed rgba(255, 140, 0, 0.15)',
                }}
              >
                <span className="text-white/15 text-xs text-center px-4">Enter a card name to see preview</span>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || atMax || !cardName.trim() || !targetGodId}
            className="px-6 py-2 rounded font-bold text-sm uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{
              background: 'rgba(255, 140, 0, 0.15)',
              border: '1px solid rgba(255, 140, 0, 0.4)',
              color: '#ff8c00',
            }}
            onMouseEnter={e => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.background = 'rgba(255, 140, 0, 0.25)'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(255,140,0,0.3)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 140, 0, 0.15)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin inline" />
            ) : atMax ? (
              `Max Bounties (${activeBountyCount}/${MAX_BOUNTIES})`
            ) : (
              'Post Bounty'
            )}
          </button>
          <span className="text-xs text-white/30">
            {activeBountyCount}/{MAX_BOUNTIES} active
          </span>
        </div>
      </div>
    </div>
  )
}
