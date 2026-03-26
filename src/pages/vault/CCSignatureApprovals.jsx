import { useState, useEffect } from 'react'
import GameCard from './components/GameCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import VaultCard from './components/VaultCard'
import { vaultService } from '../../services/database'
import { getHoloEffect } from '../../data/vault/economy'
import { useVault } from './VaultContext'
import { PenLine, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

export default function CCSignatureApprovals() {
  const { refreshCollection, setPendingApprovalCount, getBlueprint } = useVault()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [acting, setActing] = useState(null)

  useEffect(() => {
    vaultService.getPendingApprovalSignatures()
      .then(data => setRequests(data.requests || []))
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async (requestId) => {
    setActing(requestId)
    setError(null)
    try {
      await vaultService.approveSignature(requestId)
      setRequests(prev => prev.filter(r => r.id !== requestId))
      setPendingApprovalCount(prev => Math.max(0, prev - 1))
      await refreshCollection()
    } catch (err) {
      setError(err.message || 'Failed to approve')
    }
    setActing(null)
  }

  const handleReject = async (requestId) => {
    setActing(requestId)
    setError(null)
    try {
      await vaultService.rejectSignature(requestId)
      setRequests(prev => prev.filter(r => r.id !== requestId))
      setPendingApprovalCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      setError(err.message || 'Failed to reject')
    }
    setActing(null)
  }

  if (loading) return null
  if (requests.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-amber-500/[0.03] transition-colors"
      >
        <PenLine className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-amber-400 cd-head uppercase tracking-widest flex-1 text-left">
          Signatures Awaiting Your Approval
        </span>
        <span className="text-[10px] text-amber-400/60 cd-num mr-1">
          {requests.length}
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-amber-400/40" /> : <ChevronUp className="w-4 h-4 text-amber-400/40" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {error && (
            <div className="text-[11px] text-red-400 text-center cd-mono mb-3 py-1 rounded bg-red-400/[0.06]">{error}</div>
          )}

          {requests.map(req => {
            const pName = req.playerName || req.cardData?.playerName || req.godName
            const tName = req.teamName || req.cardData?.teamName || ''
            const tColor = req.teamColor || req.cardData?.teamColor || '#888'

            return (
              <div key={req.id} className="py-4 border-b border-[var(--cd-border)]/50 last:border-0">
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                  {/* Card with signature preview */}
                  <div className="shrink-0">
                    {req.blueprintId ? (
                      <VaultCard card={req} getBlueprint={getBlueprint} size={200} holo />
                    ) : req.cardType === 'player' ? (
                      <TradingCard
                        playerName={pName}
                        teamName={tName}
                        teamColor={tColor}
                        role={req.role || 'solo'}
                        rarity="unique"
                        size={200}
                        holo={{ rarity: getHoloEffect('unique'), holoType: 'reverse' }}
                        signatureUrl={req.pendingSignatureUrl}
                      />
                    ) : (
                      <TradingCardHolo rarity={getHoloEffect('unique')} role={req.role || 'mid'} holoType="reverse" size={200}>
                        <GameCard
                          type={req.cardType || 'god'}
                          rarity="unique"
                          data={{
                            name: req.godName, role: req.role, class: req.godClass,
                            imageUrl: req.imageUrl, signatureUrl: req.pendingSignatureUrl,
                            ...(req.cardData || {}),
                          }}
                          size={200}
                        />
                      </TradingCardHolo>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="flex flex-col items-center sm:items-start gap-3">
                    <div className="text-center sm:text-left">
                      <div className="text-xs font-bold text-white cd-head">{pName}</div>
                      <div className="text-[10px] text-[var(--cd-text-dim)]">signed your unique card</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={acting === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/[0.1] border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider cd-head hover:bg-emerald-500/[0.2] transition-all cursor-pointer disabled:opacity-30"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={acting === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-[10px] font-bold uppercase tracking-wider cd-head hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer disabled:opacity-30"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                    <div className="text-[9px] text-[var(--cd-text-dim)]/60">
                      Rejecting lets the player redo their signature
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
