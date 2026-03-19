import { useState, useEffect, useCallback } from 'react'
import { vaultAdminService } from '../../../services/database'
import { Search, Send, Trash2, RefreshCw, FlaskConical } from 'lucide-react'

const STATUS_COLORS = {
  pending: 'text-amber-400 bg-amber-400/10',
  signed: 'text-emerald-400 bg-emerald-400/10',
  declined: 'text-red-400 bg-red-400/10',
}

export default function CCAdminSignatures() {
  const [requests, setRequests] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sending, setSending] = useState(null)
  const [creatingTest, setCreatingTest] = useState(false)
  const [testCard, setTestCard] = useState(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerResults, setPlayerResults] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [searchingPlayers, setSearchingPlayers] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const loadRequests = useCallback(async () => {
    try {
      const data = await vaultAdminService.listSignatureRequests(statusFilter)
      setRequests(data.requests || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { loadRequests() }, [loadRequests])

  const searchCards = async () => {
    setSearching(true)
    setError(null)
    try {
      const data = await vaultAdminService.searchUniqueCards(search)
      setCards(data.cards || [])
    } catch (e) {
      setError(e.message)
    }
    setSearching(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => { if (search.length >= 1) searchCards(); else setCards([]) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const sendRequest = async (cardId) => {
    setSending(cardId)
    setError(null)
    setSuccess(null)
    try {
      await vaultAdminService.adminRequestSignature(cardId)
      setSuccess(`Signature request sent for card #${cardId}`)
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, hasRequest: true } : c))
      loadRequests()
    } catch (e) {
      setError(e.message || 'Failed to send request')
    }
    setSending(null)
  }

  const deleteRequest = async (requestId) => {
    if (!confirm('Delete this signature request?')) return
    try {
      await vaultAdminService.deleteSignatureRequest(requestId)
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    if (playerSearch.length < 2) { setPlayerResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingPlayers(true)
      try {
        const data = await vaultAdminService.searchPlayerDefs(playerSearch)
        setPlayerResults(data.defs || [])
      } catch {}
      setSearchingPlayers(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [playerSearch])

  const createTestCard = async () => {
    if (!selectedPlayer) return
    setCreatingTest(true)
    setError(null)
    setSuccess(null)
    setTestCard(null)
    try {
      const data = await vaultAdminService.createTestSignatureCard(selectedPlayer.id)
      setTestCard(data.card)
      setSuccess(`Test card #${data.card.id} created for player "${data.card.playerName}" (${data.card.teamName})`)
    } catch (e) {
      setError(e.message || 'Failed to create test card')
    }
    setCreatingTest(false)
  }

  const createAndSendRequest = async () => {
    if (!selectedPlayer) return
    setCreatingTest(true)
    setError(null)
    setSuccess(null)
    setTestCard(null)
    try {
      const data = await vaultAdminService.createTestSignatureCard(selectedPlayer.id)
      setTestCard(data.card)
      await vaultAdminService.adminRequestSignature(data.card.id)
      setSuccess(`Test card #${data.card.id} created for "${data.card.playerName}" and signature request sent! Impersonate the linked player to test signing.`)
      loadRequests()
    } catch (e) {
      setError(e.message || 'Failed')
    }
    setCreatingTest(false)
  }

  return (
    <div className="space-y-6">
      {/* Quick Test */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-amber-500/20 p-5">
        <h2 className="text-lg font-bold text-amber-400 mb-2 flex items-center gap-2">
          <FlaskConical className="w-5 h-5" />
          Quick Test
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Create a throwaway unique player card (assigned to you) and optionally send a signature request.
          Impersonate the depicted player afterwards to test the signing flow.
        </p>

        {/* Player picker */}
        <div className="mb-4">
          <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">Player</label>
          {selectedPlayer ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg)] border border-white/10 rounded-lg">
              <div className="flex-1">
                <span className="text-sm text-white font-medium">{selectedPlayer.player_name}</span>
                <span className="text-xs text-white/40 ml-2">{selectedPlayer.team_name} &middot; {selectedPlayer.role} &middot; {selectedPlayer.season_slug}</span>
              </div>
              <button onClick={() => { setSelectedPlayer(null); setPlayerSearch('') }}
                className="text-xs text-white/30 hover:text-white/60 cursor-pointer">Change</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                placeholder="Search player name or team..."
                className="w-full pl-10 pr-3 py-2 bg-[var(--color-bg)] border border-white/10 rounded-lg text-sm text-[var(--color-text)] placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
              {searchingPlayers && <div className="text-xs text-white/30 mt-1">Searching...</div>}
              {playerResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-[var(--color-secondary)] border border-white/10 rounded-lg max-h-48 overflow-y-auto shadow-xl">
                  {playerResults.map(d => (
                    <button key={d.id}
                      onClick={() => { setSelectedPlayer(d); setPlayerResults([]); setPlayerSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2"
                    >
                      {d.team_color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.team_color }} />}
                      <span className="text-sm text-white">{d.player_name}</span>
                      <span className="text-xs text-white/40">{d.team_name} &middot; {d.role} &middot; {d.season_slug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={createTestCard}
            disabled={creatingTest || !selectedPlayer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-30"
          >
            <FlaskConical className="w-4 h-4" />
            {creatingTest ? 'Creating...' : 'Create Test Card'}
          </button>
          <button
            onClick={createAndSendRequest}
            disabled={creatingTest || !selectedPlayer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e8e8ff]/10 border border-[#e8e8ff]/20 text-[#e8e8ff] text-sm font-bold hover:bg-[#e8e8ff]/20 transition-all cursor-pointer disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
            {creatingTest ? 'Creating...' : 'Create + Send Request'}
          </button>
        </div>
        {testCard && (
          <div className="mt-3 text-xs text-white/60 bg-black/20 rounded-lg p-3 font-mono">
            Card #{testCard.id} &middot; Player: {testCard.playerName} ({testCard.teamName}) &middot; Player ID: {testCard.playerId}
          </div>
        )}
      </div>

      {/* Send Signature Request */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <h2 className="text-lg font-bold text-white mb-4">Send Signature Request</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Search for unique player cards and send a signature request to the depicted player.
        </p>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by card name, player name, or owner..."
              className="w-full pl-10 pr-3 py-2 bg-[var(--color-bg)] border border-white/10 rounded-lg text-sm text-[var(--color-text)] placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-400 mb-3 p-2 rounded bg-red-400/10">{error}</div>}
        {success && <div className="text-sm text-emerald-400 mb-3 p-2 rounded bg-emerald-400/10">{success}</div>}

        {searching && <div className="text-sm text-white/40 py-4 text-center">Searching...</div>}

        {!searching && cards.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Card</th>
                  <th className="pb-2 pr-3">Player</th>
                  <th className="pb-2 pr-3">Owner</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cards.map(card => (
                  <tr key={card.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 text-white/50 font-mono text-xs">#{card.id}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {card.imageUrl && (
                          <img src={card.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <div>
                          <div className="text-white font-medium">
                            {card.godName || 'Unknown'}
                            {card.isTest && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">TEST</span>}
                          </div>
                          <div className="text-[10px] text-white/40">{card.cardType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-white/80">{card.playerName || '-'}</div>
                      <div className="text-[10px] text-white/40">{card.teamName || ''}</div>
                    </td>
                    <td className="py-2 pr-3 text-white/60">{card.ownerName || `#${card.ownerId}`}</td>
                    <td className="py-2 pr-3">
                      {card.signatureUrl ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400">Signed</span>
                      ) : card.hasRequest ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400">Pending</span>
                      ) : !card.playerId ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/30">No player</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40">Available</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!card.signatureUrl && !card.hasRequest && card.playerId && (
                        <button
                          onClick={() => sendRequest(card.id)}
                          disabled={sending === card.id}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#e8e8ff]/10 border border-[#e8e8ff]/20 text-[#e8e8ff] text-xs font-bold hover:bg-[#e8e8ff]/20 transition-all cursor-pointer disabled:opacity-30"
                        >
                          <Send className="w-3 h-3" />
                          {sending === card.id ? 'Sending...' : 'Request'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!searching && search && cards.length === 0 && (
          <div className="text-sm text-white/30 py-4 text-center">No unique cards found</div>
        )}
      </div>

      {/* Existing Requests */}
      <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Signature Requests</h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setLoading(true) }}
              className="bg-[var(--color-bg)] border border-white/10 rounded-lg px-2 py-1 text-xs text-[var(--color-text)]"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="signed">Signed</option>
              <option value="declined">Declined</option>
            </select>
            <button
              onClick={() => { setLoading(true); loadRequests() }}
              className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/80 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-white/40 py-8 text-center">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-white/30 py-8 text-center">No signature requests</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Card</th>
                  <th className="pb-2 pr-3">Player</th>
                  <th className="pb-2 pr-3">Requester</th>
                  <th className="pb-2 pr-3">Signer</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Created</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 text-white/50 font-mono text-xs">#{req.id}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {req.imageUrl && (
                          <img src={req.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />
                        )}
                        <span className="text-white/80">{req.godName || `Card #${req.cardId}`}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-white/60">{req.playerName || '-'}</td>
                    <td className="py-2 pr-3 text-white/60">{req.requesterName || `#${req.requesterId}`}</td>
                    <td className="py-2 pr-3 text-white/60">{req.signerUsername || `Player #${req.signerPlayerId}`}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[req.status] || 'text-white/40 bg-white/5'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-white/40 text-xs">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => deleteRequest(req.id)}
                        className="p-1 rounded text-white/20 hover:text-red-400 cursor-pointer"
                        title="Delete request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
