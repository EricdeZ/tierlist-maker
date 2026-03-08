import { Link } from 'react-router-dom'
import smiteLogo from '../../assets/smite2.png'
import statsheetImg from '../../assets/statsheet.png'

const HeroSection = ({ heroRef, heroLight, handleHeroMove, handleHeroLeave, sheetRx, sheetRy }) => {
    return (
        <section
            ref={heroRef}
            onMouseMove={handleHeroMove}
            onMouseLeave={handleHeroLeave}
            className="relative min-h-[85vh] flex items-center px-4 py-20 overflow-hidden"
        >
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div
                    className="absolute top-1/3 left-1/3 w-[800px] h-[800px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
                />
                <div
                    className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 60%)' }}
                />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px'
                    }}
                />
                <div
                    className="absolute top-0 left-1/4 w-px h-full opacity-10 rotate-12 origin-top"
                    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-accent), transparent)' }}
                />
                <div
                    className="absolute top-0 right-1/3 w-px h-full opacity-5 -rotate-6 origin-top"
                    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-accent), transparent)' }}
                />
            </div>

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
                            className="bg-clip-text text-transparent"
                            style={{
                                WebkitBackgroundClip: 'text',
                                backgroundImage: heroLight.active
                                    ? `radial-gradient(circle 300px at ${heroLight.x}% ${heroLight.y}%, rgba(255,255,255,1), rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.55))`
                                    : 'linear-gradient(to right, rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
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

                {/* Screenshot */}
                <div
                    className="relative mt-10 lg:mt-0 lg:absolute lg:right-[-8%] lg:top-1/2 lg:-translate-y-[46%] lg:w-[60%] z-10"
                    style={{ perspective: '1200px' }}
                >
                    <div
                        className="absolute -inset-8 rounded-3xl opacity-25 blur-3xl"
                        style={{ background: 'radial-gradient(ellipse at 60% 40%, var(--color-accent), transparent 65%)' }}
                    />
                    <div
                        className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 lg:rounded-xl"
                        style={{
                            transform: `rotateY(${sheetRy}deg) rotateX(${sheetRx}deg)`,
                            transition: 'transform 0.4s ease-out',
                        }}
                    >
                        <img
                            src={statsheetImg}
                            alt="Player stats dashboard"
                            className="w-full h-auto block"
                        />
                        <div
                            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                            style={{
                                background: `radial-gradient(circle at ${heroLight.x}% ${heroLight.y}%, rgba(255,255,255,0.04), transparent 50%)`,
                                opacity: heroLight.active ? 1 : 0,
                            }}
                        />
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(to bottom, transparent 55%, var(--color-primary) 100%)' }}
                        />
                        <div
                            className="absolute inset-0 pointer-events-none hidden lg:block"
                            style={{ background: 'linear-gradient(to right, var(--color-primary), transparent 20%)' }}
                        />
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(to left, var(--color-primary), transparent 3%)' }}
                        />
                        <div
                            className="absolute top-0 left-0 right-0 h-px"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                        />
                    </div>
                </div>

            </div>
        </section>
    )
}

export default HeroSection
