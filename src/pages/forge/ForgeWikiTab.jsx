import { useState } from 'react'
import { ChevronDown, ChevronUp, Flame, Zap, Snowflake, Trophy, AlertTriangle, TrendingUp, TrendingDown, Gift, Clock } from 'lucide-react'

const sections = [
    {
        id: 'overview',
        icon: Flame,
        title: 'What is Fantasy Forge?',
        content: `Fantasy Forge is a player investment market. Every player in the league has a Spark — a tradeable asset whose price moves based on how many people buy in and how well the player performs on the field.

Buy Sparks (Fuel) on players you believe in. If they perform well, their price rises and you can sell (Cool) for profit. If they underperform, their price drops and you lose Passion.

The goal is simple: build the most profitable portfolio by the time the season ends.`
    },
    {
        id: 'heat',
        icon: TrendingUp,
        title: 'Heat & Performance',
        content: `Every player has a Heat value — this is how much their Spark price has changed recently (24 hours or 7 days).

Heat is driven by the player's on-field performance. After matches, each player's performance multiplier is updated based on their stats — kills, deaths, assists, damage, and more.

All performance updates are role-based. Players are always evaluated against others in the same role, so no role is disadvantaged. A support player won't be penalized for having fewer kills than a carry, and a carry won't be penalized for having less healing than a support. Every role is measured by the stats that matter for their position, ensuring a fair playing field across the board.

Players who aren't playing in matches will see their Heat slowly decay over time. If a player goes inactive or sits out, their price will gradually drift downward. This means investing in benched or inactive players carries real risk — even if they were performing well before, the market won't wait for them.

The key thing to understand: a player with high heat has high expectations baked into their price. A player at 150% heat is expected to keep performing at an elite level. If they have even a mediocre week, their price will drop. Meanwhile, an undervalued player with low or negative heat can surge with a single great performance.

This means buying the most expensive players is not always the best strategy. Sometimes the smartest investment is a player whose price is low but whose upcoming matches could spark a breakout.`
    },
    {
        id: 'fuel',
        icon: Zap,
        title: 'Fueling (Buying)',
        content: `Fueling is how you buy Sparks. Each Spark you buy costs Passion, and the price goes up with every Spark purchased by anyone — not just you.

This means popular players get more expensive over time. Getting in early on a rising player is more profitable than buying after everyone else already has.

You can buy up to 10 Sparks per transaction.`
    },
    {
        id: 'cool',
        icon: Snowflake,
        title: 'Cooling (Selling)',
        warnings: [
            'There is a 10% Cooling Tax on all sales. If you sell for 100, you receive 90.',
            'Selling Sparks pushes the price down temporarily. Dumping a large position will significantly impact the price you get.',
            'Buying the most expensive player does not guarantee profit — if their performance dips even slightly, the price may drop below what you paid.',
        ],
        content: `Cooling is how you sell Sparks for Passion. When you cool, you get the current price minus a 10% tax.

The tax exists to discourage constant flipping and reward investors who commit to their picks. Timing your sells matters — selling right after a big performance spike can lock in gains before a potential dip.

Keep in mind that selling also creates temporary downward pressure on the price. If you dump a lot of Sparks at once, each one sells for less than the last.`
    },
    {
        id: 'free',
        icon: Gift,
        title: 'Free Sparks (Starter & Referral)',
        warnings: [
            'Free Sparks (Starter and Referral) cannot be cooled/sold during the season.',
            'Free Sparks only pay out profit at season end — if the player\'s price is below where you got in, you get nothing from that Spark (not a loss, just zero).',
            'Since you can\'t sell them, choose carefully — you\'re locked in for the whole season.',
        ],
        content: `Every player gets 3 free Starter Sparks per league to try out the Forge without spending Passion. You can also earn free Referral Sparks by referring friends.

These are great for getting started, but they come with restrictions. You cannot sell free Sparks during the season. They only pay out when the season ends (liquidation), and only the profit portion — meaning if the player's price hasn't gone up from when you got the Spark, you get nothing from it.

Think of free Sparks as a free lottery ticket: no downside risk, but you're locked in and can only cash out at the end.`
    },
    {
        id: 'liquidation',
        icon: Clock,
        title: 'Season End (Liquidation)',
        content: `When the season ends, the market is liquidated. All your holdings are automatically sold at their final prices.

For regular Sparks, you get the full value. For free Sparks (Starter & Referral), you get just the profit — the difference between the final price and what the Spark was worth when you got it.`
    },
    {
        id: 'leaderboard',
        icon: Trophy,
        title: 'Hall of Flame',
        content: `The Hall of Flame ranks the top 50 investors by total profit.

Profit is calculated as what your portfolio would actually be worth if you sold everything right now, minus what you spent. This means inflated positions from buying lots of one player don't count as "profit" — the leaderboard accounts for the price impact of selling.

The top 3 investors earn special badges. Can you forge your way to the top?`
    },
    {
        id: 'tips',
        icon: TrendingDown,
        title: 'Common Pitfalls',
        warnings: [
            'Buying a ton of Sparks in one player inflates their price, but selling them back will crash it — your actual profit may be much less than it looks.',
            'High-heat players have high expectations. Even average performance will cause their price to drop.',
            'The 10% cooling tax means you need more than a 10% gain just to break even on a sell.',
            'Selling creates temporary price dips. Panic selling at the same time as others can amplify losses.',
        ],
        content: `The Forge rewards patience, research, and smart timing. Here are some things to watch out for:

Chasing heat — just because a player is up 50% doesn't mean they'll keep climbing. Their price already reflects high expectations.

Stacking one player — putting all your Sparks on one player concentrates your risk. If they have a bad week, your whole portfolio suffers. Diversifying across multiple players spreads the risk.

Ignoring the tax — the 10% cooling tax means short-term flipping is usually unprofitable. You need a meaningful price increase to come out ahead after tax.

Panic selling — if a player's price dips, it might recover. Selling at the bottom locks in your losses and pushes the price down further.`
    },
]

