export default function ReliabilityBar({ score }) {
    if (score === null || score === undefined) return null
    const color = score >= 90 ? '#2d8212' : score >= 70 ? '#c08030' : '#cc0000'
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={`Reliability: ${score}%`}>
            <span className="xp-text" style={{ fontSize: 9, color: '#888' }}>Reliability</span>
            <div style={{ width: 44, height: 6, background: '#ddd', border: '1px solid #bbb', borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${score}%`, height: '100%', background: color }} />
            </div>
            <span className="xp-text" style={{ fontSize: 9, color, fontWeight: 700 }}>{score}%</span>
        </div>
    )
}
