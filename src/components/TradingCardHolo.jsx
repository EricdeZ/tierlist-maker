import { useRef, useCallback, useEffect, useState } from 'react'
import './TradingCardHolo.css'

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max)
const round = (value, precision = 3) => parseFloat(value.toFixed(precision))
const adjust = (value, fromMin, fromMax, toMin, toMax) =>
    round(toMin + (toMax - toMin) * (value - fromMin) / (fromMax - fromMin))

function useSpring(initial, { stiffness = 0.066, damping = 0.25 } = {}) {
    const isScalar = typeof initial === 'number'
    const ref = useRef({
        current: isScalar ? { value: initial } : { ...initial },
        target: isScalar ? { value: initial } : { ...initial },
        velocity: isScalar ? { value: 0 } :
            Object.fromEntries(Object.keys(initial).map(k => [k, 0])),
        stiffness,
        damping,
        running: false,
    })
    const [value, setValue] = useState(initial)
    const rafRef = useRef(null)

    const tick = useCallback(() => {
        const s = ref.current
        let settled = true
        const keys = Object.keys(s.target)
        for (const k of keys) {
            const displacement = s.current[k] - s.target[k]
            const springForce = -s.stiffness * displacement
            const dampForce = -s.damping * s.velocity[k]
            s.velocity[k] += springForce + dampForce
            s.current[k] += s.velocity[k]
            if (Math.abs(s.velocity[k]) > 0.01 || Math.abs(displacement) > 0.01) {
                settled = false
            }
        }
        if (settled) {
            for (const k of keys) {
                s.current[k] = s.target[k]
                s.velocity[k] = 0
            }
            s.running = false
        }
        const next = keys.length === 1 && 'value' in s.current
            ? s.current.value
            : { ...s.current }
        setValue(next)
        if (!settled) {
            rafRef.current = requestAnimationFrame(tick)
        }
    }, [])

    const startLoop = useCallback(() => {
        const s = ref.current
        if (!s.running) {
            s.running = true
            rafRef.current = requestAnimationFrame(tick)
        }
    }, [tick])

    useEffect(() => {
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [])

    const set = useCallback((target, opts = {}) => {
        const s = ref.current
        if (opts.stiffness) s.stiffness = opts.stiffness
        if (opts.damping) s.damping = opts.damping

        if (typeof target === 'number') {
            s.target = { value: target }
            if (opts.hard) {
                s.current = { value: target }
                s.velocity = { value: 0 }
                setValue(target)
                return
            }
        } else {
            s.target = { ...target }
            if (opts.hard) {
                s.current = { ...target }
                s.velocity = Object.fromEntries(Object.keys(target).map(k => [k, 0]))
                setValue({ ...target })
                return
            }
        }
        startLoop()
    }, [startLoop])

    return [value, set]
}

export default function TradingCardHolo({ children, rarity = 'holo', role = 'ADC', holoType = 'full', size }) {
    const cardRef = useRef(null)
    const endTimerRef = useRef(null)
    const [interacting, setInteracting] = useState(false)
    const [active, setActive] = useState(false)

    const [rotate, setRotate] = useSpring({ x: 0, y: 0 }, { stiffness: 0.066, damping: 0.25 })
    const [glare, setGlare] = useSpring({ x: 50, y: 50, o: 0 }, { stiffness: 0.066, damping: 0.25 })
    const [bg, setBg] = useSpring({ x: 50, y: 50 }, { stiffness: 0.066, damping: 0.25 })

    useEffect(() => {
        return () => clearTimeout(endTimerRef.current)
    }, [])

    const interact = useCallback((e) => {
        clearTimeout(endTimerRef.current)
        setInteracting(true)

        let clientX, clientY
        if (e.touches) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        const rect = cardRef.current.getBoundingClientRect()
        const absolute = {
            x: clientX - rect.left,
            y: clientY - rect.top,
        }
        const percent = {
            x: clamp(round((100 / rect.width) * absolute.x)),
            y: clamp(round((100 / rect.height) * absolute.y)),
        }
        const center = {
            x: percent.x - 50,
            y: percent.y - 50,
        }

        setBg({
            x: adjust(percent.x, 0, 100, 37, 63),
            y: adjust(percent.y, 0, 100, 33, 67),
        }, { stiffness: 0.066, damping: 0.25 })

        setRotate({
            x: round(-(center.x / 3.5)),
            y: round(center.y / 2),
        }, { stiffness: 0.066, damping: 0.25 })

        setGlare({
            x: round(percent.x),
            y: round(percent.y),
            o: 1,
        }, { stiffness: 0.066, damping: 0.25 })
    }, [setBg, setRotate, setGlare])

    const interactEnd = useCallback(() => {
        clearTimeout(endTimerRef.current)
        endTimerRef.current = setTimeout(() => {
            setInteracting(false)
            setRotate({ x: 0, y: 0 }, { stiffness: 0.01, damping: 0.06 })
            setGlare({ x: 50, y: 50, o: 0 }, { stiffness: 0.01, damping: 0.06 })
            setBg({ x: 50, y: 50 }, { stiffness: 0.01, damping: 0.06 })
        }, 300)
    }, [setRotate, setGlare, setBg])

    const pointerFromCenter = clamp(
        Math.sqrt(
            ((glare.y ?? 50) - 50) ** 2 + ((glare.x ?? 50) - 50) ** 2
        ) / 50, 0, 1
    )

    const dynamicStyles = {
        '--pointer-x': `${glare.x ?? 50}%`,
        '--pointer-y': `${glare.y ?? 50}%`,
        '--pointer-from-center': pointerFromCenter,
        '--pointer-from-top': (glare.y ?? 50) / 100,
        '--pointer-from-left': (glare.x ?? 50) / 100,
        '--card-opacity': glare.o ?? 0,
        '--rotate-x': `${(rotate.x ?? 0)}deg`,
        '--rotate-y': `${(rotate.y ?? 0)}deg`,
        '--background-x': `${bg.x ?? 50}%`,
        '--background-y': `${bg.y ?? 50}%`,
    }

    const roleClass = (role || 'adc').toLowerCase()

    return (
        <div
            className={`holo-card ${roleClass} ${interacting ? 'interacting' : ''} ${active ? 'active' : ''}`}
            data-rarity={rarity}
            data-holo-type={holoType}
            style={{ ...dynamicStyles, ...(size ? { width: size, '--card-scale': size / 340 } : {}) }}
            ref={cardRef}
        >
            <div className="holo-card__translater">
                <div
                    className="holo-card__rotator"
                    onPointerMove={interact}
                    onMouseLeave={interactEnd}
                    onTouchMove={interact}
                    onTouchEnd={interactEnd}
                    onClick={() => setActive(a => !a)}
                >
                    <div className="holo-card__front">
                        {children}
                        <div className="holo-card__shine" />
                        <div className="holo-card__glare" />
                    </div>
                </div>
            </div>
        </div>
    )
}
