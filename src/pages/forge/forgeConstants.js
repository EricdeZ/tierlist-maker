import { Flame, Zap, Trophy, Target } from 'lucide-react'

export const TABS = [
    { key: 'market', label: 'The Forge', icon: Flame },
    { key: 'portfolio', label: 'My Sparks', icon: Zap },
    { key: 'leaderboard', label: 'Hall of Flame', icon: Trophy },
    { key: 'challenges', label: 'Contracts', icon: Target },
]

export const SORT_OPTIONS = [
    { key: 'price-desc', label: 'Highest Value' },
    { key: 'price-asc', label: 'Lowest Value' },
    { key: 'change-desc', label: 'Biggest Gainers' },
    { key: 'change-asc', label: 'Biggest Losers' },
    { key: 'sparks-desc', label: 'Most Popular' },
    { key: 'name-asc', label: 'Name (A-Z)' },
]

// Heat tier thresholds based on price change (supports 24h or 7d)
export function getHeatTier(priceChange) {
    if (priceChange == null) return 'warm'
    if (priceChange > 10) return 'blazing'
    if (priceChange >= 0) return 'warm'
    return 'cooling'
}

// Get the active change value based on period
export function getActiveChange(player, changeView) {
    return changeView === '7d' ? player.priceChange7d : player.priceChange24h
}

// Forge color tokens — CSS custom properties are defined in forge.css,
// these JS constants are for canvas/inline-style usage
export const FORGE_COLORS = {
    flame: '#e86520',
    flameHot: '#ff6a00',
    flameBright: '#ffaa33',
    ember: '#c44a10',
    gold: '#d4a030',
    goldBright: '#f0c840',
    molten: '#ff3d00',
    spark: '#ffcc44',
    gain: '#44cc66',
    loss: '#ee4444',
    cool: '#4499bb',
    coolDim: '#2a4858',
    textMain: '#e0dcd4',
    textMid: '#999088',
    textDim: '#5a554e',
}

// Sparkline color configs by heat tier
export const SPARK_COLORS = {
    blazing: { line: '#e86520', fill: 'rgba(232,101,26,0.25)' },
    warm:    { line: '#c8a030', fill: 'rgba(212,160,48,0.18)' },
    cooling: { line: '#4499bb', fill: 'rgba(68,153,187,0.18)' },
    neutral: { line: '#888888', fill: 'rgba(136,136,136,0.10)' },
}

// Fallback history for players with no data — flat line at 100
export const FALLBACK_HISTORY = [50, 50, 50, 50, 50, 50, 50, 50]

// Burst particle color palette (RGB arrays)
export const BURST_COLORS = [
    [255, 140, 30],
    [255, 90, 10],
    [255, 200, 50],
    [255, 60, 0],
    [255, 170, 40],
]

// Ember particle color palette (RGB arrays)
export const EMBER_COLORS = [
    [255, 110, 20],
    [230, 80, 12],
    [255, 150, 35],
]
