import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function BountyConfirmModal({ type, title, message, reward, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!onConfirm) return
    setLoading(true)
    try {
      await onConfirm()
    } catch {
      setLoading(false)
    }
  }

  const isError = type === 'error'
  const isFulfill = type === 'fulfill'
  const isCancel = type === 'cancel'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-lg p-6"
        style={{
          background: 'var(--cd-surface)',
          border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,140,0,0.3)'}`,
          boxShadow: isError
            ? '0 0 30px rgba(239,68,68,0.1)'
            : '0 0 30px rgba(255,140,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          className="font-bold tracking-[0.15em] mb-3"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 16,
            color: isError ? '#ef4444' : '#ff8c00',
            textShadow: isError
              ? '0 0 12px rgba(239,68,68,0.3)'
              : '0 0 12px rgba(255,140,0,0.3)',
          }}
        >
          {title}
        </h3>

        <p className="text-sm text-white/60 mb-4 leading-relaxed">
          {message}
        </p>

        {isFulfill && reward && (
          <div
            className="flex items-center justify-center gap-2 mb-4 py-2 rounded"
            style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.15)' }}
          >
            <span className="text-xs text-white/40 uppercase tracking-wider cd-head">Reward</span>
            <span
              className="font-bold cd-mono"
              style={{ color: '#ff8c00', fontSize: 18, textShadow: '0 0 8px rgba(255,140,0,0.5)' }}
            >
              {reward}
            </span>
            <span className="text-xs text-white/40">Core</span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-40"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
          >
            {isError ? 'OK' : 'Cancel'}
          </button>

          {!isError && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-60"
              style={{
                background: isFulfill ? 'rgba(0,210,255,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${isFulfill ? 'rgba(0,210,255,0.4)' : 'rgba(239,68,68,0.4)'}`,
                color: isFulfill ? '#00d2ff' : '#ef4444',
              }}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
              ) : isFulfill ? (
                'Turn In'
              ) : isCancel ? (
                'Cancel Bounty'
              ) : (
                'Confirm'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
