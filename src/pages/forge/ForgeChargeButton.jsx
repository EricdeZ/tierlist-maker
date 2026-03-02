import { createPortal } from 'react-dom'
import { Flame, Snowflake } from 'lucide-react'
import useChargeButton from './useChargeButton'

export default function ForgeChargeButton({ mode = 'fuel', label, onFire, disabled = false }) {
    const isFuel = mode === 'fuel'
    const { btnRef, canvasRef } = useChargeButton({ onFire, mode, disabled })

    return (
        <div className="forge-charge-wrapper relative">
            {/* Particle canvas — portaled to body so clip-path on modal doesn't clip particles */}
            {createPortal(
                <canvas
                    ref={canvasRef}
                    className="fixed inset-0 pointer-events-none"
                    style={{ zIndex: 9999, width: '100vw', height: '100vh' }}
                />,
                document.body
            )}

            {/* The charge button */}
            <button
                ref={btnRef}
                disabled={disabled}
                className={`forge-charge-btn w-full py-3.5 forge-head text-base font-bold tracking-wider text-white disabled:opacity-50 forge-clip-btn relative overflow-hidden select-none ${
                    isFuel ? 'forge-charge-fuel' : 'forge-charge-cool'
                }`}
                style={{
                    '--charge': 0,
                    '--shake': 0,
                    '--glow-angle': '0deg',
                    background: isFuel
                        ? 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))'
                        : 'linear-gradient(135deg, var(--forge-cool), var(--forge-cool-dim))',
                    cursor: disabled ? 'not-allowed' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                }}
            >
                {/* Charge fill bar (left to right) */}
                <span className="forge-charge-fill absolute inset-0 pointer-events-none" />

                {/* Rotating glow border */}
                <span className="forge-charge-glow absolute pointer-events-none" style={{ inset: '-2px', zIndex: -1 }} />

                {/* Pulsing border ring */}
                <span className="forge-charge-ring absolute inset-0 pointer-events-none" />

                {/* Button content */}
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {isFuel
                        ? <Flame size={18} className="forge-charge-icon" />
                        : <Snowflake size={18} className="forge-charge-icon" />
                    }
                    <span className="forge-charge-label">{label}</span>
                </span>

                {/* Hold indicator text */}
                <span className="forge-charge-hint absolute inset-0 flex items-center justify-center pointer-events-none z-10 forge-head text-base tracking-widest opacity-0">
                    HOLD TO CHARGE
                </span>
            </button>
        </div>
    )
}
