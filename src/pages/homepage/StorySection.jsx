import { Swords } from 'lucide-react'
import { ALL_RANK_IMAGES } from '../../utils/divisionImages'

const StorySection = ({ leagueCount, divisionCount }) => {
    return (
        <section id="about" className="relative py-24 px-4">
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
            />

            <div className="max-w-5xl mx-auto">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">The Story</span>
                        <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) mb-6 leading-tight">
                            Built by Passion,{' '}
                            <span className="text-(--color-accent)">for Passion</span>
                        </h2>
                        <div className="space-y-4 text-(--color-text-secondary) leading-relaxed">
                            <p>
                                When the SMITE Pro League was officially canceled, many feared competitive SMITE was done for good. But this community doesn't give up that easily.
                            </p>
                            <p>
                                Driven by pure passion, players, organizers, and casters came together to build something new. Multiple community leagues formed — fully structured seasons with divisions, playoffs, and the same fire that made competitive SMITE legendary.
                            </p>
                            <p>
                                <strong className="text-(--color-text)">SMITE 2 Companion</strong> is the hub that tracks it all. Every kill, every match, every clutch play — recorded and ranked. Because this much passion deserves to be seen.
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <div
                            className="rounded-2xl border border-white/10 p-8 text-center relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                        >
                            <div
                                className="absolute top-0 right-0 w-32 h-32 opacity-20"
                                style={{ background: 'radial-gradient(circle at top right, var(--color-accent), transparent 70%)' }}
                            />

                            <div className="flex justify-center text-(--color-accent) mb-6"><Swords className="w-16 h-16" /></div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/5">
                                    <span className="text-(--color-text-secondary) text-sm">Active Leagues</span>
                                    <span className="font-heading font-bold text-(--color-accent) text-lg">{leagueCount}</span>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/5">
                                    <span className="text-(--color-text-secondary) text-sm">Total Divisions</span>
                                    <span className="font-heading font-bold text-(--color-accent) text-lg">{divisionCount}</span>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-center gap-2">
                                {ALL_RANK_IMAGES.map((img, i) => (
                                    <img key={i} src={img} alt="" className="w-9 h-9 object-contain opacity-70" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default StorySection
