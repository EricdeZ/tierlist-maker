import Navbar from '../../components/layout/Navbar'
import PageTitle from '../../components/PageTitle'
import forgeLogo from '../../assets/forge.png'

export default function ForgeAuthGate({ onLogin }) {
    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Fantasy Forge" />
            <PageTitle title="Fantasy Forge" description="Invest Sparks in competitive SMITE 2 players. Buy low, sell high as players perform. Track portfolios and climb leaderboards." image="https://smitecomp.com/forge.png" />
            <div className="max-w-lg mx-auto px-4 pt-32 text-center">
                <img
                    src={forgeLogo}
                    alt="Fantasy Forge"
                    className="w-48 h-48 object-contain mx-auto mb-6 forge-logo-float forge-logo-glow"
                />
                <h2 className="forge-head text-3xl font-bold tracking-wider mb-2">Fantasy Forge</h2>
                <p className="forge-body text-[var(--forge-text-mid)] mb-6">
                    Fuel the players you believe in with your Passion. Watch their value rise with demand and performance.
                </p>
                <button
                    onClick={onLogin}
                    className="forge-clip-btn forge-btn-fuel forge-head text-base font-bold tracking-wider px-6 py-3 text-white"
                    style={{
                        background: 'linear-gradient(135deg, var(--forge-flame), var(--forge-ember))',
                        boxShadow: '0 4px 20px rgba(232,101,32,0.3)',
                    }}
                >
                    Sign in to Enter the Forge
                </button>
            </div>
        </div>
    )
}
