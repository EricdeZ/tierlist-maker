import Navbar from '../../components/layout/Navbar'
import PageTitle from '../../components/PageTitle'
import forgeLogo from '../../assets/forge.png'

export default function ForgeLoadingScreen() {
    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Navbar title="Fantasy Forge" />
            <PageTitle title="Fantasy Forge" description="Invest Sparks in competitive SMITE 2 players. Buy low, sell high as players perform. Track portfolios and climb leaderboards." image="https://smitecomp.com/forge.png" />
            <div className="flex flex-col items-center justify-center pt-48">
                <img
                    src={forgeLogo}
                    alt="Fantasy Forge"
                    className="w-40 h-40 object-contain forge-logo-float forge-logo-glow mb-4"
                />
                <div className="forge-head text-lg font-semibold tracking-wider text-[var(--forge-text-mid)]">
                    Igniting the Forge...
                </div>
                <div className="w-48 h-1 mt-3 rounded-full overflow-hidden bg-[var(--forge-edge)]">
                    <div className="h-full forge-shimmer rounded-full" style={{ background: 'var(--forge-flame)' }} />
                </div>
            </div>
        </div>
    )
}
