import PageTitle from '../../components/PageTitle'

export default function CodexDashboard() {
    return (
        <div className="max-w-4xl mx-auto pb-8 px-4">
            <PageTitle title="Codex" noindex />

            <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
                    <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-(--color-text) mb-3">
                    Codex Dashboard
                </h1>
                <p className="text-(--color-text-secondary) text-sm sm:text-base max-w-md mx-auto">
                    The Codex is under construction. Content editing tools will appear here soon.
                </p>
            </div>
        </div>
    )
}
