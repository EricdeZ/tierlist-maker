export function NumInput({ value, onChange, align = 'center' }) {
    return (
        <td className="py-1.5 px-1">
            <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
                   className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] tabular-nums text-${align} transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
        </td>
    )
}

export function WinnerBtn({ label, color, isActive, onClick }) {
    return (
        <button onClick={onClick}
                className={`px-3 py-1 text-xs rounded transition-all ${
                    isActive
                        ? 'text-white ring-1 ring-white/30 font-semibold'
                        : 'bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-white/30'
                }`}
                style={isActive ? { backgroundColor: color } : undefined}>
            {label}
        </button>
    )
}
