import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useVault } from './VaultContext'
import { vaultService } from '../../services/database'
import { Gift, Send, Search, X, Package, Plus, ShoppingCart, TicketCheck } from 'lucide-react'
import PackOpening from './components/PackOpening'
import PackArt from './components/PackArt'
import emberIcon from '../../assets/ember.png'

export default function CCGifts() {
  const { giftData, sendGift, openGift, markGiftsSeen, refreshGifts, buyGiftPack, ember, packTypes, packTypesMap } = useVault()
  const [tab, setTab] = useState('received')
  const [openResult, setOpenResult] = useState(null)

  // Mark as seen when viewing received tab
  useEffect(() => {
    if (tab === 'received' && giftData.unseenCount > 0) {
      markGiftsSeen()
    }
  }, [tab, giftData.unseenCount, markGiftsSeen])

  const { sent, received, giftsRemaining, giftInventory = [] } = giftData
  const totalSendable = giftsRemaining + giftInventory.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="min-w-0">
          <h2 className="cd-head text-base sm:text-lg font-bold text-[var(--cd-cyan)] cd-text-glow tracking-wider">Gifts</h2>
          <p className="text-[11px] sm:text-xs text-white/40 mt-1">Send gift packs to other players</p>
        </div>
        {giftsRemaining > 0 && (
          <div className="cd-head text-[11px] sm:text-xs text-white/50 tracking-wider shrink-0">
            <span className="text-[var(--cd-cyan)] font-bold">{giftsRemaining}</span> / 5 <span className="hidden sm:inline">free gifts </span>left
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-4 mb-6 border-b border-[var(--cd-border)]">
        {[
          { key: 'received', label: 'Received', count: received.filter(g => !g.opened).length },
          { key: 'send', label: 'Send', count: totalSendable },
          { key: 'sent', label: 'Sent', count: 0 },
          { key: 'redeem', label: 'Redeem', count: 0 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative pb-3 text-sm font-bold uppercase tracking-wider cd-head transition-all cursor-pointer ${
              tab === t.key ? 'text-[var(--cd-cyan)]' : 'text-white/30 hover:text-white/60'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-[10px]">
                {t.count}
              </span>
            )}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 cd-tab-active cd-neon-shine" />}
          </button>
        ))}
      </div>

      {tab === 'received' && <ReceivedGifts received={received} onOpen={openGift} setOpenResult={setOpenResult} packTypesMap={packTypesMap} />}
      {tab === 'send' && (
        <SendGiftSection
          giftsRemaining={giftsRemaining}
          giftInventory={giftInventory}
          sent={sent}
          emberBalance={ember?.balance ?? 0}
          onSend={sendGift}
          onRefresh={refreshGifts}
          onBuyGiftPack={buyGiftPack}
          packTypes={packTypes}
          packTypesMap={packTypesMap}
        />
      )}
      {tab === 'sent' && <SentGifts sent={sent} packTypesMap={packTypesMap} />}
      {tab === 'redeem' && <RedeemSection setOpenResult={setOpenResult} />}

      {openResult && (
        <PackOpening
          result={openResult}
          packType={openResult.packType || 'gift'}
          onClose={() => setOpenResult(null)}
          onOpenMore={() => setOpenResult(null)}
        />
      )}
    </div>
  )
}

