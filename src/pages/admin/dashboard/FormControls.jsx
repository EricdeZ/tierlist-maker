export function RadioOption({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                active
                    ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                    : 'bg-white/5 border-white/10 text-[var(--color-text-secondary)] hover:border-white/20 hover:text-[var(--color-text)]'
            }`}
        >
            {label}
        </button>
    )
}

export function StatusBadge({ status }) {
    const styles = {
        pending: 'bg-white/10 text-[var(--color-text-secondary)]',
        processing: 'bg-blue-500/20 text-blue-400',
        review: 'bg-yellow-500/20 text-yellow-400',
        error: 'bg-red-500/20 text-red-400',
        submitted: 'bg-green-500/20 text-green-400',
    }
    const labels = {
        pending: '\u23f3 Pending',
        processing: '\ud83d\udd04 Extracting',
        review: '\ud83d\udcdd Review',
        error: '\u274c Error',
        submitted: '\u2705 Done',
    }
    return <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${styles[status]}`}>{labels[status]}</span>
}

export function WinnerButton({ label, color, isActive, onClick }) {
    const activeClass = color === 'blue' ? 'bg-blue-500 text-white ring-1 ring-blue-400' : 'bg-red-500 text-white ring-1 ring-red-400'
    const hoverClass = color === 'blue' ? 'hover:border-blue-400' : 'hover:border-red-400'
    return (
        <button onClick={onClick}
                className={`px-3 py-1 text-xs rounded transition-all ${
                    isActive ? activeClass : `bg-[var(--color-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] ${hoverClass}`
                }`}>
            {label}
        </button>
    )
}

export function EditableCell({ value, onChange }) {
    return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
               className="bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] transition-colors" />
    )
}

export function NumCell({ value, onChange, align = 'center' }) {
    return (
        <td className={`py-1.5 px-1`}>
            <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
                   className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs text-[var(--color-text)] tabular-nums text-${align} transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
        </td>
    )
}

export function FieldSelect({ label, value, onChange, options, loading, color }) {
    return (
        <div>
            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)} disabled={loading}
                    className="w-full rounded px-2 py-1.5 text-xs disabled:opacity-50 border"
                    style={{
                        backgroundColor: 'var(--color-card, #1e1e2e)',
                        color: 'var(--color-text, #e0e0e0)',
                        borderColor: color || 'var(--color-border, #333)',
                        borderLeftColor: color || 'var(--color-border, #333)',
                        borderLeftWidth: color ? '3px' : '1px',
                    }}>
                <option value="" style={{ backgroundColor: '#1e1e2e', color: '#999' }}>— Select —</option>
                {options.map(o => (
                    <option key={o.value} value={o.value} style={{ backgroundColor: '#1e1e2e', color: '#e0e0e0' }}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

export function FieldInput({ label, type, value, onChange }) {
    return (
        <div>
            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)}
                   className="w-full rounded px-2 py-1.5 text-xs border"
                   style={{
                       backgroundColor: 'var(--color-card, #1e1e2e)',
                       color: 'var(--color-text, #e0e0e0)',
                       borderColor: 'var(--color-border, #333)',
                       colorScheme: 'dark',
                   }} />
        </div>
    )
}

export function ErrorBanner({ message, className = '' }) {
    return (
        <div className={`px-4 py-2 bg-red-500/10 text-red-400 text-xs flex items-start gap-2 ${className}`}>
            <span className="shrink-0">{'\u26a0'}</span>
            <span>{message}</span>
        </div>
    )
}
