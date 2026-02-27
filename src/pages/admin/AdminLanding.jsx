// src/pages/admin/AdminLanding.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'
import FeaturedStreamAdmin from '../../components/admin/FeaturedStreamAdmin'

const tools = [
    {
        title: 'Match Report',
        description: 'Add new match results from screenshots. Paste match text and DETAILS tab screenshots, then let AI extract the scoreboard data for review and submission.',
        path: '/admin/matchreport',
        permission: 'match_report',
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
        permission: 'roster_manage',
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
        permission: 'player_manage',
        globalOnly: true,
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
        permission: ['match_manage', 'match_manage_own'],
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
        title: 'Schedule Manager',
        description: 'Create and manage match schedules. Set dates, weeks, and matchups for upcoming games. Track match status from scheduled through completion.',
        path: '/admin/schedule',
        permission: 'match_schedule',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
        ),
        accent: 'from-cyan-500/20 to-cyan-600/5',
        border: 'border-cyan-500/20 hover:border-cyan-500/40',
        iconColor: 'text-cyan-400',
        btnClass: 'bg-cyan-600 hover:bg-cyan-700',
    },
    {
        title: 'Discord Configuration',
        description: 'Configure Discord channel connections, map team roles, and set up webhook notifications for automatic screenshot collection and matching.',
        path: '/admin/discord',
        permission: 'match_report',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
        ),
        accent: 'from-purple-500/20 to-purple-600/5',
        border: 'border-purple-500/20 hover:border-purple-500/40',
        iconColor: 'text-purple-400',
        btnClass: 'bg-purple-600 hover:bg-purple-700',
    },
    {
        title: 'Discord Review',
        description: 'Review auto-matched screenshots, manage unmatched items, monitor player Discord sync status, and view recent Discord activity.',
        path: '/admin/discord-review',
        permission: 'match_report',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
        ),
        accent: 'from-teal-500/20 to-teal-600/5',
        border: 'border-teal-500/20 hover:border-teal-500/40',
        iconColor: 'text-teal-400',
        btnClass: 'bg-teal-600 hover:bg-teal-700',
    },
    {
        title: 'Discord Roster Sync',
        description: 'Map Discord roles to teams and sync rosters based on role membership. Automatically promote or demote players based on who has the team Discord role.',
        path: '/admin/roster-sync',
        permission: 'roster_manage',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M4.031 9.865" />
            </svg>
        ),
        accent: 'from-emerald-500/20 to-emerald-600/5',
        border: 'border-emerald-500/20 hover:border-emerald-500/40',
        iconColor: 'text-emerald-400',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
        title: 'Banned Content',
        description: 'Configure Discord channels for league ban lists. Sync gods, items, relics, and other banned content from Discord messages. Auto-syncs hourly.',
        path: '/admin/banned-content',
        permission: 'league_manage',
        globalOnly: true,
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
        ),
        accent: 'from-red-500/20 to-red-600/5',
        border: 'border-red-500/20 hover:border-red-500/40',
        iconColor: 'text-red-400',
        btnClass: 'bg-red-600 hover:bg-red-700',
    },
    {
        title: 'Challenge Manager',
        description: 'Create and manage Passion challenges. Define objectives like "Deal 50,000 damage" or "Log in 7 days in a row" that users complete to earn bonus Passion.',
        path: '/admin/challenges',
        permission: 'league_manage',
        globalOnly: true,
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.77.896m0 0a6.023 6.023 0 0 1-2.77-.896" />
            </svg>
        ),
        accent: 'from-yellow-500/20 to-yellow-600/5',
        border: 'border-yellow-500/20 hover:border-yellow-500/40',
        iconColor: 'text-yellow-400',
        btnClass: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
        title: 'League Manager',
        description: 'Manage the league hierarchy — create and edit leagues, divisions, and seasons. Toggle season active status and configure the structure of your competition.',
        path: '/admin/leagues',
        permission: 'league_manage',
        globalOnly: true,
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
        title: 'Team Manager',
        description: 'Create, edit, and delete teams across seasons. Upload team icons, manage team colors and slugs, and copy teams between seasons.',
        path: '/admin/teams',
        permission: 'team_manage',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
        ),
        accent: 'from-emerald-500/20 to-emerald-600/5',
        border: 'border-emerald-500/20 hover:border-emerald-500/40',
        iconColor: 'text-emerald-400',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
        title: 'League Staff',
        description: 'Add staff members to help manage your leagues. Staff receive management permissions scoped to the leagues you assign them to.',
        path: '/admin/leaguestaff',
        permission: 'league_staff_manage',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
        ),
        accent: 'from-amber-500/20 to-amber-600/5',
        border: 'border-amber-500/20 hover:border-amber-500/40',
        iconColor: 'text-amber-400',
        btnClass: 'bg-amber-600 hover:bg-amber-700',
    },
    {
        title: 'User Manager',
        description: 'Manage Discord-authenticated users. Promote or demote admins, and manually link or unlink player profiles.',
        path: '/admin/users',
        permission: 'user_manage',
        globalOnly: true,
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
        permission: 'claim_manage',
        globalOnly: true,
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
    {
        title: 'Data Reports',
        description: 'Review user-reported data issues on matches. Resolve or dismiss reports for wrong scores, incorrect stats, wrong gods, and missing data.',
        path: '/admin/data-reports',
        permission: 'league_manage',
        globalOnly: true,
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
        ),
        accent: 'from-orange-500/20 to-orange-600/5',
        border: 'border-orange-500/20 hover:border-orange-500/40',
        iconColor: 'text-orange-400',
        btnClass: 'bg-orange-600 hover:bg-orange-700',
    },
    {
        title: 'Permission Manager',
        description: 'Create custom roles, assign granular permissions, and control who can access what. Scope permissions by league for fine-grained access control.',
        path: '/admin/permissions',
        permission: 'permission_manage',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
        ),
        accent: 'from-yellow-500/20 to-yellow-600/5',
        border: 'border-yellow-500/20 hover:border-yellow-500/40',
        iconColor: 'text-yellow-400',
        btnClass: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
        title: 'Feedback',
        description: 'View and manage user-submitted feedback. See bug reports, feature requests, and general feedback from your community.',
        path: '/admin/feedback',
        permission: 'feedback_manage',
        globalOnly: true,
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
        ),
        accent: 'from-pink-500/20 to-pink-600/5',
        border: 'border-pink-500/20 hover:border-pink-500/40',
        iconColor: 'text-pink-400',
        btnClass: 'bg-pink-600 hover:bg-pink-700',
    },
    {
        title: 'Arcade NPCs',
        description: 'Create and manage NPC characters for the Arcade hub. Upload sprites, set names and quotes, and configure spawn positions.',
        path: '/admin/arcade-npcs',
        permission: 'league_manage',
        globalOnly: true,
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
        ),
        accent: 'from-cyan-500/20 to-cyan-600/5',
        border: 'border-cyan-500/20 hover:border-cyan-500/40',
        iconColor: 'text-cyan-400',
        btnClass: 'bg-cyan-600 hover:bg-cyan-700',
    },
    {
        title: 'Audit Log',
        description: 'View a chronological log of all admin actions. Filter by user, endpoint, action, and date range to track changes and investigate issues.',
        path: '/admin/auditlog',
        permission: 'audit_log_view',
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
        ),
        accent: 'from-orange-500/20 to-orange-600/5',
        border: 'border-orange-500/20 hover:border-orange-500/40',
        iconColor: 'text-orange-400',
        btnClass: 'bg-orange-600 hover:bg-orange-700',
    },
]