function Section({ section, isOpen, onToggle }) {
    const Icon = section.icon
    return (
        <div className="border border-[var(--forge-text-dim)]/20 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--forge-flame)]/5 transition-colors"
            >
                <Icon size={20} className="text-[var(--forge-flame)] flex-shrink-0" />
                <span className="forge-head text-base sm:text-lg font-semibold tracking-wide text-[var(--forge-text-main)] flex-1">
                    {section.title}
                </span>
                {isOpen
                    ? <ChevronUp size={18} className="text-[var(--forge-text-dim)]" />
                    : <ChevronDown size={18} className="text-[var(--forge-text-dim)]" />
                }
            </button>
            {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                    {section.warnings?.length > 0 && (
                        <div className="space-y-2">
                            {section.warnings.map((w, i) => (
                                <div key={i} className="flex gap-2 p-3 rounded bg-[var(--forge-loss)]/10 border border-[var(--forge-loss)]/20">
                                    <AlertTriangle size={16} className="text-[var(--forge-loss)] flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-[var(--forge-text-main)]">{w}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {section.content.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="text-sm leading-relaxed text-[var(--forge-text-mid)]">
                            {paragraph}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function ForgeWikiTab() {
    const [openSections, setOpenSections] = useState(new Set(['overview']))

    const toggle = (id) => {
        setOpenSections(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const expandAll = () => setOpenSections(new Set(sections.map(s => s.id)))
    const collapseAll = () => setOpenSections(new Set())

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <h2 className="forge-head text-lg font-semibold tracking-wider text-[var(--forge-flame-bright)]">
                    Forge Guide
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="text-xs text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] transition-colors"
                    >
                        Expand all
                    </button>
                    <span className="text-[var(--forge-text-dim)]">|</span>
                    <button
                        onClick={collapseAll}
                        className="text-xs text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] transition-colors"
                    >
                        Collapse all
                    </button>
                </div>
            </div>
            {sections.map(section => (
                <Section
                    key={section.id}
                    section={section}
                    isOpen={openSections.has(section.id)}
                    onToggle={() => toggle(section.id)}
                />
            ))}
        </div>
    )
}
