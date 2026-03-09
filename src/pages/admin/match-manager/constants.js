import soloImage from '../../../assets/roles/solo.webp'
import jungleImage from '../../../assets/roles/jungle.webp'
import midImage from '../../../assets/roles/mid.webp'
import suppImage from '../../../assets/roles/supp.webp'
import adcImage from '../../../assets/roles/adc.webp'

export const ROLE_IMAGES = { Solo: soloImage, Jungle: jungleImage, Mid: midImage, Support: suppImage, ADC: adcImage }
export const ROLE_LIST = ['Solo', 'Jungle', 'Mid', 'Support', 'ADC']

export const API = import.meta.env.VITE_API_URL || '/api'
export const SEASON_KEY = 'smite2_admin_season'