export default function AdminLanding() {
    const { permissions } = useAuth()
    const isOwner = permissions.global.includes('permission_manage')

    // Check if user has permission globally or for any league
    const hasPermissionAnywhere = (key, globalOnly = false) => {
        if (!key) return true
        const keys = Array.isArray(key) ? key : [key]
        return keys.some(k => {
            if (permissions.global.includes(k)) return true
            if (globalOnly) return false
            return Object.values(permissions.byLeague).some(perms => perms.includes(k))
        })
    }

    const visibleTools = tools.filter(tool => hasPermissionAnywhere(tool.permission, tool.globalOnly))

    return (
        <div className="max-w-4xl mx-auto pb-8 px-4">
            <PageTitle title="Admin" noindex />

            {/* Tool cards */}
            <div className="grid gap-4 sm:gap-6">
                {visibleTools.map(tool => (
                    <div
                        key={tool.path}
                        className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${tool.accent} ${tool.border} transition-colors`}
                        style={{ backgroundColor: 'var(--color-card, var(--color-secondary))' }}
                    >
                        <div className="p-4 sm:p-6 flex items-start gap-3 sm:gap-5">
                            {/* Icon */}
                            <div className={`shrink-0 mt-0.5 ${tool.iconColor}`}>
                                {tool.icon}
                            </div>

                            {/* Content + Actions */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="font-heading text-lg sm:text-xl font-semibold text-[var(--color-text)] mb-1">
                                        {tool.title}
                                    </h2>
                                    {/* Desktop actions */}
                                    <div className="hidden sm:flex shrink-0 items-center gap-2">
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
                                <p className="hidden sm:block text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                    {tool.description}
                                </p>
                                {/* Mobile actions */}
                                <div className="flex sm:hidden items-center gap-2 mt-2">
                                    <Link
                                        to={tool.path}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${tool.btnClass} transition-colors`}
                                    >
                                        Open
                                    </Link>
                                    <Link
                                        to={`${tool.path}?help=on`}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
                                    >
                                        Tutorial
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Featured Stream config */}
            {hasPermissionAnywhere('league_manage', true) && (
                <div className="mt-8">
                    <FeaturedStreamAdmin />
                </div>
            )}

            {/* Forge Config — visible to global admins */}
            {hasPermissionAnywhere('league_manage', true) && (
                <div className="mt-8">
                    <Link
                        to="/admin/forge-config"
                        className="flex items-center gap-3 px-5 py-4 rounded-xl bg-(--color-secondary) border border-orange-500/20 hover:border-orange-500/40 transition-colors"
                    >
                        <svg className="w-5 h-5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-orange-400">Forge Config</div>
                            <div className="text-xs text-(--color-text-secondary)">
                                Tune performance formula & review pending updates
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}

            {/* Owner-only tools */}
            {isOwner && (
                <div className="mt-12 border-t border-white/10 pt-8 space-y-3">
                    <Link
                        to="/admin/forge-admin"
                        className="flex items-center gap-3 px-5 py-4 rounded-xl bg-(--color-secondary) border border-orange-500/20 hover:border-orange-500/40 transition-colors"
                    >
                        <svg className="w-5 h-5 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
                        </svg>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-orange-400">Forge Admin</div>
                            <div className="text-xs text-(--color-text-secondary)">
                                View all holdings and transaction activity (Owner only)
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                    <Link
                        to="/admin/debug"
                        className="flex items-center gap-3 px-5 py-4 rounded-xl bg-(--color-secondary) border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                        <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
                        </svg>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-red-400">Debug Tools</div>
                            <div className="text-xs text-(--color-text-secondary)">
                                Test animations, view passion state, reset data (Owner only)
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-(--color-text-secondary)/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}
        </div>
    )
}
