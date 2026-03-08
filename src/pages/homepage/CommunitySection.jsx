import { Mic, Video, Gamepad2 } from 'lucide-react'

const GROUPS = [
    {
        icon: <Mic className="w-8 h-8" />,
        title: 'Organizers & Admins',
        desc: 'The ones who handle scheduling, rules, disputes, and everything behind the scenes so the rest of us can compete.',
    },
    {
        icon: <Video className="w-8 h-8" />,
        title: 'Casters & Streamers',
        desc: 'Bringing every match to life with commentary, hype, and production — giving these games the spotlight they deserve.',
    },
    {
        icon: <Gamepad2 className="w-8 h-8" />,
        title: 'Players & Captains',
        desc: 'The ones showing up week after week, grinding scrims, and proving that the passion for competitive SMITE burns stronger than ever.',
    },
]

const CommunitySection = () => {
    return (
        <section className="py-20 px-4">
            <div
                className="w-2/3 h-px mx-auto mb-20"
                style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent)/0.3, transparent)' }}
            />

            <div className="max-w-4xl mx-auto text-center">
                <span className="text-sm font-bold text-(--color-accent) uppercase tracking-widest mb-3 block">Respect</span>
                <h2 className="font-heading text-3xl sm:text-4xl font-black text-(--color-text) mb-6">
                    Powered by the Community
                </h2>
                <p className="text-(--color-text-secondary) text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                    None of this happens without the incredible people pouring their time, energy, and passion into keeping competitive SMITE alive. Massive shoutout to everyone behind these leagues.
                </p>

                <div className="grid sm:grid-cols-3 gap-6">
                    {GROUPS.map((group) => (
                        <div
                            key={group.title}
                            className="rounded-xl border border-white/10 p-6 text-center"
                            style={{ background: 'linear-gradient(to bottom, var(--color-secondary), var(--color-primary))' }}
                        >
                            <div className="flex justify-center text-(--color-accent) mb-4">{group.icon}</div>
                            <h3 className="font-heading text-base font-bold text-(--color-text) mb-2">{group.title}</h3>
                            <p className="text-sm text-(--color-text-secondary) leading-relaxed">{group.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default CommunitySection
