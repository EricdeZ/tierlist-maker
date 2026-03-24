import smiteLogo from '../../assets/smite2.png'
import SoftAurora from '../../components/SoftAurora'
import CardSwap, { Card } from '../../components/CardSwap'

import screenshotDraft from '../../assets/screenshots/draft.png'
import screenshotForge from '../../assets/screenshots/forge.png'
import screenshotVault from '../../assets/screenshots/vault.png'
import screenshotLeague from '../../assets/screenshots/league.png'
import screenshotSignup from '../../assets/screenshots/signup.png'
import screenshotTierlist from '../../assets/screenshots/tierlist.png'
import screenshotStandings from '../../assets/screenshots/standings.png'
import screenshotStats from '../../assets/screenshots/stats.png'

const SCREENSHOTS = [
    { src: screenshotForge, alt: 'Fantasy Forge', label: 'Fantasy Forge', desc: 'Player investment market' },
    { src: screenshotVault, alt: 'The Vault', label: 'The Vault', desc: 'Collect & trade cards' },
    { src: screenshotDraft, alt: 'Draft Simulator', label: 'Draft Simulator', desc: 'Pick & ban practice' },
    { src: screenshotStats, alt: 'Player Stats', label: 'Player Stats', desc: 'Detailed stat tables' },
    { src: screenshotLeague, alt: 'League Homepage', label: 'Leagues', desc: 'Community competition' },
    { src: screenshotStandings, alt: 'Division Overview', label: 'Stats & Standings', desc: 'Live season data' },
    { src: screenshotTierlist, alt: 'God Tier List', label: 'Tier Lists', desc: 'Rank gods & players' },
    { src: screenshotSignup, alt: 'Season Signup', label: 'Season Signups', desc: 'Join a league' },
]

