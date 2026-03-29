import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { vaultDashboardService, vaultAdminService } from '../../../services/database'
import { RARITIES } from '../../../data/vault/economy'
import { GODS, CLASS_ROLE } from '../../../data/vault/gods'
import { ITEMS } from '../../../data/vault/items'
import VaultCard from '../../vault/components/VaultCard'

const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75'
const ITEM_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75'

function getGodCardImageUrl(god) {
  return `${GOD_CDN}/Gods/${god.imageKey}/Default/t_GodCard_${god.imageKey}.png`
}

function getItemCardImageUrl(item) {
  return `${ITEM_CDN}/${item.imageKey}.png`
}

const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'item', label: 'Item' },
  { value: 'player', label: 'Player' },
  { value: 'staff', label: 'Staff' },
  { value: 'custom', label: 'Custom' },
  { value: 'blueprint', label: 'From Blueprint' },
]

const ROLES = [
  { value: '', label: 'None' },
  { value: 'solo', label: 'Solo' },
  { value: 'jungle', label: 'Jungle' },
  { value: 'mid', label: 'Mid' },
  { value: 'support', label: 'Support' },
  { value: 'adc', label: 'ADC' },
]

const RARITY_OPTIONS = Object.entries(RARITIES)
  .filter(([key]) => key !== 'full_art')
  .map(([key, val]) => ({ value: key, label: val.name, color: val.color }))

const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--cd-cyan)]/50 focus:ring-1 focus:ring-[var(--cd-cyan)]/30 transition-colors placeholder:text-[var(--color-text-secondary)]/50'
const labelClass = 'block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide'

