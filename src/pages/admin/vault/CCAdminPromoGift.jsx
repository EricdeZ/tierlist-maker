import { useState, useCallback } from 'react'
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

export default function CCAdminPromoGift() {
  const { hasPermission } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [recipient, setRecipient] = useState(null)
  const [cardType, setCardType] = useState('god')
  const [rarity, setRarity] = useState('legendary')
  const [templateId, setTemplateId] = useState('')
  const [godName, setGodName] = useState('')
  const [godId, setGodId] = useState('')
  const [godClass, setGodClass] = useState('')
  const [role, setRole] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [message, setMessage] = useState('')
  const [tradeable, setTradeable] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (!hasPermission('permission_manage')) return null

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
    if (cardType === 'god' || cardType === 'item' || cardType === 'custom' || cardType === 'staff') {
      cardConfig.god_id = godId || godName.toLowerCase().replace(/\s+/g, '-')
      cardConfig.god_name = godName
      cardConfig.god_class = godClass
      cardConfig.role = role || null
      cardConfig.image_url = imageUrl || null
    } else if (cardType === 'player') {
      cardConfig.god_id = godId
      cardConfig.god_name = godName
      cardConfig.god_class = godClass
      cardConfig.role = role || null
      cardConfig.image_url = imageUrl || null
      cardConfig.card_data = {}
    } else if (cardType === 'collection') {
      cardConfig.god_id = `collection-${templateId}`
      cardConfig.god_name = godName
      cardConfig.god_class = cardType
      cardConfig.role = 'collection'
    }

    try {
      const data = await vaultDashboardService.sendPromoGift({
        recipientId: recipient.id,
        cardType,
        rarity,
        templateId: cardType === 'collection' ? Number(templateId) : null,
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
      setTemplateId('')
    } catch (err) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }, [recipient, cardType, rarity, templateId, godId, godName, godClass, role, imageUrl, message, tradeable])

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)] text-[var(--color-text-primary)] text-sm'
  const labelClass = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[var(--cd-cyan)]">Send Promo Gift</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Gift a specific card to a user. They'll receive it as a Special Promo Gift Pack.
      </p>

      {/* Recipient search */}
      <div>
        <label className={labelClass}>Recipient</label>
        {recipient ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--cd-input)] border border-[var(--cd-border)]">
            <span className="text-sm text-[var(--color-text-primary)]">{recipient.playerName || recipient.discordUsername}</span>
            <button onClick={() => setRecipient(null)} className="ml-auto text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text" value={searchQuery} onChange={handleSearch}
              placeholder="Search by username..." className={inputClass}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] max-h-48 overflow-y-auto">
                {searchResults.map(u => (
                  <button
                    key={u.id} onClick={() => selectRecipient(u)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--cd-hover)] text-[var(--color-text-primary)]"
                  >
                    {u.playerName || u.discordUsername}
                  </button>
                ))}
              </div>
            )}
            {searching && <div className="text-xs text-[var(--color-text-secondary)] mt-1">Searching...</div>}
          </div>
        )}
      </div>

      {/* Card type */}
      <div>
        <label className={labelClass}>Card Type</label>
        <select value={cardType} onChange={e => setCardType(e.target.value)} className={inputClass}>
          {CARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Rarity */}
      <div>
        <label className={labelClass}>Rarity</label>
        <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setRarity(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                rarity === r.value ? 'ring-2 ring-white/40 scale-105' : 'opacity-60 hover:opacity-80'
              }`}
              style={{ borderColor: r.color, color: r.color, background: rarity === r.value ? `${r.color}20` : 'transparent' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card config — conditional fields */}
      {cardType === 'collection' ? (
        <div>
          <label className={labelClass}>Template ID</label>
          <input type="number" value={templateId} onChange={e => setTemplateId(e.target.value)} placeholder="Approved template ID" className={inputClass} />
          <label className={labelClass + ' mt-3'}>Card Name</label>
          <input type="text" value={godName} onChange={e => setGodName(e.target.value)} placeholder="Display name" className={inputClass} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={godName} onChange={e => setGodName(e.target.value)} placeholder="e.g. Thor" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ID / Slug</label>
            <input type="text" value={godId} onChange={e => setGodId(e.target.value)} placeholder="e.g. smite-thor" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <input type="text" value={godClass} onChange={e => setGodClass(e.target.value)} placeholder="e.g. Assassin" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
              <option value="">None</option>
              <option value="solo">Solo</option>
              <option value="jungle">Jungle</option>
              <option value="mid">Mid</option>
              <option value="support">Support</option>
              <option value="adc">ADC</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Image URL</label>
            <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </div>
        </div>
      )}

      {/* Tradeable toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={tradeable} onChange={e => setTradeable(e.target.checked)} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
        <span className="text-sm text-[var(--color-text-primary)]">Tradeable</span>
      </div>

      {/* Message */}
      <div>
        <label className={labelClass}>Message (optional)</label>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Congrats on the tournament win!"
          rows={2} className={inputClass}
          maxLength={500}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!recipient || !godName || sending}
        className="px-6 py-2.5 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #d4af37, #f0d060)' }}
      >
        {sending ? 'Sending...' : 'Send Promo Gift'}
      </button>

      {result && <div className="text-sm text-green-400 font-medium">{result}</div>}
      {error && <div className="text-sm text-red-400 font-medium">{error}</div>}
    </div>
  )
}