const HeroSection = ({ heroRef, heroLight, handleHeroMove, handleHeroLeave }) => {
    return (
        <section
            ref={heroRef}
            onMouseMove={handleHeroMove}
            onMouseLeave={handleHeroLeave}
            className="relative min-h-[85vh] flex items-center px-4 py-20 overflow-hidden bg-(--color-primary)"
        >
            {/* Fallback gradient in case WebGL fails */}
            <div
                className="absolute inset-0 z-0"
                style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(248,197,106,0.15) 0%, transparent 60%)' }}
            />

            {/* Aurora background — faded gold only */}
            <div className="absolute inset-0 z-0 bg-(--color-primary)">
                <SoftAurora
                    speed={0.4}
                    scale={1.5}
                    brightness={2.0}
                    color1="#f8c56a"
                    color2="#f8c56a"
                    noiseFrequency={2.5}
                    noiseAmplitude={1.4}
                    bandHeight={0.5}
                    bandSpread={1.0}
                    octaveDecay={0.12}
                    layerOffset={0.5}
                    colorSpeed={0.4}
                    enableMouseInteraction={true}
                    mouseInfluence={0.25}
                />
            </div>

            {/* Dark overlay so text stays readable */}
            <div
                className="absolute inset-0 z-[1]"
                style={{ background: 'linear-gradient(to bottom, rgba(6,13,26,0.25) 0%, rgba(16,24,41,0.5) 60%, var(--color-primary) 100%)' }}
            />

            <div className="relative z-10 max-w-7xl mx-auto w-full">

                {/* Text content */}
                <div className="text-center lg:text-left lg:max-w-[44%] relative z-20">
                    <div className="flex items-center gap-3 mb-6 justify-center lg:justify-start">
                        <img src={smiteLogo} alt="SMITE 2" className="h-12 sm:h-14 w-auto drop-shadow-2xl" />
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-(--color-accent)/30 bg-(--color-accent)/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-pulse" />
                            <span className="text-xs font-semibold text-(--color-accent) uppercase tracking-wider">Community-Driven Competitive</span>
                        </div>
                    </div>

                    <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-[1.1] tracking-tight">
                        <span
                            className="bg-clip-text text-transparent transition-all duration-500"
                            style={{
                                WebkitBackgroundClip: 'text',
                                backgroundImage: heroLight.active
                                    ? `radial-gradient(circle 300px at ${heroLight.x}% ${heroLight.y}%, rgba(255,255,255,1), rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.55))`
                                    : 'linear-gradient(to right, rgba(255,255,255,0.88), rgba(255,255,255,0.88))',
                            }}
                        >
                            The Battleground{' '}
                        </span>
                        <span className="relative inline-block">
                            <span
                                className="bg-clip-text text-transparent"
                                style={{
                                    WebkitBackgroundClip: 'text',
                                    backgroundImage: heroLight.active
                                        ? `radial-gradient(circle 300px at ${heroLight.x}% ${heroLight.y}%, #ffffff, transparent 55%), linear-gradient(135deg, var(--color-accent), #fde68a, var(--color-accent))`
                                        : 'linear-gradient(135deg, var(--color-accent), #fde68a, var(--color-accent))',
                                }}
                            >
                                Lives On
                            </span>
                            <span
                                className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)' }}
                            />
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-(--color-text-secondary) max-w-lg mb-8 leading-relaxed mx-auto lg:mx-0">
                        Stats, standings, and tools for the community leagues keeping SMITE 2 esports alive. Find your league and jump in.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                        <a
                            href="#leagues"
                            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-heading font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-(--color-accent)/20"
                            style={{ background: 'linear-gradient(135deg, var(--color-accent), #e5a84e)' }}
                        >
                            <span className="relative z-10 text-(--color-primary)">Explore Leagues</span>
                        </a>
                        <a
                            href="#about"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-heading font-bold text-base border border-white/10 text-(--color-text-secondary) hover:border-white/25 hover:text-(--color-text) transition-all duration-300"
                        >
                            Learn More
                        </a>
                    </div>
                </div>

                {/* Card Swap screenshots */}
                <div className="hidden lg:block lg:absolute lg:right-[-6%] lg:top-1/2 lg:-translate-y-[50%] lg:w-[55%] z-10">
                    <div className="relative w-full" style={{ paddingBottom: '70%' }}>
                        <CardSwap
                            width={620}
                            height={410}
                            cardDistance={50}
                            verticalDistance={55}
                            delay={4000}
                            pauseOnHover={true}
                            skewAmount={5}
                            easing="elastic"
                        >
                            {SCREENSHOTS.map((shot) => (
                                <Card key={shot.alt}>
                                    <div className="flex flex-col w-full h-full">
                                        {/* Browser bar */}
                                        <div className="flex items-center justify-center px-3 h-9 bg-[#0c1220] border-b border-white/8 shrink-0 select-none">
                                            <span className="font-heading font-bold text-xs text-(--color-accent) truncate">{shot.label}</span>
                                            <span className="text-[10px] text-white/30 mx-2">—</span>
                                            <span className="text-[10px] text-white/40 truncate">{shot.desc}</span>
                                        </div>
                                        {/* Screenshot */}
                                        <div className="flex-1 overflow-hidden">
                                            <img
                                                src={shot.src}
                                                alt={shot.alt}
                                                className="w-full h-full object-cover object-top"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CardSwap>
                    </div>
                </div>

                {/* Mobile: card swap stack */}
                <div className="lg:hidden mt-10 relative flex justify-center">
                    <div className="relative" style={{ width: 320, height: 230 }}>
                        <CardSwap
                            width={300}
                            height={200}
                            cardDistance={25}
                            verticalDistance={28}
                            delay={4000}
                            pauseOnHover={false}
                            skewAmount={4}
                            easing="elastic"
                        >
                            {SCREENSHOTS.map((shot) => (
                                <Card key={shot.alt}>
                                    <div className="flex flex-col w-full h-full">
                                        <div className="flex items-center justify-center px-2 h-7 bg-[#0c1220] border-b border-white/8 shrink-0 select-none">
                                            <span className="font-heading font-bold text-[10px] text-(--color-accent) truncate">{shot.label}</span>
                                            <span className="text-[8px] text-white/30 mx-1.5">—</span>
                                            <span className="text-[8px] text-white/40 truncate">{shot.desc}</span>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <img
                                                src={shot.src}
                                                alt={shot.alt}
                                                className="w-full h-full object-cover object-top"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CardSwap>
                    </div>
                </div>

            </div>
        </section>
    )
}

export default HeroSection
