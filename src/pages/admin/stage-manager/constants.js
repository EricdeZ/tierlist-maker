export const STAGE_TYPE_LABELS = {
    round_robin: 'Round Robin',
    single_elimination: 'Single Elim',
    double_elimination: 'Double Elim',
    swiss: 'Swiss',
    custom: 'Custom',
}

export const STAGE_TYPE_COLORS = {
    round_robin: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    single_elimination: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    double_elimination: 'bg-red-500/15 border-red-500/30 text-red-400',
    swiss: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    custom: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
}

export const STATUS_COLORS = {
    pending: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    active: 'bg-green-500/15 border-green-500/30 text-green-400',
    completed: 'bg-gray-500/15 border-gray-500/30 text-gray-400',
}

export const MATCH_STATUS_COLORS = {
    scheduled: 'bg-blue-500/15 text-blue-400',
    completed: 'bg-green-500/15 text-green-400',
    cancelled: 'bg-red-500/15 text-red-400',
}

// Shared input styles
export const inputStyle = { backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }
export const inputClass = 'w-full rounded-lg px-3 py-2 text-sm border'
export const inputClassSm = 'w-full rounded-lg px-2 py-1.5 text-xs border'
export const numInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
export const numInputClassSm = `${inputClassSm} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
