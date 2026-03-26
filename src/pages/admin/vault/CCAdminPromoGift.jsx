import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { vaultDashboardService } from '../../../services/database'
import { RARITIES } from '../../../data/vault/economy'

const CARD_TYPES = [
  { value: 'god', label: 'God' },
  { value: 'item', label: 'Item' },
  { value: 'player', label: 'Player' },
  { value: 'collection', label: 'Collection' },
  { value: 'staff', label: 'Staff' },
  { value: 'custom', label: 'Custom' },
]

const RARITY_OPTIONS = Object.entries(RARITIES)
  .filter(([key]) => key !== 'full_art')
  .map(([key, val]) => ({ value: key, label: val.name, color: val.color }))

const selectClass = 'w-full px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)] text-[var(--color-text-primary)] text-sm appearance-none cursor-pointer focus:outline-none focus:border-[var(--cd-cyan)]/50 focus:ring-1 focus:ring-[var(--cd-cyan)]/30 transition-colors'
const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--cd-cyan)]/50 focus:ring-1 focus:ring-[var(--cd-cyan)]/30 transition-colors placeholder:text-[var(--color-text-secondary)]/50'
const labelClass = 'block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide'

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
    let templateId = null

    if (cardType === 'collection') {
      if (!selectedEntry) { setError('Select a card from the collection'); setSending(false); return }
      templateId = selectedEntry.template_id
      cardConfig.god_id = `collection-${templateId}`
      cardConfig.god_name = selectedEntry.template_name
      cardConfig.god_class = selectedEntry.card_type
      cardConfig.role = 'collection'
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
                <div className="absolute z-10 w-full mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] max-h-48 overflow-y-auto shadow-xl">
                  {searchResults.map(u => (
                    <button
                      key={u.id} onClick={() => selectRecipient(u)}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--cd-hover)] text-[var(--color-text-primary)] border-b border-[var(--cd-border)] last:border-b-0 transition-colors"
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

        {/* Card Type + Rarity row */}
        <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Card Type</label>
              <div className="relative">
                <select value={cardType} onChange={e => setCardType(e.target.value)} className={selectClass}>
                  {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <div className="relative">
                <select value={role} onChange={e => setRole(e.target.value)} className={selectClass}>
                  <option value="">None</option>
                  <option value="solo">Solo</option>
                  <option value="jungle">Jungle</option>
                  <option value="mid">Mid</option>
                  <option value="support">Support</option>
                  <option value="adc">ADC</option>
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
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
                <div className="relative">
                  <select
                    value={selectedCollectionId}
                    onChange={e => setSelectedCollectionId(e.target.value)}
                    className={selectClass}
                    disabled={collectionsLoading}
                  >
                    <option value="">
                      {collectionsLoading ? 'Loading collections...' : 'Select a collection'}
                    </option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.entry_count} cards)</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
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
                    <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto rounded-lg border border-[var(--cd-border)] bg-[var(--cd-input)] p-1.5">
                      {collectionEntries.map(entry => (
                        <button
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                            selectedEntry?.id === entry.id
                              ? 'bg-[var(--cd-cyan)]/15 border border-[var(--cd-cyan)]/40 ring-1 ring-[var(--cd-cyan)]/20'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          {entry.thumbnail_url ? (
                            <img src={entry.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover bg-black/30" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-xs text-[var(--color-text-secondary)]">?</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-[var(--color-text-primary)] font-medium truncate">{entry.template_name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">{entry.card_type} &middot; {entry.source_type}</div>
                          </div>
                          {selectedEntry?.id === entry.id && (
                            <svg className="w-4 h-4 text-[var(--cd-cyan)] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      ))}
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
              className={`relative w-10 h-5.5 rounded-full transition-colors ${tradeable ? 'bg-emerald-500' : 'bg-gray-600'}`}
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