function ReceivedGifts({ received, onOpen, setOpenResult, packTypesMap }) {
  const [opening, setOpening] = useState(null)

  const handleOpen = async (gift) => {
    setOpening(gift.id)
    try {
      const result = await onOpen(gift.id)
      setOpenResult(result)
    } catch (err) {
      console.error('Failed to open gift:', err)
    } finally {
      setOpening(null)
    }
  }

  if (received.length === 0) {
    return (
      <div className="text-center py-16">
        <Gift className="w-10 h-10 text-white/15 mx-auto mb-3" />
        <p className="text-white/30 cd-head tracking-wider text-sm">No gifts received yet</p>
        <p className="text-white/20 text-xs mt-1">When someone sends you a gift pack, it will appear here</p>
      </div>
    )
  }

  const unopened = received.filter(g => !g.opened)
  const opened = received.filter(g => g.opened)

  const getPackLabel = (packType) => {
    if (packType === 'gift') return '7 cards from both leagues'
    const pack = packTypesMap[packType]
    return pack ? `${pack.name} — ${pack.cards} cards` : 'Gift pack'
  }

  return (
    <div className="space-y-3">
      {unopened.map((gift, i) => (
        <div
          key={gift.id}
          className="cd-panel cd-corners rounded-xl overflow-hidden border-l-3 border-l-[var(--cd-cyan)]"
          style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
        >
          <div className="p-4 flex items-center gap-4">
            <div className="shrink-0">
              {gift.senderAvatar ? (
                <img src={gift.senderAvatar} alt="" className="w-10 h-10 rounded-full ring-2 ring-[var(--cd-cyan)]/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--cd-cyan)]/10 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-[var(--cd-cyan)]" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--cd-text)] cd-head">{gift.senderName}</span>
                <span className="text-[10px] text-white/30">{formatTimeAgo(gift.createdAt)}</span>
              </div>
              {gift.message && (
                <p className="text-xs text-white/50 mt-1 italic truncate">"{gift.message}"</p>
              )}
              <p className="text-[11px] text-white/30 mt-0.5">{getPackLabel(gift.packType)}</p>
            </div>
            <button
              onClick={() => handleOpen(gift)}
              disabled={opening === gift.id}
              className="shrink-0 px-5 py-2.5 rounded-lg font-bold text-xs cd-head tracking-wider transition-all cursor-pointer cd-btn-solid cd-btn-action disabled:opacity-50"
            >
              {opening === gift.id ? (
                <div className="cd-spinner w-4 h-4" />
              ) : (
                <>
                  <Package className="w-3.5 h-3.5 inline mr-1.5" />
                  Open
                </>
              )}
            </button>
          </div>
        </div>
      ))}

      {opened.length > 0 && (
        <>
          {unopened.length > 0 && (
            <div className="text-[10px] text-white/20 uppercase tracking-wider cd-head mt-6 mb-2">Previously opened</div>
          )}
          {opened.map(gift => (
            <div key={gift.id} className="cd-panel cd-corners rounded-xl overflow-hidden opacity-50">
              <div className="p-4 flex items-center gap-4">
                <div className="shrink-0">
                  {gift.senderAvatar ? (
                    <img src={gift.senderAvatar} alt="" className="w-8 h-8 rounded-full opacity-60" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <Gift className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-white/40 cd-head">{gift.senderName}</span>
                  {gift.message && <p className="text-xs text-white/25 mt-0.5 italic truncate">"{gift.message}"</p>}
                </div>
                <div className="text-[10px] text-green-400/50 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Opened {gift.openedAt ? formatTimeAgo(gift.openedAt) : ''}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function SendGiftSection({ giftsRemaining, giftInventory, sent, emberBalance, onSend, onRefresh, onBuyGiftPack, packTypes, packTypesMap }) {
  const [sendingPack, setSendingPack] = useState(null) // { packType, index? } for the send modal
  const [sentSuccess, setSentSuccess] = useState(false)
  const [buying, setBuying] = useState(null)
  const [buyResult, setBuyResult] = useState(null)

  const totalPacks = 5
  const freeGiftsSent = sent.filter(g => g.packType === 'gift')
  const alreadySentTo = new Set(freeGiftsSent.map(g => g.recipientId))

  const handleSent = async () => {
    setSendingPack(null)
    setSentSuccess(true)
    await onRefresh()
    setTimeout(() => setSentSuccess(false), 3000)
  }

  const handleBuy = async (packType) => {
    setBuying(packType)
    try {
      await onBuyGiftPack(packType)
      setBuyResult(packType)
      setTimeout(() => setBuyResult(null), 2500)
    } catch (err) {
      alert(err.message || 'Failed to buy pack')
    } finally {
      setBuying(null)
    }
  }

  return (
    <div>
      {sentSuccess && (
        <div className="mb-6 py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm text-center cd-head tracking-wider">
          Gift sent successfully!
        </div>
      )}

      {/* ═══ Free Gift Packs ═══ */}
      {giftsRemaining > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">Free Gift Packs</div>
          <div className="flex items-center justify-center gap-5 sm:gap-8 flex-wrap pb-2">
            {Array.from({ length: totalPacks }).map((_, i) => {
              const isSent = i < freeGiftsSent.length
              const recipient = isSent ? freeGiftsSent[i] : null

              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3"
                  style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.1}s both` }}
                >
                  <div className={`relative transition-all duration-300 ${isSent ? 'opacity-30 grayscale' : 'hover:scale-105'}`}>
                    <PackArt
                      tier="gift"
                      name="Gift Pack"
                      subtitle="5 Cards"
                      cardCount={5}
                      seed={i}
                      compact
                    />
                    {isSent && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/70 rounded-lg px-3 py-1.5 text-[10px] text-white/60 cd-head tracking-wider font-bold uppercase">
                          Sent
                        </div>
                      </div>
                    )}
                  </div>

                  {isSent ? (
                    <div className="text-center">
                      <div className="text-[10px] text-white/30 cd-head truncate max-w-[120px]">
                        To: {recipient.recipientName}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSendingPack({ packType: 'gift' })}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(220,38,38,0.15)]"
                    >
                      <Send className="w-3 h-3 inline mr-1.5" />
                      Send
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Purchased Packs Inventory ═══ */}
      {giftInventory.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] text-white/30 uppercase tracking-widest cd-head mb-4">Purchased Packs</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {giftInventory.map((item) => {
              const pack = packTypesMap[item.packType]
              if (!pack) return null
              return (
                <div
                  key={item.packType}
                  className="cd-panel cd-corners rounded-xl p-4 flex items-center gap-4"
                  style={{ animation: 'vault-card-enter 0.4s ease-out' }}
                >
                  <div className="shrink-0">
                    <PackArt tier={item.packType} name={pack.name} subtitle={`${pack.cards} Cards`} cardCount={pack.cards} seed={7} compact />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold cd-head tracking-wider" style={{ color: pack.color || 'var(--cd-text)' }}>{pack.name}</div>
                    <div className="text-[11px] text-white/40">{pack.cards} cards</div>
                    <div className="text-xs text-white/50 mt-1">
                      <span className="text-[var(--cd-cyan)] font-bold">{item.quantity}</span> in stock
                    </div>
                  </div>
                  <button
                    onClick={() => setSendingPack({ packType: item.packType })}
                    className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold cd-head tracking-wider transition-all cursor-pointer bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(220,38,38,0.15)]"
                  >
                    <Send className="w-3 h-3 inline mr-1.5" />
                    Send
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Buy More ═══ */}
      <div className="cd-divider max-w-lg mx-auto mb-6" />

      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-4 h-4 text-[var(--cd-cyan)]" />
          <span className="text-sm font-bold text-[var(--cd-text)] cd-head tracking-wider">Buy Packs to Gift</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packTypes.filter(p => p.leagueId).map((pack) => {
            const key = pack.id
            const canAfford = emberBalance >= pack.cost
            const isBuying = buying === key
            const justBought = buyResult === key

            return (
              <div key={key} className="cd-panel cd-corners rounded-xl p-4" style={{ animation: 'vault-card-enter 0.4s ease-out 0.1s both' }}>
                <div className="flex items-center gap-3 mb-3">
                  <PackArt tier={key} name={pack.name} subtitle={`${pack.cards} Cards`} cardCount={pack.cards} seed={pack.sortOrder ?? 8} compact />
                  <div className="min-w-0">
                    <div className="text-sm font-bold cd-head tracking-wider" style={{ color: pack.color || 'var(--cd-text)' }}>{pack.name}</div>
                    <div className="text-[11px] text-white/40">{pack.cards} cards per pack</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <img src={emberIcon} alt="" className="h-4 w-auto object-contain cd-icon-glow" />
                    <span className="text-lg font-bold text-[var(--cd-cyan)] cd-num">{pack.cost}</span>
                    <span className="text-[10px] text-white/30">Cores</span>
                  </div>
                  {(() => {
                    const inv = giftInventory.find(i => i.packType === key)
                    return inv ? (
                      <div className="text-[10px] text-white/40">
                        <span className="text-[var(--cd-cyan)] font-bold">{inv.quantity}</span> owned
                      </div>
                    ) : null
                  })()}
                </div>

                {justBought ? (
                  <div className="text-center py-1.5 text-sm cd-result-flash rounded-lg">
                    <span className="text-emerald-400 font-bold">Purchased!</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleBuy(key)}
                    disabled={!canAfford || isBuying}
                    className={`w-full py-2 rounded-lg font-bold text-xs cd-head tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      canAfford
                        ? 'cd-btn-solid cd-btn-action'
                        : 'bg-[var(--cd-edge)] text-[var(--cd-text-dim)] cursor-not-allowed'
                    }`}
                  >
                    {isBuying ? (
                      <div className="cd-spinner w-3.5 h-3.5" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        {canAfford ? 'Buy' : `Need ${pack.cost} Cores`}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Send Modal */}
      {sendingPack && (
        <SendGiftModal
          packType={sendingPack.packType}
          alreadySentTo={sendingPack.packType === 'gift' ? alreadySentTo : null}
          onSend={onSend}
          onClose={() => setSendingPack(null)}
          onSuccess={handleSent}
          packTypesMap={packTypesMap}
        />
      )}
    </div>
  )
}

function SendGiftModal({ packType, alreadySentTo, onSend, onClose, onSuccess, packTypesMap }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const searchTimeout = useRef(null)

  const pack = packTypesMap[packType]
  const packLabel = pack ? pack.name : 'Gift Pack'

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const data = await vaultService.searchUsers(q.trim())
      setSearchResults(data.users || [])
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    setSelectedUser(null)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(val), 300)
  }

  const handleSelect = (user) => {
    setSelectedUser(user)
    setSearchQuery(user.discordUsername + (user.playerName ? ` (${user.playerName})` : ''))
    setSearchResults([])
  }

  const handleSend = async () => {
    if (!selectedUser) return
    setSending(true)
    try {
      await onSend(selectedUser.id, message.trim() || null, packType)
      onSuccess()
    } catch (err) {
      console.error('Failed to send gift:', err)
      alert(err.message || 'Failed to send gift')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="cd-panel cd-corners rounded-xl p-6 w-full max-w-md mx-4 relative"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'vault-card-enter 0.3s ease-out' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/60 cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <Gift className="w-5 h-5 text-red-400" />
          <h3 className="cd-head text-sm font-bold text-[var(--cd-text)] tracking-wider">Send {packLabel}</h3>
        </div>

        {/* Recipient search */}
        <div className="mb-4">
          <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wider cd-head">Recipient</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by SMITE name or Discord name..."
              autoFocus
              className="w-full pl-9 pr-8 py-2.5 rounded-lg bg-white/[0.04] border border-[var(--cd-border)] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedUser(null); setSearchResults([]) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {searchResults.length > 0 && !selectedUser && (
            <div className="mt-1 rounded-lg bg-[var(--cd-surface)] border border-[var(--cd-border)] overflow-hidden max-h-48 overflow-y-auto">
              {searchResults.map(user => {
                const blocked = alreadySentTo?.has(user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => !blocked && handleSelect(user)}
                    disabled={blocked}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      blocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04] cursor-pointer'
                    }`}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold">
                        {(user.discordUsername || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm text-white/80 truncate">{user.discordUsername}</div>
                      {user.playerName && <div className="text-[10px] text-white/30">{user.playerName}</div>}
                    </div>
                    {blocked && <span className="ml-auto text-[10px] text-white/25">Already gifted</span>}
                  </button>
                )
              })}
            </div>
          )}

          {searching && (
            <div className="mt-2 text-xs text-white/30 flex items-center gap-2">
              <div className="cd-spinner w-3 h-3" /> Searching...
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && (
            <div className="mt-2 text-xs text-white/25">No users found</div>
          )}
        </div>

        {/* Message */}
        <div className="mb-5">
          <label className="block text-[11px] text-white/40 mb-1.5 uppercase tracking-wider cd-head">
            Message <span className="text-white/20">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            placeholder="Add a personal message..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-[var(--cd-border)] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/40 transition-colors resize-none"
          />
          <div className="text-right text-[10px] text-white/20 mt-0.5">{message.length}/200</div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!selectedUser || sending}
          className="w-full py-3 rounded-lg font-bold text-sm cd-head tracking-wider transition-all cursor-pointer bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {sending ? (
            <div className="cd-spinner w-4 h-4" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send {packLabel}
            </>
          )}
        </button>

        <p className="text-[10px] text-white/20 mt-3 text-center">
          {pack ? `${pack.cards} cards${pack.leagueName ? ` — ${pack.leagueName}` : ''}` : 'Contains 7 cards from both leagues'}
        </p>
      </div>
    </div>
  )
}

function SentGifts({ sent, packTypesMap }) {
  if (sent.length === 0) {
    return (
      <div className="text-center py-16">
        <Send className="w-10 h-10 text-white/15 mx-auto mb-3" />
        <p className="text-white/30 cd-head tracking-wider text-sm">No gifts sent yet</p>
        <p className="text-white/20 text-xs mt-1">Send a gift pack to a friend!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sent.map((gift, i) => {
        const pack = gift.packType !== 'gift' ? packTypesMap[gift.packType] : null
        return (
          <div
            key={gift.id}
            className="cd-panel cd-corners rounded-xl overflow-hidden"
            style={{ animation: `vault-card-enter 0.4s ease-out ${i * 0.08}s both` }}
          >
            <div className="p-4 flex items-center gap-4">
              <div className="shrink-0">
                {gift.recipientAvatar ? (
                  <img src={gift.recipientAvatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-white/30 font-bold">
                    {(gift.recipientName || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--cd-text)] cd-head">{gift.recipientName}</span>
                  {pack && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5" style={{ color: pack.color || 'var(--cd-text)' }}>
                      {pack.name}
                    </span>
                  )}
                </div>
                {gift.message && (
                  <p className="text-xs text-white/40 mt-0.5 italic truncate">"{gift.message}"</p>
                )}
              </div>
              <div className="text-[10px] text-white/25 shrink-0">
                {formatTimeAgo(gift.createdAt)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RedeemSection({ setOpenResult }) {
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleRedeem = async () => {
    if (!code.trim()) return
    setRedeeming(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await vaultService.redeemCode(code.trim())
      setSuccess(true)
      setCode('')
      setOpenResult(result)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to redeem code')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="py-8">
        <TicketCheck className="w-10 h-10 text-[var(--cd-cyan)]/30 mx-auto mb-4" />
        <h3 className="cd-head text-sm font-bold text-[var(--cd-text)] tracking-wider mb-2">Redeem a Code</h3>
        <p className="text-xs text-white/30 mb-6">Enter a pack code to claim your cards</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && !redeeming && handleRedeem()}
            placeholder="ENTER CODE"
            className="flex-1 px-4 py-3 rounded-lg bg-white/[0.04] border border-[var(--cd-border)] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--cd-cyan)]/40 transition-colors text-center tracking-widest cd-head font-bold uppercase"
          />
          <button
            onClick={handleRedeem}
            disabled={!code.trim() || redeeming}
            className="px-6 py-3 rounded-lg font-bold text-xs cd-head tracking-wider transition-all cursor-pointer cd-btn-solid cd-btn-action disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {redeeming ? <div className="cd-spinner w-4 h-4" /> : 'Redeem'}
          </button>
        </div>

        {error && (
          <div className="mt-4 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs cd-head tracking-wider">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs cd-head tracking-wider">
            Code redeemed successfully!
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
