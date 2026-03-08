import { Link } from 'react-router-dom'
import { Bell, Camera, ChevronRight } from 'lucide-react'

const ReporterNotification = ({ readyCount, readyMatches }) => {
    return (
        <section className="px-4 -mt-6 mb-2 relative z-20">
            <div className="max-w-4xl mx-auto">
                <Link
                    to="/admin/matchreport"
                    className="group block rounded-xl border border-(--color-accent)/30 overflow-hidden transition-all duration-300 hover:border-(--color-accent)/50 hover:shadow-lg hover:shadow-(--color-accent)/10 hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, rgba(248,197,106,0.08), rgba(248,197,106,0.02))' }}
                >
                    <div className="px-5 py-4 flex items-center gap-4">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-(--color-accent)/15 flex items-center justify-center">
                                <Bell className="w-5 h-5 text-(--color-accent)" />
                            </div>
                            <span
                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                                style={{ background: '#f8c56a', color: '#0a0f1a' }}
                            >
                                {readyCount}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-(--color-text) mb-0.5">
                                {readyCount} match{readyCount !== 1 ? 'es' : ''} ready to report
                            </h3>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {readyMatches.slice(0, 3).map(m => (
                                    <span key={m.id} className="inline-flex items-center gap-1.5 text-xs text-(--color-text-secondary)">
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.team1_color || 'var(--color-accent)' }} />
                                        {m.team1_name} vs {m.team2_name}
                                        <Camera className="w-3 h-3 text-(--color-text-secondary)/50" />
                                        <span className="text-(--color-text-secondary)/60">{m.screenshot_count}</span>
                                    </span>
                                ))}
                                {readyMatches.length > 3 && (
                                    <span className="text-xs text-(--color-text-secondary)/50">
                                        +{readyMatches.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-(--color-accent) group-hover:gap-2 transition-all">
                            <span className="hidden sm:inline">Report Now</span>
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </Link>
            </div>
        </section>
    )
}

export default ReporterNotification
