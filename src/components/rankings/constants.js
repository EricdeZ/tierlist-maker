import soloImage from '../../assets/roles/solo.webp'
import jungleImage from '../../assets/roles/jungle.webp'
import midImage from '../../assets/roles/mid.webp'
import suppImage from '../../assets/roles/supp.webp'
import adcImage from '../../assets/roles/adc.webp'

export const roles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']

export const roleImages = {
    'SOLO': soloImage,
    'JUNGLE': jungleImage,
    'MID': midImage,
    'SUPPORT': suppImage,
    'ADC': adcImage
}

export const STAT_TYPES = [
    { key: 'none', label: 'No Stats', buttonLabel: 'No Stats' },
    { key: 'kda', label: 'KDA', buttonLabel: 'KDA' },
    { key: 'killsPerGame', label: 'K/G', buttonLabel: 'Kills / Game' },
    { key: 'deathsPerGame', label: 'D/G', buttonLabel: 'Deaths / Game' },
    { key: 'assistsPerGame', label: 'A/G', buttonLabel: 'Assists / Game' },
    { key: 'damagePerGame', label: 'Dmg/G', buttonLabel: 'Damage / Game' },
    { key: 'mitigationsPerGame', label: 'Mit/G', buttonLabel: 'Mitigations / Game' },
]
