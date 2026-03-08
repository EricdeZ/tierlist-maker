import soloImage from '../../../assets/roles/solo.webp'
import jungleImage from '../../../assets/roles/jungle.webp'
import midImage from '../../../assets/roles/mid.webp'
import suppImage from '../../../assets/roles/supp.webp'
import adcImage from '../../../assets/roles/adc.webp'

export const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage,
}

export const formatNumber = (num) => new Intl.NumberFormat().format(Math.round(num))

export const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function computeStats(source) {
    const gamesPlayed = parseInt(source?.games_played) || 0
    const wins = parseInt(source?.wins) || 0
    const totalKills = parseInt(source?.total_kills) || 0
    const totalDeaths = parseInt(source?.total_deaths) || 0
    const totalAssists = parseInt(source?.total_assists) || 0
    const totalDamage = parseInt(source?.total_damage) || 0
    const totalMitigated = parseInt(source?.total_mitigated) || 0
    const kda = totalDeaths === 0
        ? totalKills + (totalAssists / 2)
        : (totalKills + (totalAssists / 2)) / totalDeaths
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0
    return { gamesPlayed, wins, totalKills, totalDeaths, totalAssists, totalDamage, totalMitigated, kda, winRate }
}

export function aggregateGodStats(games, godsList) {
    const godMap = {}
    for (const game of games) {
        const name = game.god_played
        if (!name || name === 'Unknown') continue
        if (!godMap[name]) {
            const godInfo = godsList.find(g => g.name.toLowerCase() === name.toLowerCase())
            godMap[name] = {
                name, imageUrl: godInfo?.image_url || null,
                games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, mitigated: 0,
            }
        }
        const g = godMap[name]
        g.games++
        if (game.winner_team_id === game.player_team_id) g.wins++
        g.kills += parseInt(game.kills) || 0
        g.deaths += parseInt(game.deaths) || 0
        g.assists += parseInt(game.assists) || 0
        g.damage += parseInt(game.damage) || 0
        g.mitigated += parseInt(game.mitigated) || 0
    }
    return Object.values(godMap)
        .map(g => ({
            ...g,
            winRate: g.games > 0 ? (g.wins / g.games) * 100 : 0,
            kda: g.deaths === 0
                ? g.kills + (g.assists / 2)
                : (g.kills + (g.assists / 2)) / g.deaths,
            avgDamage: g.games > 0 ? g.damage / g.games : 0,
            avgMitigated: g.games > 0 ? g.mitigated / g.games : 0,
        }))
        .sort((a, b) => b.games - a.games)
}
