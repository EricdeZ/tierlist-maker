import vaultLogo from '../../assets/vault_square.png'

export default function VaultHeroBanner() {
    return (
        <div className="vault-banner h-44 flex items-end justify-center pb-3">
            <div className="relative z-10 flex items-center gap-3">
                <img
                    src={vaultLogo}
                    alt=""
                    className="w-16 h-16 object-contain"
                />
                <div className="cd-head text-2xl font-bold tracking-[0.25em] text-white" style={{ textShadow: '0 0 20px rgba(0, 229, 255, 0.4)' }}>
                    THE <span className="text-[var(--cd-cyan)]">VAULT</span>
                </div>
            </div>
        </div>
    )
}
