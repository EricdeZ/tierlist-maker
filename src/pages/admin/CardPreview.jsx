import { useState } from 'react'
import TradingCard from '../../components/TradingCard'
import TradingCardHolo from '../../components/TradingCardHolo'

const ROLES = ['ADC', 'SOLO', 'JUNGLE', 'MID', 'SUPPORT']

// Ranked from highest (most premium) to lowest rarity
const RARITIES = [
    // Tier 1: Legendary
    { key: 'gold', label: 'Gold', desc: 'Gold + conic rainbow burst', tier: 1 },
    { key: 'secret', label: 'Secret', desc: 'Gold sparkle + glitter', tier: 1 },
    { key: 'rainbow', label: 'Rainbow', desc: 'Spectrum waves + glitter', tier: 1 },

    // Tier 2: Epic
    { key: 'cosmos', label: 'Cosmos', desc: 'Nebula layered texture', tier: 2 },
    { key: 'rainbow-alt', label: 'Rainbow Alt', desc: 'Vertical scrolling bands', tier: 2 },
    { key: 'sparkle', label: 'Sparkle', desc: 'Glitter-heavy hue burst', tier: 2 },
    { key: 'radiant', label: 'Radiant', desc: 'Crosshatch + rainbow bands', tier: 2 },

    // Tier 3: Rare
    { key: 'ultra', label: 'Ultra', desc: 'Sunpillar + cyan diagonals', tier: 3 },
    { key: 'shiny', label: 'Shiny', desc: 'Illusion texture + sunpillar', tier: 3 },
    { key: 'vstar', label: 'V Star', desc: 'Geometric + masked glow', tier: 3 },
    { key: 'galaxy', label: 'Galaxy', desc: 'Diagonal rainbow bands', tier: 3 },

    // Tier 4: Uncommon
    { key: 'holo', label: 'Holo', desc: 'Rainbow scanlines', tier: 4 },
    { key: 'amazing', label: 'Amazing', desc: 'Subtle glitter glow', tier: 4 },
    { key: 'reverse', label: 'Reverse', desc: 'Foil radial + diagonal', tier: 4 },

    // Tier 5: Common
    { key: 'common', label: 'Common', desc: '3D tilt only', tier: 5 },
]

const TIER_LABELS = {
    1: { name: 'Legendary', color: 'text-yellow-400', border: 'border-yellow-500/30' },
    2: { name: 'Epic', color: 'text-purple-400', border: 'border-purple-500/30' },
    3: { name: 'Rare', color: 'text-blue-400', border: 'border-blue-500/30' },
    4: { name: 'Uncommon', color: 'text-green-400', border: 'border-green-500/30' },
    5: { name: 'Common', color: 'text-(--color-text-secondary)', border: 'border-white/10' },
}

const SAMPLE_PLAYERS = {
    ADC: { name: 'DonutDoug', team: 'The Kings Court', god: 'Chiron' },
    SOLO: { name: 'TankMaster', team: 'Iron Wolves', god: 'Hercules' },
    JUNGLE: { name: 'GankLord', team: 'Viper Strike', god: 'Thanatos' },
    MID: { name: 'ArcaneWiz', team: 'Shadow Mages', god: 'Scylla' },
    SUPPORT: { name: 'ShieldBro', team: 'Guardian Wall', god: 'Geb' },
}

function makeSampleCard(role) {
    const p = SAMPLE_PLAYERS[role]
    return {
        playerName: p.name,
        teamName: p.team,
        teamColor: null,
        seasonName: 'Athens Season 8',
        role,
        avatarUrl: null,
        stats: {
            gamesPlayed: 12,
            wins: 8,
            winRate: 66.7,
            kda: 3.2,
            avgDamage: 28400,
            avgMitigated: 14200,
            totalKills: 48,
            totalDeaths: 22,
            totalAssists: 36,
        },
        bestGod: {
            name: p.god,
            imageUrl: null,
            games: 5,
            winRate: 80,
        },
    }
}

export default function CardPreview() {
    const [view, setView] = useState('effects')
    const [selectedRole, setSelectedRole] = useState('MID')

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <h1 className="text-2xl font-bold text-(--color-text) mb-2">Trading Card Preview</h1>
            <p className="text-(--color-text-secondary) text-sm mb-6">
                {RARITIES.length} holographic effects ranked across 5 rarity tiers.
            </p>

            {/* View toggle */}
            <div className="flex flex-wrap gap-2 mb-4">
                {[
                    { key: 'effects', label: 'All Effects' },
                    { key: 'roles', label: 'By Role' },
                ].map(v => (
                    <button
                        key={v.key}
                        onClick={() => setView(v.key)}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                            view === v.key
                                ? 'bg-(--color-accent) text-(--color-primary)'
                                : 'bg-white/5 text-(--color-text-secondary) hover:text-(--color-text)'
                        }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Role selector */}
            <div className="flex gap-2 mb-8">
                {ROLES.map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                            selectedRole === role
                                ? 'bg-(--color-accent) text-(--color-primary)'
                                : 'bg-white/5 text-(--color-text-secondary) hover:text-(--color-text)'
                        }`}
                    >
                        {role}
                    </button>
                ))}
            </div>

            {/* All Effects: grouped by tier */}
            {view === 'effects' && [1, 2, 3, 4, 5].map(tier => {
                const tierInfo = TIER_LABELS[tier]
                const tierRarities = RARITIES.filter(r => r.tier === tier)
                return (
                    <div key={tier} className={`mb-10 pb-8 border-b ${tierInfo.border}`}>
                        <div className="flex items-center gap-3 mb-5">
                            <span className={`text-lg font-bold uppercase tracking-wider ${tierInfo.color}`}>
                                Tier {tier}: {tierInfo.name}
                            </span>
                            <span className="text-xs text-(--color-text-secondary)">
                                {tierRarities.length} effect{tierRarities.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-8">
                            {tierRarities.map(({ key, label, desc }) => (
                                <div key={key} className="flex flex-col items-center gap-2">
                                    <TradingCardHolo rarity={key} role={selectedRole}>
                                        <TradingCard {...makeSampleCard(selectedRole)} />
                                    </TradingCardHolo>
                                    <span className="text-sm font-bold text-(--color-text) uppercase tracking-wider">{label}</span>
                                    <span className="text-xs text-(--color-text-secondary)">{desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {/* By Role: one row per role with all rarities */}
            {view === 'roles' && ROLES.map(role => (
                <div key={role} className="mb-10">
                    <h2 className="text-lg font-bold text-(--color-text) mb-4 uppercase tracking-wider">{role}</h2>
                    <div className="flex flex-wrap gap-6">
                        {RARITIES.map(({ key, label }) => (
                            <div key={key} className="flex flex-col items-center gap-2">
                                <TradingCardHolo rarity={key} role={role}>
                                    <TradingCard {...makeSampleCard(role)} />
                                </TradingCardHolo>
                                <span className="text-xs text-(--color-text-secondary) uppercase tracking-wider">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