function Dropdown({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border text-sm text-left transition-colors ${
          open ? 'border-[var(--cd-cyan)]/50 ring-1 ring-[var(--cd-cyan)]/30' : 'border-[var(--cd-border)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--cd-border-hover,var(--cd-border))]'}`}
      >
        <span className={selected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]/60'}>
          {selected?.label || placeholder || 'Select...'}
        </span>
        <svg className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] max-h-56 overflow-y-auto shadow-xl">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-[var(--cd-border)]/50 last:border-b-0 ${
                String(opt.value) === String(value)
                  ? 'bg-[var(--cd-cyan)]/10 text-[var(--cd-cyan)]'
                  : 'text-[var(--color-text-primary)] hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CCAdminPromoGift() {
  const { hasPermission } = useAuth()

  // Recipient
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [recipient, setRecipient] = useState(null)

  // Card config
  const [cardType, setCardType] = useState('god')
  const [rarity, setRarity] = useState('legendary')

  // Definition picker state
  const [selectedDef, setSelectedDef] = useState(null)
  const [defSearch, setDefSearch] = useState('')

  // Player def search (API-based)
  const [playerDefs, setPlayerDefs] = useState([])
  const [playerSearching, setPlayerSearching] = useState(false)
  const playerSearchTimer = useRef(null)

  // Manual entry (staff/custom only)
  const [godName, setGodName] = useState('')
  const [godId, setGodId] = useState('')
  const [godClass, setGodClass] = useState('')
  const [role, setRole] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // Collection picker (blueprint)
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [collectionEntries, setCollectionEntries] = useState([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)

  // Gift options
  const [message, setMessage] = useState('')
  const [tradeable, setTradeable] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Reset definition when card type changes
  useEffect(() => {
    setSelectedDef(null)
    setDefSearch('')
    setPlayerDefs([])
  }, [cardType])

  // Filtered gods/items based on search
  const filteredDefs = useMemo(() => {
    const q = defSearch.toLowerCase().trim()
    if (cardType === 'god') {
      const list = q ? GODS.filter(g => g.name.toLowerCase().includes(q) || g.class.toLowerCase().includes(q)) : GODS
      return list.slice(0, 30)
    }
    if (cardType === 'item') {
      const list = q ? ITEMS.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)) : ITEMS
      return list.slice(0, 30)
    }
    return []
  }, [cardType, defSearch])

  // Player def search (debounced API)
  const searchPlayerDefs = useCallback((q) => {
    clearTimeout(playerSearchTimer.current)
    if (q.trim().length < 2) { setPlayerDefs([]); return }
    playerSearchTimer.current = setTimeout(async () => {
      setPlayerSearching(true)
      try {
        const data = await vaultAdminService.searchPlayerDefs(q)
        setPlayerDefs(data.defs || [])
      } catch { setPlayerDefs([]) }
      finally { setPlayerSearching(false) }
    }, 300)
  }, [])

  // Load collections when card type switches to blueprint
  useEffect(() => {
    if (cardType !== 'blueprint') return
    setCollectionsLoading(true)
    vaultDashboardService.getCollections()
      .then(data => setCollections((data.collections || []).filter(c => c.status === 'active')))
      .catch(() => setCollections([]))
      .finally(() => setCollectionsLoading(false))
  }, [cardType])

  // Load entries when a collection is selected
  useEffect(() => {
    if (!selectedCollectionId) { setCollectionEntries([]); setSelectedEntry(null); return }
    setEntriesLoading(true)
    setSelectedEntry(null)
    vaultDashboardService.getCollection(selectedCollectionId)
      .then(data => setCollectionEntries(data.entries || []))
      .catch(() => setCollectionEntries([]))
      .finally(() => setEntriesLoading(false))
  }, [selectedCollectionId])

  // Reset collection state when switching away
  useEffect(() => {
    if (cardType !== 'blueprint') {
      setSelectedCollectionId('')
      setCollectionEntries([])
      setSelectedEntry(null)
    }
  }, [cardType])

  const searchUsers = useCallback(async (q) => {
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const data = await vaultDashboardService.searchUsers(q)
      setSearchResults(data.users || [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearch = useCallback((e) => {
    const q = e.target.value
    setSearchQuery(q)
    searchUsers(q)
  }, [searchUsers])

  const selectRecipient = useCallback((user) => {
    setRecipient(user)
    setSearchQuery('')
    setSearchResults([])
  }, [])

  const handleSend = useCallback(async () => {
    if (!recipient) return
    setSending(true)
    setError(null)
    setResult(null)

    const cardConfig = {}
    let blueprintId = null
    let sendCardType = cardType

    if (cardType === 'blueprint') {
      if (!selectedEntry) { setError('Select a card from the collection'); setSending(false); return }
      blueprintId = selectedEntry.blueprint_id
      sendCardType = selectedEntry.card_type || 'custom'
      cardConfig.god_id = `blueprint-${blueprintId}`
      cardConfig.god_name = selectedEntry.template_name
      cardConfig.god_class = selectedEntry.card_type
      cardConfig.role = selectedEntry.card_type || 'custom'
    } else if (cardType === 'god' && selectedDef) {
      cardConfig.god_id = selectedDef.slug
      cardConfig.god_name = selectedDef.name
      cardConfig.god_class = selectedDef.class
      cardConfig.role = CLASS_ROLE[selectedDef.class] || 'mid'
      cardConfig.image_url = getGodCardImageUrl(selectedDef)
      cardConfig.card_data = {
        slug: selectedDef.slug,
        imageKey: selectedDef.imageKey,
        ability: selectedDef.ability,
      }
    } else if (cardType === 'item' && selectedDef) {
      cardConfig.god_id = `item-${selectedDef.id}`
      cardConfig.god_name = selectedDef.name
      cardConfig.god_class = selectedDef.category
      cardConfig.role = null
      cardConfig.image_url = getItemCardImageUrl(selectedDef)
      cardConfig.card_data = {
        itemId: selectedDef.id,
        slug: selectedDef.slug,
        category: selectedDef.category,
        manaCost: selectedDef.manaCost,
        effects: selectedDef.effects,
        passive: selectedDef.passive,
      }
    } else if (cardType === 'player' && selectedDef) {
      // Just send def_id — backend resolves full player data at claim time
      cardConfig.def_id = selectedDef.id
      cardConfig.god_name = selectedDef.player_name
      cardConfig.god_class = (selectedDef.role || 'adc').toUpperCase()
      cardConfig.role = (selectedDef.role || 'adc').toLowerCase()
    } else {
      // Manual entry (staff/custom)
      cardConfig.god_id = godId || godName.toLowerCase().replace(/\s+/g, '-')
      cardConfig.god_name = godName
      cardConfig.god_class = godClass
      cardConfig.role = role || null
      cardConfig.image_url = imageUrl || null
      if (cardType === 'player') cardConfig.card_data = {}
    }

    try {
      const data = await vaultDashboardService.sendPromoGift({
        recipientId: recipient.id,
        cardType: sendCardType,
        rarity,
        blueprintId,
        cardConfig,
        message: message || null,
        tradeable,
      })
      setResult(`Gift sent! ID: ${data.giftId}`)
      setRecipient(null)
      setSelectedDef(null)
      setDefSearch('')
      setGodName('')
      setGodId('')
      setGodClass('')
      setRole('')
      setImageUrl('')
      setMessage('')
      setSelectedCollectionId('')
      setSelectedEntry(null)
    } catch (err) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }, [recipient, cardType, rarity, selectedDef, selectedEntry, godId, godName, godClass, role, imageUrl, message, tradeable])

  const needsDef = cardType === 'god' || cardType === 'item' || cardType === 'player'
  const canSend = recipient && (
    cardType === 'blueprint' ? !!selectedEntry :
    needsDef ? !!selectedDef :
    !!godName
  ) && !sending

  const collectionOptions = [
    { value: '', label: collectionsLoading ? 'Loading collections...' : 'Select a collection' },
    ...collections.map(c => ({ value: String(c.id), label: `${c.name} (${c.entry_count} cards)` })),
  ]

  // --- Render helpers for definition pickers ---

  const renderSelectedDef = () => {
    if (!selectedDef) return null
    let label, sublabel, imgUrl
    if (cardType === 'god') {
      label = selectedDef.name
      sublabel = `${selectedDef.class} / ${CLASS_ROLE[selectedDef.class] || 'mid'}`
      imgUrl = getGodCardImageUrl(selectedDef)
    } else if (cardType === 'item') {
      label = selectedDef.name
      sublabel = selectedDef.category
      imgUrl = getItemCardImageUrl(selectedDef)
    } else if (cardType === 'player') {
      label = selectedDef.player_name
      sublabel = `${selectedDef.team_name} / ${selectedDef.role || 'adc'} / ${selectedDef.season_slug}`
    }
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-cyan)]/30">
        {imgUrl && <img src={imgUrl} alt="" className="w-10 h-10 rounded object-cover" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{label}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{sublabel}</div>
        </div>
        <button onClick={() => { setSelectedDef(null); setDefSearch('') }} className="text-xs text-red-400 hover:text-red-300 font-medium shrink-0">Change</button>
      </div>
    )
  }

  const renderGodPicker = () => (
    <div className="space-y-2">
      <input
        type="text" value={defSearch} onChange={e => setDefSearch(e.target.value)}
        placeholder="Search gods..." className={inputClass}
      />
      <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto rounded-lg border border-[var(--cd-border)] bg-[var(--cd-input)] p-2">
        {filteredDefs.map(god => (
          <button
            key={god.slug}
            onClick={() => setSelectedDef(god)}
            className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <img src={getGodCardImageUrl(god)} alt="" className="w-12 h-12 rounded object-cover" />
            <span className="text-[10px] text-[var(--color-text-primary)] font-medium truncate w-full text-center">{god.name}</span>
          </button>
        ))}
        {filteredDefs.length === 0 && (
          <div className="col-span-4 text-xs text-[var(--color-text-secondary)] py-4 text-center">No gods match</div>
        )}
      </div>
    </div>
  )

  const renderItemPicker = () => (
    <div className="space-y-2">
      <input
        type="text" value={defSearch} onChange={e => setDefSearch(e.target.value)}
        placeholder="Search items..." className={inputClass}
      />
      <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto rounded-lg border border-[var(--cd-border)] bg-[var(--cd-input)] p-2">
        {filteredDefs.map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedDef(item)}
            className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <img src={getItemCardImageUrl(item)} alt="" className="w-10 h-10 rounded object-contain" />
            <span className="text-[10px] text-[var(--color-text-primary)] font-medium truncate w-full text-center">{item.name}</span>
          </button>
        ))}
        {filteredDefs.length === 0 && (
          <div className="col-span-4 text-xs text-[var(--color-text-secondary)] py-4 text-center">No items match</div>
        )}
      </div>
    </div>
  )

  const renderPlayerPicker = () => (
    <div className="space-y-2">
      <input
        type="text" value={defSearch}
        onChange={e => { setDefSearch(e.target.value); searchPlayerDefs(e.target.value) }}
        placeholder="Search players..." className={inputClass}
      />
      {playerSearching && <div className="text-xs text-[var(--color-text-secondary)]">Searching...</div>}
      {playerDefs.length > 0 && (
        <div className="max-h-[250px] overflow-y-auto rounded-lg border border-[var(--cd-border)] bg-[var(--cd-input)]">
          {playerDefs.map(def => (
            <button
              key={def.id}
              onClick={() => { setSelectedDef(def); setPlayerDefs([]) }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-white/5 border-b border-[var(--cd-border)]/50 last:border-b-0 transition-colors"
            >
              <span className="text-[var(--color-text-primary)] font-medium">{def.player_name}</span>
              <span className="text-[var(--color-text-secondary)] ml-2">
                {def.team_name} / {def.role || 'adc'} / {def.league_slug}-{def.division_slug}-{def.season_slug}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (!hasPermission('permission_manage')) return null

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[var(--cd-cyan)]">Send Promo Gift</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Gift a specific card to a user. They'll receive it as a Special Promo Gift Pack.
        </p>
      </div>

      <div className="space-y-5">
        {/* Recipient search */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4">
          <label className={labelClass}>Recipient</label>
          {recipient ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-cyan)]/30">
              <div className="w-6 h-6 rounded-full bg-[var(--cd-cyan)]/20 flex items-center justify-center text-xs text-[var(--cd-cyan)] font-bold">
                {(recipient.player_name || recipient.discord_username || '?')[0].toUpperCase()}
              </div>
              <span className="text-sm text-[var(--color-text-primary)] font-medium">{recipient.player_name || recipient.discord_username}</span>
              <button onClick={() => setRecipient(null)} className="ml-auto text-xs text-red-400 hover:text-red-300 font-medium">Remove</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text" value={searchQuery} onChange={handleSearch}
                placeholder="Search by username..." className={inputClass}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] max-h-48 overflow-y-auto shadow-xl">
                  {searchResults.map(u => (
                    <button
                      key={u.id} onClick={() => selectRecipient(u)}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-white/5 text-[var(--color-text-primary)] border-b border-[var(--cd-border)]/50 last:border-b-0 transition-colors"
                    >
                      {u.player_name || u.discord_username}
                    </button>
                  ))}
                </div>
              )}
              {searching && <div className="text-xs text-[var(--color-text-secondary)] mt-1.5">Searching...</div>}
            </div>
          )}
        </div>

        {/* Card Type + Role */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4 space-y-4">
          <div className={!needsDef && cardType !== 'blueprint' ? 'grid grid-cols-2 gap-4' : ''}>
            <div>
              <label className={labelClass}>Card Type</label>
              <Dropdown value={cardType} onChange={setCardType} options={CARD_TYPES} />
            </div>
            {!needsDef && cardType !== 'blueprint' && (
              <div>
                <label className={labelClass}>Role</label>
                <Dropdown value={role} onChange={setRole} options={ROLES} placeholder="None" />
              </div>
            )}
          </div>

          {/* Rarity */}
          <div>
            <label className={labelClass}>Rarity</label>
            <div className="flex flex-wrap gap-1.5">
              {RARITY_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRarity(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    rarity === r.value ? 'ring-2 ring-white/30 scale-105 shadow-lg' : 'opacity-50 hover:opacity-75'
                  }`}
                  style={{ borderColor: r.color, color: r.color, background: rarity === r.value ? `${r.color}20` : 'transparent' }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card Definition / Details */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4 space-y-4">
          <label className={labelClass + ' !mb-0'}>
            {needsDef ? 'Select Card' : 'Card Details'}
          </label>

          {cardType === 'god' && (selectedDef ? renderSelectedDef() : renderGodPicker())}
          {cardType === 'item' && (selectedDef ? renderSelectedDef() : renderItemPicker())}
          {cardType === 'player' && (selectedDef ? renderSelectedDef() : renderPlayerPicker())}

          {cardType === 'blueprint' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Collection</label>
                <Dropdown
                  value={selectedCollectionId}
                  onChange={setSelectedCollectionId}
                  options={collectionOptions}
                  placeholder={collectionsLoading ? 'Loading collections...' : 'Select a collection'}
                  disabled={collectionsLoading}
                />
              </div>

              {selectedCollectionId && (
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Card</label>
                  {entriesLoading ? (
                    <div className="text-xs text-[var(--color-text-secondary)] py-2">Loading cards...</div>
                  ) : collectionEntries.length === 0 ? (
                    <div className="text-xs text-[var(--color-text-secondary)] py-2">No cards in this collection</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto rounded-lg border border-[var(--cd-border)] bg-[var(--cd-input)] p-3">
                      {collectionEntries.map(entry => {
                        const td = typeof entry.template_data === 'string' ? JSON.parse(entry.template_data) : (entry.template_data || {})
                        const isSelected = selectedEntry?.id === entry.id
                        return (
                          <button
                            key={entry.id}
                            onClick={() => setSelectedEntry(entry)}
                            className={`relative rounded-lg p-2 transition-all text-center ${
                              isSelected
                                ? 'bg-[var(--cd-cyan)]/15 ring-2 ring-[var(--cd-cyan)]/50'
                                : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="flex justify-center pointer-events-none">
                              <VaultCard
                                card={{
                                  rarity: entry.rarity || 'common',
                                  cardType: entry.card_type || 'custom',
                                  blueprintId: entry.blueprint_id,
                                  _blueprintData: {
                                    cardData: td.cardData,
                                    elements: td.elements,
                                    border: td.border,
                                    cardType: entry.card_type || 'custom',
                                  },
                                }}
                                size={100}
                              />
                            </div>
                            <div className="mt-1.5 text-xs text-[var(--color-text-primary)] font-medium truncate">{entry.template_name}</div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--cd-cyan)] flex items-center justify-center">
                                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {selectedEntry && (
                    <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                      Card type: <span className="text-[var(--color-text-primary)] font-medium">{selectedEntry.card_type}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(cardType === 'staff' || cardType === 'custom') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Name</label>
                <input type="text" value={godName} onChange={e => setGodName(e.target.value)} placeholder="e.g. Thor" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">ID / Slug</label>
                <input type="text" value={godId} onChange={e => setGodId(e.target.value)} placeholder="e.g. smite-thor" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Class</label>
                <input type="text" value={godClass} onChange={e => setGodClass(e.target.value)} placeholder="e.g. Assassin" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Image URL</label>
                <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
            </div>
          )}
        </div>

        {/* Gift Options */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4 space-y-4">
          <label className={labelClass + ' !mb-0'}>Gift Options</label>

          {/* Tradeable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-primary)]">Tradeable</span>
            <button
              onClick={() => setTradeable(!tradeable)}
              className={`relative w-10 rounded-full transition-colors ${tradeable ? 'bg-emerald-500' : 'bg-gray-600'}`}
              style={{ height: '22px' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: tradeable ? '22px' : '2px' }}
              />
            </button>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Message (optional)</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Congrats on the tournament win!"
              rows={2} className={inputClass}
              maxLength={500}
            />
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:brightness-95"
          style={{ background: 'linear-gradient(135deg, #d4af37, #f0d060)' }}
        >
          {sending ? 'Sending...' : 'Send Promo Gift'}
        </button>

        {result && (
          <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400 font-medium">
            {result}
          </div>
        )}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
