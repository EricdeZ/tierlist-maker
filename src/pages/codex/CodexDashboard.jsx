import { Link } from 'react-router-dom'
import PageTitle from '../../components/PageTitle'
import { Package, ImagePlus, Swords, Puzzle } from 'lucide-react'

export default function CodexDashboard() {
    return (
        <div className="max-w-4xl mx-auto pb-8 px-4">
            <PageTitle title="Codex" noindex />

            <div className="mb-6">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-(--color-text) mb-1">Codex Dashboard</h1>
                <p className="text-(--color-text-secondary) text-sm">Manage game data and content for the Codex.</p>
            </div>

            <div className="grid gap-4">
                <Link
                    to="/codex/items"
                    className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-amber-500/20 to-amber-600/5 border-amber-500/20 hover:border-amber-500/40 transition-colors"
                    style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                >
                    <div className="p-4 sm:p-6 flex items-start gap-3 sm:gap-5">
                        <div className="shrink-0 mt-0.5 text-amber-400">
                            <Package className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-heading text-lg sm:text-xl font-semibold text-(--color-text) mb-1">Items</h2>
                            <p className="hidden sm:block text-sm text-(--color-text-secondary) leading-relaxed">
                                Manage SMITE items with custom fields and tags. Define item attributes, categorize with tags, and build the full item database.
                            </p>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center">
                            <span className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors">
                                Open
                            </span>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/codex/gods"
                    className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                    style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                >
                    <div className="p-4 sm:p-6 flex items-start gap-3 sm:gap-5">
                        <div className="shrink-0 mt-0.5 text-cyan-400">
                            <Swords className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-heading text-lg sm:text-xl font-semibold text-(--color-text) mb-1">Gods</h2>
                            <p className="hidden sm:block text-sm text-(--color-text-secondary) leading-relaxed">
                                Manage SMITE gods with custom fields and tags. Define god attributes, categorize with tags, and link to the god database.
                            </p>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center">
                            <span className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors">
                                Open
                            </span>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/codex/wordle"
                    className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                    style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                >
                    <div className="p-4 sm:p-6 flex items-start gap-3 sm:gap-5">
                        <div className="shrink-0 mt-0.5 text-emerald-400">
                            <Puzzle className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-heading text-lg sm:text-xl font-semibold text-(--color-text) mb-1">Wordle Categories</h2>
                            <p className="hidden sm:block text-sm text-(--color-text-secondary) leading-relaxed">
                                Manage Wordle game categories. Link categories to god tags and set difficulty levels.
                            </p>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center">
                            <span className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                                Open
                            </span>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/codex/images"
                    className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-violet-500/20 to-violet-600/5 border-violet-500/20 hover:border-violet-500/40 transition-colors"
                    style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                >
                    <div className="p-4 sm:p-6 flex items-start gap-3 sm:gap-5">
                        <div className="shrink-0 mt-0.5 text-violet-400">
                            <ImagePlus className="w-7 h-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-heading text-lg sm:text-xl font-semibold text-(--color-text) mb-1">Images</h2>
                            <p className="hidden sm:block text-sm text-(--color-text-secondary) leading-relaxed">
                                Upload and organize images for the Codex. Categorize uploads and use them as icons for items, fields, and other content.
                            </p>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center">
                            <span className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors">
                                Open
                            </span>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
