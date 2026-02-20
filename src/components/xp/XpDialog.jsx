export default function XpDialog({ title, icon, children, onClose }) {
    return (
        <div className="xp-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className="xp-window xp-dialog">
                <div className="xp-title-bar">
                    <div className="flex items-center gap-1.5">
                        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
                        <span className="xp-title-text" style={{ fontSize: 11 }}>{title}</span>
                    </div>
                    <button type="button" className="xp-title-btn xp-tbtn-x" onClick={onClose}>&times;</button>
                </div>
                <div className="xp-window-body" style={{ padding: 12 }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
