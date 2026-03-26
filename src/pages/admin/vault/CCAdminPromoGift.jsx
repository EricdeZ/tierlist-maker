import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { vaultService, vaultDashboardService } from '../../../services/database'
import { RARITIES } from '../../../data/vault/economy'
import VaultCard from '../../vault/components/VaultCard'

const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'item', label: 'Item' },
  { value: 'player', label: 'Player' },
  { value: 'collection', label: 'Collection' },
  { value: 'staff', label: 'Staff' },
  { value: 'custom', label: 'Custom' },
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
  const [godName, setGodName] = useState('')
  const [godId, setGodId] = useState('')
  const [godClass, setGodClass] = useState('')
  const [role, setRole] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  // Collection picker
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

  if (!hasPermission('permission_manage')) return null

  // Load collections when card type switches to collection
  useEffect(() => {
    if (cardType !== 'collection') return
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
    if (cardType !== 'collection') {
      setSelectedCollectionId('')
      setCollectionEntries([])
      setSelectedEntry(null)
    }
  }, [cardType])

  const searchUsers = useCallback(async (q) => {
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const data = await vaultService.searchUsers(q)
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
    let templateId = null

    if (cardType === 'collection') {
      if (!selectedEntry) { setError('Select a card from the collection'); setSending(false); return }
      templateId = selectedEntry.template_id
      cardConfig.god_id = `collection-${templateId}`
      cardConfig.god_name = selectedEntry.template_name
      cardConfig.god_class = selectedEntry.card_type
      cardConfig.role = 'staff'
    } else {
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
        cardType,
        rarity,
        templateId,
        cardConfig,
        message: message || null,
        tradeable,
      })
      setResult(`Gift sent! ID: ${data.giftId}`)
      setRecipient(null)
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
  }, [recipient, cardType, rarity, selectedEntry, godId, godName, godClass, role, imageUrl, message, tradeable])

  const canSend = recipient && (cardType === 'collection' ? !!selectedEntry : !!godName) && !sending

  const collectionOptions = [
    { value: '', label: collectionsLoading ? 'Loading collections...' : 'Select a collection' },
    ...collections.map(c => ({ value: String(c.id), label: `${c.name} (${c.entry_count} cards)` })),
  ]

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
                {(recipient.playerName || recipient.discordUsername || '?')[0].toUpperCase()}
              </div>
              <span className="text-sm text-[var(--color-text-primary)] font-medium">{recipient.playerName || recipient.discordUsername}</span>
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
                      {u.playerName || u.discordUsername}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Card Type</label>
              <Dropdown value={cardType} onChange={setCardType} options={CARD_TYPES} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <Dropdown value={role} onChange={setRole} options={ROLES} placeholder="None" />
            </div>
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

        {/* Card Configuration */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4 space-y-4">
          <label className={labelClass + ' !mb-0'}>Card Details</label>

          {cardType === 'collection' ? (
            <div className="space-y-3">
              {/* Collection picker */}
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

              {/* Card picker from collection entries */}
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
                                  templateId: entry.template_id,
                                  _templateData: {
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
                </div>
              )}
            </div>
          ) : (
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
