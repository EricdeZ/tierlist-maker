export default function VaultHeroBanner() {
    return (
        <div className="vault-banner h-28 sm:h-44 flex items-end justify-center pb-3 sm:pb-5">
            <div className="relative z-10 flex flex-col items-center" style={{ lineHeight: 0.85 }}>
                <span
                    className="cd-head text-[0.55rem] sm:text-[0.75rem] tracking-[0.55em] text-[var(--cd-cyan)]"
                    style={{ opacity: 0.55 }}
                >
                    THE
                </span>
                <span
                    className="cd-head text-[2.8rem] sm:text-[4rem] font-bold tracking-[0.12em]"
                    style={{
                        background: 'linear-gradient(180deg, #e0e8f0 20%, #00e5ff 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        filter: 'drop-shadow(0 0 30px rgba(0, 229, 255, 0.25))',
                    }}
                >
                    VAULT
                </span>
            </div>
        </div>
    )
}
