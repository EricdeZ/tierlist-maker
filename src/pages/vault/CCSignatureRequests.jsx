import { useState, useEffect } from 'react'
import SignatureCanvas from './components/SignatureCanvas'
import GameCard from './components/GameCard'
import VaultCard from './components/VaultCard'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'
import { vaultService } from '../../services/database'
import { getHoloEffect } from '../../data/vault/economy'
import { useVault } from './VaultContext'
import { PenLine, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

function CardPreview({ req, signatureUrl, size }) {
  const { getBlueprint } = useVault()
  if (req.blueprintId) {
    return <VaultCard card={req} getBlueprint={getBlueprint} size={size} holo />
  }
  if (req.cardType === 'player') {
    return (
      <TradingCard
        playerName={req.playerName || req.cardData?.playerName || req.godName}
        teamName={req.teamName || req.cardData?.teamName || ''}
        teamColor={req.teamColor || req.cardData?.teamColor || '#888'}
        role={req.role || 'solo'}
        rarity="unique"
        size={size}
        holo={{ rarity: getHoloEffect('unique'), holoType: 'reverse' }}
        signatureUrl={signatureUrl}
      />
    )
  }
  return (
    <TradingCardHolo rarity={getHoloEffect('unique')} role={req.role || 'mid'} holoType="reverse" size={size}>
      <GameCard
        type={req.cardType || 'god'}
        rarity="unique"
        data={{
          name: req.godName,
          role: req.role,
          class: req.godClass,
          imageUrl: req.imageUrl,
          signatureUrl,
          ...(req.cardData || {}),
        }}
        size={size}
      />
    </TradingCardHolo>
  )
}

function CardBg({ req }) {
  const { getBlueprint } = useVault()
  if (req.blueprintId) {
    return <VaultCard card={req} getBlueprint={getBlueprint} holo={false} />
  }
  if (req.cardType === 'player') {
    return (
      <TradingCard
        playerName={req.playerName || req.cardData?.playerName || req.godName}
        teamName={req.teamName || req.cardData?.teamName || ''}
        teamColor={req.teamColor || req.cardData?.teamColor || '#888'}
        role={req.role || 'solo'}
        rarity="unique"
      />
    )
  }
  return (
    <GameCard
      type={req.cardType || 'god'}
      rarity="unique"
      data={{ name: req.godName, role: req.role, class: req.godClass, imageUrl: req.imageUrl, ...(req.cardData || {}) }}
    />
  )
}

export default function CCSignatureRequests() {
  const { refreshCollection, setPendingSignatureCount } = useVault()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRequest, setActiveRequest] = useState(null)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [declining, setDeclining] = useState(null)
  const [liveSignatureUrl, setLiveSignatureUrl] = useState(null)

  useEffect(() => {
    vaultService.getPendingSignatures()
      .then(data => setRequests(data.requests || []))
      .catch(() => setError('Failed to load signature requests'))
      .finally(() => setLoading(false))
  }, [])

  const handleConfirm = async (blob) => {
    if (!activeRequest) return
    setError(null)
    try {
      await vaultService.submitSignature(activeRequest.id, blob)
      setRequests(prev => prev.filter(r => r.id !== activeRequest.id))
      setPendingSignatureCount(prev => Math.max(0, prev - 1))
      setActiveRequest(null)
      setLiveSignatureUrl(null)
      await refreshCollection()
    } catch (err) {
      setError(err.message || 'Failed to submit signature')
    }
  }

  const handleDecline = async (requestId) => {
    setError(null)
    setDeclining(requestId)
    try {
      await vaultService.declineSignature(requestId)
      setRequests(prev => prev.filter(r => r.id !== requestId))
      setPendingSignatureCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      setError(err.message || 'Failed to decline')
    } finally {
      setDeclining(null)
    }
  }

  if (loading) return null
  if (requests.length === 0 && !activeRequest) return null

  return (
    <div className="mb-6 rounded-xl border border-[#e8e8ff]/15 bg-[#e8e8ff]/[0.02] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-[#e8e8ff]/[0.03] transition-colors"
      >
        <PenLine className="w-4 h-4 text-[#e8e8ff]" />
        <span className="text-xs font-bold text-[#e8e8ff] cd-head uppercase tracking-widest flex-1 text-left">
          Signature Requests
        </span>
        <span className="text-[10px] text-[#e8e8ff]/60 cd-num mr-1">
          {requests.length}
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-[#e8e8ff]/40" /> : <ChevronUp className="w-4 h-4 text-[#e8e8ff]/40" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {error && (
            <div className="text-[11px] text-red-400 text-center cd-mono mb-3 py-1 rounded bg-red-400/[0.06]">{error}</div>
          )}

          {/* Request list */}
          {!activeRequest && requests.map(req => (
            <div key={req.id} className="flex items-center gap-3 py-3 border-b border-[var(--cd-border)]/50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white cd-head truncate">
                  {req.requesterName}
                </div>
                <div className="text-[10px] text-[var(--cd-text-dim)]">
                  wants your autograph on their unique card
                </div>
              </div>
              <button
                onClick={() => { setActiveRequest(req); setLiveSignatureUrl(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e8e8ff]/[0.1] border border-[#e8e8ff]/20 text-[#e8e8ff] text-[10px] font-bold uppercase tracking-wider cd-head hover:bg-[#e8e8ff]/[0.2] transition-all cursor-pointer"
              >
                <PenLine className="w-3 h-3" />
                Sign
              </button>
              <button
                onClick={() => handleDecline(req.id)}
                disabled={declining === req.id}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--cd-border)] text-[var(--cd-text-dim)] text-[10px] font-bold uppercase tracking-wider cd-head hover:text-red-400 hover:border-red-400/30 transition-all cursor-pointer disabled:opacity-30"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Signing view */}
          {activeRequest && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => { setActiveRequest(null); setLiveSignatureUrl(null) }}
                  className="text-[10px] text-[var(--cd-text-dim)] hover:text-white cd-head uppercase tracking-wider cursor-pointer"
                >
                  &larr; Back
                </button>
                <div className="text-[10px] text-[var(--cd-text-dim)] cd-head">
                  Signing for <span className="text-white font-bold">{activeRequest.requesterName}</span>
                </div>
              </div>

              {/* Canvas + live tilt preview */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-4">
                {/* Signing canvas */}
                <SignatureCanvas
                  onConfirm={handleConfirm}
                  onCancel={() => { setActiveRequest(null); setLiveSignatureUrl(null) }}
                  onStrokeChange={setLiveSignatureUrl}
                  cardBackground={<CardBg req={activeRequest} />}
                />

                {/* Live tilt preview */}
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[10px] text-[#e8e8ff]/40 uppercase tracking-wider cd-head">
                    Live Preview
                  </div>
                  <CardPreview req={activeRequest} signatureUrl={liveSignatureUrl} size={240} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
