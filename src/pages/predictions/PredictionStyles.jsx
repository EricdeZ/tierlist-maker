export function PredictionStyles() {
    return (
        <style>{`
            .pred-gold-text {
                background: linear-gradient(135deg, #d4a04a 0%, #f8c56a 30%, #ffe4a0 50%, #f8c56a 70%, #c4922e 100%);
                background-size: 200% 100%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: pred-gold-shift 6s ease-in-out infinite;
            }
            @keyframes pred-gold-shift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            .pred-particle {
                animation: pred-float linear infinite;
            }
            @keyframes pred-float {
                0% { opacity: 0; transform: translateY(100vh) scale(0.5); }
                5% { opacity: var(--p-opacity, 0.08); }
                90% { opacity: var(--p-opacity, 0.08); }
                100% { opacity: 0; transform: translateY(-20vh) scale(1.5); }
            }
            .pred-card-enter {
                animation: pred-card-in 0.5s ease-out both;
            }
            @keyframes pred-card-in {
                0% { opacity: 0; transform: translateY(12px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .pred-coin-bg {
                animation: pred-coin-pulse 12s ease-in-out infinite;
            }
            @keyframes pred-coin-pulse {
                0%, 100% { filter: brightness(0.95); }
                50% { filter: brightness(1.2); }
            }
            .pred-wager-enter {
                animation: pred-wager-slide 0.3s ease-out both;
            }
            @keyframes pred-wager-slide {
                0% { opacity: 0; transform: translateY(-6px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .pred-shimmer {
                animation: pred-shimmer-move 3s ease-in-out infinite;
            }
            @keyframes pred-shimmer-move {
                0% { transform: translateX(-100%) skewX(-15deg); }
                100% { transform: translateX(300%) skewX(-15deg); }
            }
            .pred-featured-glow {
                animation: pred-featured-pulse 3s ease-in-out infinite;
            }
            @keyframes pred-featured-pulse {
                0%, 100% { box-shadow: 0 0 30px -10px rgba(248,197,106,0.12); }
                50% { box-shadow: 0 0 50px -10px rgba(248,197,106,0.22); }
            }
            .pred-team-btn {
                transition: all 0.2s ease;
            }
            .pred-team-btn:not(:disabled):hover {
                background: rgba(248,197,106,0.06);
                transform: scale(1.02);
            }
            .pred-team-btn.pred-selected {
                background: rgba(248,197,106,0.1);
                box-shadow: 0 0 20px -4px rgba(248,197,106,0.15), inset 0 0 0 1px rgba(248,197,106,0.25);
            }
            .pred-team-btn.pred-selected img {
                filter: drop-shadow(0 0 12px rgba(248,197,106,0.35));
            }
            .pred-vs {
                font-style: italic;
                font-weight: 900;
                color: #f8c56a;
                filter: drop-shadow(0 0 12px rgba(248,197,106,0.4));
                letter-spacing: 0.15em;
            }
            .pred-coin-3d-scene {
                perspective: 600px;
                perspective-origin: 50% 50%;
            }
            .pred-coin-3d-lift {
                transform-style: preserve-3d;
                transform: translateY(0) translateZ(0);
                will-change: transform;
            }
            .pred-coin-3d-inner {
                position: relative;
                transform-style: preserve-3d;
                transform: rotateX(0deg);
                will-change: transform;
            }
            .pred-coin-3d-face {
                position: absolute;
                inset: 0;
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pred-coin-3d-back {
                position: absolute;
                inset: 0;
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                transform: rotateX(180deg);
            }
            @keyframes pred-coinflip-arc {
                0%   { transform: translateY(0) scale(1); filter: brightness(1); }
                12%  { transform: translateY(-50px) scale(1.1); }
                25%  { transform: translateY(-80px) scale(1.18); filter: brightness(1.12); }
                38%  { transform: translateY(-88px) scale(1.2); filter: brightness(1.15); }
                52%  { transform: translateY(-78px) scale(1.16); filter: brightness(1.1); }
                66%  { transform: translateY(-40px) scale(1.08); filter: brightness(1.05); }
                78%  { transform: translateY(-5px) scale(1); filter: brightness(1); }
                84%  { transform: translateY(0) scale(0.98); }
                89%  { transform: translateY(-10px) scale(1.03); }
                94%  { transform: translateY(0) scale(1); }
                97%  { transform: translateY(-3px) scale(1.01); }
                100% { transform: translateY(0) scale(1); filter: brightness(1); }
            }
            .pred-coinflip-arc {
                animation: pred-coinflip-arc 1.3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
            }
            @keyframes pred-coinflip-explode {
                0% { transform: scale(0.3); opacity: 1; }
                60% { transform: scale(1.5); opacity: 0.7; }
                100% { transform: scale(2.2); opacity: 0; }
            }
            .pred-coinflip-explode {
                animation: pred-coinflip-explode 1.2s ease-out forwards;
            }
            .pred-expand-enter {
                animation: pred-expand-in 0.3s ease-out both;
            }
            @keyframes pred-expand-in {
                0% { opacity: 0; max-height: 0; }
                100% { opacity: 1; max-height: 200px; }
            }
        `}</style>
    )
}
