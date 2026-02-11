// src/pages/admin/AdminLanding.jsx
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import smiteLogo from '../../assets/smite2.png'
import PageTitle from '../../components/PageTitle'

const tools = [
    {
        title: 'Match Report',
        description: 'Add new match results from screenshots. Paste match text and DETAILS tab screenshots, then let AI extract the scoreboard data for review and submission.',
        path: '/admin/matchreport',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
        ),
        accent: 'from-blue-500/20 to-blue-600/5',
        border: 'border-blue-500/20 hover:border-blue-500/40',
        iconColor: 'text-blue-400',
        btnClass: 'bg-blue-600 hover:bg-blue-700',
    },
    {
        title: 'Roster Manager',
        description: 'Manage team rosters with drag-and-drop. Transfer players between teams, change roles, rename players, manage aliases, and merge duplicates.',
        path: '/admin/rosters',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
        ),
        accent: 'from-emerald-500/20 to-emerald-600/5',
        border: 'border-emerald-500/20 hover:border-emerald-500/40',
        iconColor: 'text-emerald-400',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
        title: 'Player Manager',
        description: 'View all players across leagues and seasons. Edit Discord names and tracker links, bulk-enroll players into new seasons, export data to CSV, and track season history.',
        path: '/admin/players',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
        ),
        accent: 'from-violet-500/20 to-violet-600/5',
        border: 'border-violet-500/20 hover:border-violet-500/40',
        iconColor: 'text-violet-400',
        btnClass: 'bg-violet-600 hover:bg-violet-700',
    },
    {
        title: 'Match Manager',
        description: 'Edit or delete existing match data. Update dates, weeks, teams, game results, and individual player stats for any previously submitted match.',
        path: '/admin/matches',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
        ),
        accent: 'from-amber-500/20 to-amber-600/5',
        border: 'border-amber-500/20 hover:border-amber-500/40',
        iconColor: 'text-amber-400',
        btnClass: 'bg-amber-600 hover:bg-amber-700',
    },
    {
        title: 'League Manager',
        description: 'Manage the league hierarchy — create and edit leagues, divisions, and seasons. Toggle season active status, manage teams, and configure the structure of your competition.',
        path: '/admin/leagues',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
        ),
        accent: 'from-rose-500/20 to-rose-600/5',
        border: 'border-rose-500/20 hover:border-rose-500/40',
        iconColor: 'text-rose-400',
        btnClass: 'bg-rose-600 hover:bg-rose-700',
    },
    {
        title: 'User Manager',
        description: 'Manage Discord-authenticated users. Promote or demote admins, and manually link or unlink player profiles.',
        path: '/admin/users',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
        ),
        accent: 'from-indigo-500/20 to-indigo-600/5',
        border: 'border-indigo-500/20 hover:border-indigo-500/40',
        iconColor: 'text-indigo-400',
        btnClass: 'bg-indigo-600 hover:bg-indigo-700',
    },
    {
        title: 'Claim Requests',
        description: 'Review and resolve player profile claim requests. Approve or deny users who want to link their Discord account to a player profile.',
        path: '/admin/claims',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
        ),
        accent: 'from-teal-500/20 to-teal-600/5',
        border: 'border-teal-500/20 hover:border-teal-500/40',
        iconColor: 'text-teal-400',
        btnClass: 'bg-teal-600 hover:bg-teal-700',
    },
]

export default function AdminLanding() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <PageTitle title="Admin" noindex />
            {/* Header */}
            <div className="mb-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src={smiteLogo} alt="SMITE 2" className="h-12 w-auto" />
                    <div>
                        <h1 className="font-heading text-3xl font-bold text-[var(--color-text)]">
                            SMITE 2 Comp Admin Dashboard
                        </h1>
                        <p className="text-[var(--color-text-secondary)] mt-1">
                            Manage matches, rosters, and league data.
                        </p>
                    </div>
                </div>
                <Link
                    to="/"
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors"
                    title="Home"
                >
                    <Home className="w-5 h-5" />
                </Link>
            </div>

            {/* Tool cards */}
            <div className="grid gap-6">
                {tools.map(tool => (
                    <div
                        key={tool.path}
                        className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${tool.accent} ${tool.border} transition-colors`}
                        style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                    >
                        <div className="p-6 flex items-start gap-5">
                            {/* Icon */}
                            <div className={`shrink-0 mt-0.5 ${tool.iconColor}`}>
                                {tool.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h2 className="font-heading text-xl font-semibold text-[var(--color-text)] mb-1">
                                    {tool.title}
                                </h2>
                                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                    {tool.description}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="shrink-0 flex items-center gap-2">
                                <Link
                                    to={tool.path}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${tool.btnClass} transition-colors`}
                                >
                                    Open
                                </Link>
                                <Link
                                    to={`${tool.path}?help=on`}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
                                >
                                    Tutorial Mode
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
