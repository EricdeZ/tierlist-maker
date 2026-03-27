import { useState, useRef, useEffect, useMemo } from 'react'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Search, ChevronRight, X, ScrollText, Scale, Swords, Trophy, Shield, Clock, Tv, Users, AlertTriangle, MessageSquare, Medal, Pause, Gavel } from 'lucide-react'

const RULES_DATA = [
    {
        id: 'community-conduct',
        title: '1 - Community Conduct',
        icon: Users,
        subsections: [
            {
                id: 'discord-code-of-conduct',
                title: '1.1 Discord Code of Conduct',
                content: [
                    'In order to promote a positive and cooperative community here within this server, we ask all members to adhere to the general Code of Conduct below.',
                    {
                        type: 'list',
                        items: [
                            'Do not post any images or videos depicting any sexually explicit, NSFW, illegal, or graphic content (including Hentai).',
                            'No racism, sexism, ableism, hate speech, harassment, death threats, and personal insults of any kind. Please refrain from using any potential offensive slurs and slang. If you think what you are about to post could potentially be an issue, don\'t post it.',
                            'Do not post any personal information (such as real names, addresses, emails, passwords, bank account and credit card information) either belonging to yourself, or others.',
                            'Do not spam or harass individuals within the community. This includes continuing to mention or @ them when asked to stop.',
                            'Keep self-promotion to the appropriate channels. The only permitted self-promotion is content (Streams/YouTube videos).',
                        ]
                    }
                ]
            },
            {
                id: 'participant-code-of-conduct',
                title: '1.2 Participant Code of Conduct',
                content: [
                    'In order to maintain competitive integrity within the tournament, we ask that all participants follow these guidelines. Any violations of the Code of Conduct policy will be evaluated on a case-by-case basis by SmiteComp staff.',
                    {
                        type: 'list',
                        items: [
                            'Tournament participants will abstain from using cheats of any kind. This includes and is not limited to: injectors, cheats, hacks, third party softwares, third party hardwares, etc.',
                            'Tournament participants are prohibited from sharing accounts.',
                            'Tournament participants are prohibited from playing on smurf accounts.',
                            {
                                text: 'Tournament participants are prohibited from engaging in acts of harassment while in-game. Examples include but not limited to:',
                                sub: [
                                    'Whispering the opponent while in game with the intent to harass, demean, embarrass.',
                                    'Typing/spamming in an opponent\'s Twitch chat while they are streaming with malicious intent.',
                                    'Maliciously spamming emotes, taunts, or laughs strictly as an extension of harassment towards a player.',
                                ]
                            },
                            {
                                text: 'Tournament participants are prohibited from receiving any sort of in-game coaching. Coaches may help with picks and bans in-between games and can only join back once the game concludes. Prohibited forms include:',
                                sub: [
                                    'Coaches or other individuals remain in team voice chats, regardless of them relaying information.',
                                    'Whispering information to players while in-game.',
                                    'Sending Discord messages containing information relevant to the match to players while in-game.',
                                    'Sending coaching tips and advice through streaming services with the intent of said player applying the information given.',
                                ],
                                note: 'Violating in-game coaching guidelines will be deemed a game forfeiture for the team committing the infraction.'
                            },
                            'Tournament participants are prohibited from assisting banned players from entering the tournament.',
                            {
                                text: 'Tournament participants are prohibited from \'inting, throwing, or sabotaging\' games in an attempt to purposefully lose.',
                                sub: [
                                    'This can be defined as a player repeatedly killing themselves to others/towers/jungle camps, deliberately disobeying or ignoring teammates\' calls on multiple occasions, or exhibiting odd behavior that is against the interest of the team.'
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'tournament-rules',
        title: '2 - Tournament Rules',
        icon: ScrollText,
        subsections: [
            {
                id: 'communication',
                title: '2.1 Communication',
                icon: MessageSquare,
                content: [
                    { type: 'list', items: ['All communication regarding tournament issues are to be directed towards tournament staff via the Discord ticket system.'] }
                ]
            },
            {
                id: 'scheduling',
                title: '2.2 Scheduling',
                icon: Clock,
                content: [
                    {
                        type: 'list',
                        items: [
                            'All tournament times are in Eastern Standard Time (EST).',
                            {
                                text: 'The tournament will take place over multiple days:',
                                sub: [
                                    'Day 1 — Live Auction Draft',
                                    'Day 2 — Quarter-finals and Semi-finals',
                                    'Day 3 — Finals',
                                ]
                            },
                            'Tournament check-ins open at 7:30 PM EST. The tournament starts at 8:00 PM EST.',
                            'Tournament matches will be played within 15 minutes of the bracket being posted. A SmiteComp tournament organizer will let you know when the bracket is released.',
                        ]
                    }
                ]
            },
            {
                id: 'match-format',
                title: '2.3 Match Format',
                icon: Swords,
                content: [
                    {
                        type: 'list',
                        items: [
                            'All tournaments utilize true random seeding.',
                            'Tournament rounds will range from best-of-one (bo1) for quarter-finals, best-of-three (bo3) for semi-finals, and best-of-five (bo5) for finals.',
                            'The higher seeded team must make the match lobby and will always have their choice of first or second pick.',
                        ]
                    }
                ]
            },
            {
                id: 'tournament-prizing',
                title: '2.4 Tournament Prizing',
                icon: Trophy,
                content: [
                    {
                        type: 'list',
                        items: [
                            'Exclusive tournament player cards for all participants and staff',
                            'HiRez prizing for top finishers',
                            'SmiteComp.com card packs',
                            'Passion rewards',
                        ]
                    }
                ]
            },
            {
                id: 'match-reporting',
                title: '2.5 Match Reporting',
                icon: Medal,
                content: [
                    {
                        type: 'list',
                        items: [
                            'Team captains from the winning team are required to post tournament match screenshots in the respective #match-report channel of the SmiteComp Discord.',
                            'Matches must be reported and posted within 5 minutes of the completion of a game.',
                        ]
                    }
                ]
            },
            {
                id: 'tardiness-forfeitures',
                title: '2.6 Tardiness & Forfeitures',
                icon: AlertTriangle,
                content: [
                    {
                        type: 'list',
                        items: [
                            'Teams will have 15 minutes from release of the tournament bracket to begin their first game. Failure to show up within 15 minutes will result in a match forfeiture.',
                            'Matches will be played within 10 minutes of the bracket being updated. Failure to show up within 10 minutes of a match ending will result in forfeiture.',
                            'In the event of a match forfeiture, the team captain for the team fielding a valid roster must report the relevant proof in the #match-report channel of the SmiteComp Discord.',
                        ]
                    }
                ]
            },
            {
                id: 'content-restrictions',
                title: '2.7 Content Restrictions',
                icon: Shield,
                content: [
                    {
                        type: 'list',
                        items: [
                            'An updated list of banned content will be maintained within the SmiteComp Discord. Participants are responsible with keeping themselves up to date with regards to banned content.',
                            'If a player utilizes a banned skin, the game is subject to a restart if the banned skin is identified prior to minions spawning. If the enemy team does not report the banned skin prior to minions spawning, the match will be played with the banned skin and no penalty will be given.',
                            'Any team who utilizes a banned item, god, god bug, or god combination will forfeit any and all games in which the banned content was used.',
                        ]
                    }
                ]
            },
            {
                id: 'player-eligibility',
                title: '2.8 Player Eligibility',
                icon: Users,
                content: [
                    {
                        type: 'list',
                        items: [
                            'Team captains are required to reside within the SmiteComp Discord while playing in the tournament.',
                            'Players must be eligible to play under all of the Hi-Rez Studios Terms & Conditions.',
                            'No smurfing, or alt accounts are allowed to be played on whatsoever unless there is an exigent circumstance that inhibits the player from playing on their main account. This is at the complete discretion of the tournament organizers or league management, contingent on them being presented with proof of ownership.',
                            'Players who are banned or suspended from Hi-Rez are not eligible to play in the tournament for the duration of their ban or suspension.',
                            'Players are not permitted to have usernames or Discord names that are considered offensive. This includes but is not limited to: homophobic, racist, sexist, ableist, otherwise obscene or offensive usernames. SmiteComp staff reserve the right to demand a player change a username that they perceive violating this provision. SmiteComp reserves the right to not permit a player to play with a username that violates this rule.',
                        ]
                    }
                ]
            },
            {
                id: 'pauses-surrenders-remakes',
                title: '2.9 Pauses, Surrenders, & Remakes',
                icon: Pause,
                content: [
                    {
                        type: 'list',
                        items: [
                            'No tactical pauses are allowed for any reason (pausing to regroup, talk strategies, etc).',
                            {
                                text: 'No combat pauses are allowed for any reason.',
                                sub: [
                                    'Combat pauses must be reported to tournament organizers upon occurrence.',
                                    'First violation will result in a warning towards the team that paused, unless it was instrumental towards the outcome, in which case tournament organizers will review the pause.',
                                    'Second violation will potentially result in a game forfeiture depending on the severity of the pause pending review.',
                                ]
                            },
                            {
                                text: 'Each team is granted up to two (2) five (5) minute pauses per game. These pauses can take up to, but not exceed, more than ten (10) minutes per game.',
                                sub: [
                                    'Pauses before minions spawn for the following conditions do not count: checking banned content, contacting admins to dispute a rule violation, or a player fails to load into the game.',
                                ]
                            },
                        ]
                    }
                ]
            },
            {
                id: 'broadcasting-expectations',
                title: '2.10 Broadcasting Expectations',
                icon: Tv,
                content: [
                    {
                        type: 'list',
                        items: [
                            'When tournament matches are selected to be broadcasted, players will be required to wait for the spectator(s) to join the lobby before starting their match. Captains will be asked to communicate with the production team before starting their match.',
                            'Tournament participants are prohibited from casting live matches that are being aired on the official SmiteComp Twitch account.',
                        ]
                    }
                ]
            },
        ]
    },
    {
        id: 'tournament-formats',
        title: '3 - Tournament Formats',
        icon: Gavel,
        subsections: [
            {
                id: 'auction-draft-single-elim',
                title: '3.1 Auction Draft + Single Elimination',
                content: [
                    'The SmiteComp Easter Invitational uses an Auction Draft followed by a Single Elimination bracket.',
                    {
                        type: 'callout',
                        title: 'Auction Draft',
                        text: 'Each captain will have a set currency amount to bid on players to add them to their roster. A separate, more in-depth announcement regarding the Auction Draft format, rules, and currency details will follow.'
                    },
                    {
                        type: 'callout',
                        title: 'Single Elimination',
                        text: 'Following the draft, teams will compete in a single elimination bracket. Quarter-final matches are best-of-one (bo1), semi-final matches are best-of-three (bo3), and the finals are best-of-five (bo5).'
                    }
                ]
            }
        ]
    }
]

function renderContent(content) {
    return content.map((block, i) => {
        if (typeof block === 'string') {
            return <p key={i} className="text-(--color-text-secondary) leading-relaxed">{block}</p>
        }
        if (block.type === 'callout') {
            return (
                <div key={i} className="bg-white/5 border border-(--color-accent)/20 rounded-lg p-4">
                    <h4 className="text-(--color-accent) font-semibold font-(family-name:--font-heading) mb-1">{block.title}</h4>
                    <p className="text-(--color-text-secondary) text-sm leading-relaxed">{block.text}</p>
                </div>
            )
        }
        if (block.type === 'list') {
            return (
                <ol key={i} className="space-y-2.5">
                    {block.items.map((item, j) => {
                        if (typeof item === 'string') {
                            return (
                                <li key={j} className="flex gap-3 text-(--color-text-secondary) text-sm leading-relaxed">
                                    <span className="text-(--color-accent) font-semibold shrink-0 w-5 text-right">{j + 1}.</span>
                                    <span>{item}</span>
                                </li>
                            )
                        }
                        return (
                            <li key={j} className="flex gap-3 text-(--color-text-secondary) text-sm leading-relaxed">
                                <span className="text-(--color-accent) font-semibold shrink-0 w-5 text-right">{j + 1}.</span>
                                <div className="space-y-2">
                                    <span>{item.text}</span>
                                    {item.sub && (
                                        <ol className="space-y-1.5 ml-2 mt-1">
                                            {item.sub.map((s, k) => (
                                                <li key={k} className="flex gap-2 text-white/50 text-sm">
                                                    <span className="text-(--color-accent)/60 shrink-0">{String.fromCharCode(97 + k)}.</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                    {item.note && (
                                        <p className="text-(--color-accent)/80 text-xs italic mt-1">{item.note}</p>
                                    )}
                                </div>
                            </li>
                        )
                    })}
                </ol>
            )
        }
        return null
    })
}

function flattenText(content) {
    const parts = []
    for (const block of content) {
        if (typeof block === 'string') { parts.push(block); continue }
        if (block.type === 'callout') { parts.push(block.title, block.text); continue }
        if (block.type === 'list') {
            for (const item of block.items) {
                if (typeof item === 'string') { parts.push(item); continue }
                parts.push(item.text)
                if (item.sub) parts.push(...item.sub)
                if (item.note) parts.push(item.note)
            }
        }
    }
    return parts.join(' ').toLowerCase()
}

export default function TournamentRules() {
    const [search, setSearch] = useState('')
    const [activeId, setActiveId] = useState(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const sectionRefs = useRef({})

    const filteredSections = useMemo(() => {
        if (!search.trim()) return RULES_DATA
        const q = search.toLowerCase()
        return RULES_DATA.map(section => {
            const matchingSubs = section.subsections.filter(sub =>
                sub.title.toLowerCase().includes(q) || flattenText(sub.content).includes(q)
            )
            if (matchingSubs.length > 0) return { ...section, subsections: matchingSubs }
            if (section.title.toLowerCase().includes(q)) return section
            return null
        }).filter(Boolean)
    }, [search])

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setActiveId(entry.target.id)
                }
            }
        }, { rootMargin: '-80px 0px -60% 0px' })

        const els = Object.values(sectionRefs.current)
        els.forEach(el => el && observer.observe(el))
        return () => observer.disconnect()
    }, [filteredSections])

    const scrollTo = (id) => {
        sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setSidebarOpen(false)
    }

    return (
        <>
            <PageTitle title="Tournament Rules" description="SmiteComp Easter Invitational rules and expectations" />
            <Navbar title="Tournament Rules" />

            <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold font-(family-name:--font-heading) text-(--color-text)">
                        Easter Invitational
                    </h1>
                    <p className="text-(--color-text-secondary) mt-2">Rules & Expectations</p>
                    <p className="text-white/30 text-xs mt-1">Last Updated: March 27, 2026</p>
                </div>

                {/* Intro */}
                <div className="max-w-3xl mx-auto mb-10 bg-white/5 border border-white/10 rounded-xl p-5 text-sm text-(--color-text-secondary) leading-relaxed space-y-3">
                    <p>
                        The SmiteComp Easter Invitational is a community tournament with the expectation of providing
                        a gamified draft experience and entertainment with some high quality SMITE.
                        SmiteComp is open to players of all skill levels and incorporates cross-platform play —
                        available on PC, Microsoft Xbox, Sony PlayStation, and Nintendo Switch.
                    </p>
                    <p>
                        All tournament related issues, questions, or concerns are to be directed towards SmiteComp
                        tournament organizers (Aprillis, ProcrasteNate, & Fish1n), as well as league management on occasion.
                    </p>
                </div>

                <div className="flex gap-8 relative">
                    {/* Mobile sidebar toggle */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden fixed bottom-6 right-6 z-50 bg-(--color-accent) text-black w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    >
                        <ScrollText size={20} />
                    </button>

                    {/* Sidebar */}
                    <aside className={`
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:translate-x-0 fixed lg:sticky top-20 left-0 z-40
                        w-72 h-[calc(100vh-5rem)] overflow-y-auto shrink-0
                        bg-(--color-secondary) lg:bg-transparent
                        border-r border-white/10 lg:border-0
                        p-4 lg:p-0
                        transition-transform lg:transition-none
                    `}>
                        {/* Search */}
                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search rules..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-8 text-sm text-(--color-text) placeholder:text-white/30 focus:outline-none focus:border-(--color-accent)/40"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Nav */}
                        <nav className="space-y-1">
                            {filteredSections.map(section => {
                                const Icon = section.icon
                                return (
                                    <div key={section.id}>
                                        <button
                                            onClick={() => scrollTo(section.id)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold font-(family-name:--font-heading) transition-colors text-left ${activeId === section.id ? 'text-(--color-accent) bg-white/5' : 'text-(--color-text) hover:bg-white/5'}`}
                                        >
                                            <Icon size={14} className="shrink-0 opacity-60" />
                                            <span className="truncate">{section.title}</span>
                                        </button>
                                        <div className="ml-5 border-l border-white/5 pl-3 space-y-0.5 mb-1">
                                            {section.subsections.map(sub => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => scrollTo(sub.id)}
                                                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors text-left ${activeId === sub.id ? 'text-(--color-accent)' : 'text-white/40 hover:text-white/70'}`}
                                                >
                                                    <ChevronRight size={10} className="shrink-0" />
                                                    <span className="truncate">{sub.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredSections.length === 0 && (
                                <p className="text-white/30 text-xs text-center py-4">No matching rules found</p>
                            )}
                        </nav>
                    </aside>

                    {/* Overlay for mobile sidebar */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
                    )}

                    {/* Main content */}
                    <main className="flex-1 min-w-0 space-y-10">
                        {filteredSections.map(section => (
                            <div key={section.id}>
                                <h2
                                    id={section.id}
                                    ref={el => sectionRefs.current[section.id] = el}
                                    className="text-xl font-bold font-(family-name:--font-heading) text-(--color-text) mb-6 pb-2 border-b border-white/10 scroll-mt-24"
                                >
                                    {section.title}
                                </h2>
                                <div className="space-y-8">
                                    {section.subsections.map(sub => (
                                        <div
                                            key={sub.id}
                                            id={sub.id}
                                            ref={el => sectionRefs.current[sub.id] = el}
                                            className="bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-3 scroll-mt-24"
                                        >
                                            <h3 className="text-base font-semibold font-(family-name:--font-heading) text-(--color-text) flex items-center gap-2">
                                                {sub.icon && <sub.icon size={16} className="text-(--color-accent)/60" />}
                                                {sub.title}
                                            </h3>
                                            {renderContent(sub.content)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredSections.length === 0 && (
                            <div className="text-center py-16">
                                <Search size={32} className="mx-auto text-white/20 mb-3" />
                                <p className="text-white/40 text-sm">No rules match "{search}"</p>
                                <button onClick={() => setSearch('')} className="text-(--color-accent) text-sm mt-2 hover:underline">Clear search</button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    )
}
