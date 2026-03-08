import forgeLogo from '../../assets/forge.png'

export default function ForgeHeroBanner() {
    return (
        <div className="forge-banner h-44 flex items-end justify-center pb-3">
            <div className="relative z-10 flex items-center gap-3">
                <img
                    src={forgeLogo}
                    alt=""
                    className="w-16 h-16 object-contain"
                    style={{ filter: 'drop-shadow(0 0 10px rgba(232,101,32,0.6))' }}
                />
                <div className="forge-head text-2xl font-bold tracking-[0.25em] text-white" style={{ textShadow: '0 0 20px rgba(232,101,32,0.5)' }}>
                    Fantasy <span className="text-[var(--forge-flame-bright)]">Forge</span>
                </div>
            </div>
        </div>
    )
}
