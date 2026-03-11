import { createPortal } from 'react-dom'
import { Zap } from 'lucide-react'
import useChargeButton from '../../forge/useChargeButton'

export default function CDChargeButton({ label, onFire, disabled = false }) {
    const { btnRef, canvasRef } = useChargeButton({ onFire, mode: 'cool', disabled })

    return (
        <div className="relative">
            {createPortal(
                <canvas
                    ref={canvasRef}
                    className="fixed inset-0 pointer-events-none"
                    style={{ zIndex: 9999, width: '100vw', height: '100vh' }}
                />,
                document.body
            )}

            <button
                ref={btnRef}
                disabled={disabled}
                className="forge-charge-btn forge-charge-cool forge-clip-btn w-full py-3.5 cd-head text-base font-bold tracking-wider text-white disabled:opacity-50 relative overflow-hidden select-none"
                style={{
                    '--charge': 0,
                    '--shake': 0,
                    '--glow-angle': '0deg',
                    background: 'linear-gradient(135deg, #00a0c0, #006080)',
                    cursor: disabled ? 'not-allowed' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                <span className="forge-charge-fill absolute inset-0 pointer-events-none" />
                <span className="forge-charge-glow absolute pointer-events-none" style={{ inset: '-2px', zIndex: -1 }} />
                <span className="forge-charge-ring absolute inset-0 pointer-events-none" />

                <span className="relative z-10 flex items-center justify-center gap-2">
                    <Zap size={18} className="forge-charge-icon" />
                    <span className="forge-charge-label">{label}</span>
                </span>

                <span className="forge-charge-hint absolute inset-0 flex items-center justify-center pointer-events-none z-10 cd-head text-base tracking-widest opacity-0">
                    HOLD TO OPEN
                </span>
            </button>
        </div>
    )
}
