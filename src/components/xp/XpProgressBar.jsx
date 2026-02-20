export default function XpProgressBar() {
    return (
        <div className="flex flex-col items-center gap-3 py-12">
            <div className="xp-progress">
                <div className="xp-progress-bar" />
            </div>
            <span className="xp-text" style={{ fontSize: 11 }}>Loading scrims...</span>
        </div>
    )
}
