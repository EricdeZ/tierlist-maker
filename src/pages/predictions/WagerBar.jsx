import { useState } from 'react'
import { Target, X } from 'lucide-react'
import passionCoin from '../../assets/passion/passion.png'
import { WAGER_PRESETS } from './constants'

export function WagerBar({ teamName, passion, onSubmit, onCancel, submitting, submitError }) {
    const [wagerAmount, setWagerAmount] = useState(0)
    const [customMode, setCustomMode] = useState(false)
    const [customInput, setCustomInput] = useState('')

    const activeAmount = customMode ? (parseInt(customInput) || 0) : wagerAmount

    return (
        <div className="pred-wager-enter mt-4 pt-3" style={{ borderTop: '1px solid rgba(248,197,106,0.12)' }}>
            <div className="flex items-center gap-2 mb-2.5">
                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold" style={{ color: '#f8c56a' }}>
                    Wager on {teamName}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {WAGER_PRESETS.map(p => {
                    const isActive = !customMode && wagerAmount === p.value
                    const canAfford = p.value === 0 || (passion?.balance >= p.value)
                    return (
                        <button key={p.value}
                            onClick={() => { setCustomMode(false); setWagerAmount(p.value) }}
                            disabled={!canAfford}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
                                isActive ? 'font-bold text-[#0a0f1a]' : 'text-white/70 hover:text-white'
                            }`}
                            style={{
                                background: isActive
                                    ? 'linear-gradient(135deg, #c4922e, #f8c56a)'
                                    : 'rgba(255,255,255,0.08)',
                            }}>
                            {p.value === 0 ? 'Free' : (
                                <span className="inline-flex items-center gap-1">
                                    <img src={passionCoin} alt="" className="w-3 h-3" />
                                    {p.label}
                                </span>
                            )}
                        </button>
                    )
                })}

                {!customMode ? (
                    <button onClick={() => setCustomMode(true)}
                        className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        Custom
                    </button>
                ) : (
                    <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
                        style={{ background: 'rgba(248,197,106,0.1)', border: '1px solid rgba(248,197,106,0.25)' }}>
                        <img src={passionCoin} alt="" className="w-3 h-3" />
                        <input type="number" min="5" value={customInput} onChange={e => setCustomInput(e.target.value)}
                            placeholder="Amount" autoFocus
                            className="bg-transparent text-xs text-white w-14 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                )}

                <div className="flex-1 min-w-4" />

                <button onClick={() => onSubmit(activeAmount)} disabled={submitting || (customMode && activeAmount > 0 && activeAmount < 5)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-30 hover:brightness-110 hover:scale-[1.02] active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #c4922e, #f8c56a)', color: '#0a0f1a' }}>
                    <Target className="w-3.5 h-3.5" />
                    {submitting ? '...' : activeAmount > 0 ? 'Wager' : 'Predict'}
                </button>

                <button onClick={onCancel} className="p-1.5 text-white/30 hover:text-white/60 cursor-pointer transition-colors">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {submitError && <p className="text-[10px] text-red-400 mt-2">{submitError}</p>}
        </div>
    )
}
