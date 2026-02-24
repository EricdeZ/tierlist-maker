import passionCoin from '../../assets/passion/passion.png'
import passionTails from '../../assets/passion/passiontails.png'
import flip1 from '../../assets/passion/flipping1.png'
import flip2 from '../../assets/passion/flipping2.png'
import flip3 from '../../assets/passion/flipping3.png'

export const WAGER_PRESETS = [
    { label: 'Free', value: 0 },
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
]

export const FLIP_CYCLE = [passionCoin, flip1, flip2, flip3, passionTails, flip3, flip2, flip1]
export const INITIAL_SHOW = 10
