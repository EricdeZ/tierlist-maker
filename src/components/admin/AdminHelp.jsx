// src/components/admin/AdminHelp.jsx
import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

/**
 * Renders a help/tutorial banner at the top of admin pages when ?help=on is in the URL.
 * Pass `sections` as an array of { title, content } objects.
 */
export default function AdminHelp({ sections, pageTitle }) {
    const [searchParams, setSearchParams] = useSearchParams()
    const [collapsed, setCollapsed] = useState(false)

    if (searchParams.get('help') !== 'on') return null

    const dismiss = () => {
        const next = new URLSearchParams(searchParams)
        next.delete('help')
        setSearchParams(next, { replace: true })
    }

    return (
        <div className="mb-6 rounded-xl border border-[var(--color-accent)]/30 bg-gradient-to-r from-[var(--color-accent)]/5 to-transparent overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-[var(--color-accent)]/10 border-b border-[var(--color-accent)]/20">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    <span className="font-heading font-semibold text-[var(--color-accent)]">
                        {pageTitle} — Tutorial
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        className="text-xs px-2 py-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                    >
                        {collapsed ? 'Expand' : 'Collapse'}
                    </button>
                    <button
                        onClick={dismiss}
                        className="text-xs px-2 py-1 rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-white/5 transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>

            {/* Content */}
            {!collapsed && (
                <div className="px-5 py-4 space-y-4">
                    {sections.map((section, i) => (
                        <div key={i}>
                            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1.5 flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-bold">
                                    {i + 1}
                                </span>
                                {section.title}
                            </h3>
                            <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed ml-6.5 space-y-1">
                                {section.content}
                            </div>
                        </div>
                    ))}
                    <div className="pt-2 border-t border-white/5">
                        <Link
                            to="/admin"
                            className="text-xs text-[var(--color-accent)] hover:underline"
                        >
                            ← Back to Admin Dashboard
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Help content for Match Report ───
export function MatchReportHelp() {
    return (
        <AdminHelp
            pageTitle="Match Report"
            sections={[
                {
                    title: 'Select a Season',
                    content: (
                        <p>
                            Start by choosing the correct season from the dropdown at the top.
                            All match data will be linked to this season. Your selection is remembered between visits.
                        </p>
                    ),
                },
                {
                    title: 'Create a New Match Report',
                    content: (
                        <p>
                            Click <strong>"+ New Match"</strong> to create a blank report card.
                            Each report represents one full match set (e.g. a best-of-3).
                        </p>
                    ),
                },
                {
                    title: 'Paste Match Context',
                    content: (
                        <p>
                            In the text box, paste any context about the match — the two team names
                            and any player notes. This helps the AI match players to their roster entries.
                        </p>
                    ),
                },
                {
                    title: 'Upload ALL Games at Once',
                    content: (
                        <>
                            <p>
                                <strong className="text-[var(--color-accent)]">Important:</strong> Upload screenshots for <strong>every game in the set</strong> together
                                in a single report. For example, a best-of-3 needs 2 or 3 screenshots — one per game.
                                Do <strong>not</strong> create separate reports for each game.
                            </p>
                            <p className="mt-1">
                                Drag and drop (or click to upload) screenshots of the <strong>DETAILS tab</strong> from
                                the SMITE 2 match lobby. You can also paste from clipboard with <strong>Ctrl+V</strong>.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'What the AI Extracts',
                    content: (
                        <>
                            <p>The AI reads each screenshot and extracts:</p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li><strong>Player names</strong> — auto-matched to your season roster</li>
                                <li><strong>God names</strong> — the god each player picked (verify these!)</li>
                                <li><strong>Stats</strong> — Kills, Deaths, Assists, Damage, Mitigated</li>
                            </ul>
                            <p className="mt-2">
                                <strong className="text-[var(--color-accent)]">Not extracted automatically:</strong> The AI does <strong>not</strong> determine
                                the date, week number, or game winners. You must enter these yourself during review.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'Review — Step 1: Set Date, Week & Winners',
                    content: (
                        <>
                            <p>
                                After extraction, the report enters <strong>Review</strong> status. Start by filling in the fields
                                that the AI cannot extract:
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li><strong>Date</strong> — when the match was played</li>
                                <li><strong>Week</strong> — the league week number</li>
                                <li><strong>Winner of each game</strong> — click to select which team won</li>
                            </ul>
                        </>
                    ),
                },
                {
                    title: 'Review — Step 2: Verify Gods',
                    content: (
                        <p>
                            The AI can misread god names from screenshots. <strong>Check every god pick</strong> for
                            each player in each game. Use the autocomplete dropdown to correct any mistakes — start
                            typing the god name to search.
                        </p>
                    ),
                },
                {
                    title: 'Review — Step 3: Handle Unknown Players (Subs & Aliases)',
                    content: (
                        <>
                            <p>
                                This is the most important part of reviewing. Players that the AI couldn't match
                                to the roster will be highlighted. There are two common cases:
                            </p>
                            <p className="mt-2">
                                <strong>Aliases (name changes / smurfs):</strong> If you recognize the in-game name as
                                an existing roster player, click the <strong>"Link Alias"</strong> button. Search for the
                                correct player and confirm. This saves the alternate name permanently — future matches
                                will auto-match it.
                            </p>
                            <p className="mt-1">
                                <strong>Subs (non-roster players):</strong> If the player is a substitute who isn't on
                                any roster, click the player name to search the <strong>global player list</strong>.
                                If they don't exist yet, they can be created from the Roster Manager.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'Review — Step 4: Check Stats',
                    content: (
                        <p>
                            Glance over the K/D/A, damage, and mitigated numbers. The AI is usually accurate with
                            stats, but occasionally misreads digits. You can click any number to edit it inline.
                        </p>
                    ),
                },
                {
                    title: 'Submit',
                    content: (
                        <p>
                            Once everything looks good, check the box on each report and click <strong>"Submit Selected"</strong> to
                            send match data to the database. Successfully submitted matches turn green. You can also submit
                            individually with the submit button on each card.
                        </p>
                    ),
                },
            ]}
        />
    )
}

// ─── Help content for Roster Manager ───
export function RosterManagerHelp() {
    return (
        <AdminHelp
            pageTitle="Roster Manager"
            sections={[
                {
                    title: 'Select a Season',
                    content: (
                        <p>
                            Choose the season you want to manage rosters for. Each season has its own set of team rosters.
                        </p>
                    ),
                },
                {
                    title: 'Transfer Players (Drag & Drop)',
                    content: (
                        <>
                            <p>
                                <strong>Move a player:</strong> Drag a player from one team card and drop them onto another team card
                                to transfer them.
                            </p>
                            <p className="mt-1">
                                <strong>Swap players:</strong> Drag a player and drop them directly onto another player to swap
                                the two between their teams.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'Change Roles',
                    content: (
                        <p>
                            Click on a player's <strong>role badge</strong> (Solo, Jungle, Mid, Support, ADC, Sub, Fill) to open
                            a dropdown and assign a different role. The change is staged locally until you save.
                        </p>
                    ),
                },
                {
                    title: 'Rename a Player',
                    content: (
                        <p>
                            Open the actions menu (three dots) on a player and select <strong>"Rename"</strong>.
                            You can optionally save the old name as an alias so historical match data still links correctly.
                        </p>
                    ),
                },
                {
                    title: 'Manage Aliases',
                    content: (
                        <p>
                            Aliases are alternate names for a player (old IGNs, smurf accounts). Open the actions menu
                            and select <strong>"Aliases"</strong> to add or remove them. When match reports are processed,
                            aliases are checked automatically to match players to their roster entry.
                        </p>
                    ),
                },
                {
                    title: 'Merge Duplicate Players',
                    content: (
                        <p>
                            If the same person exists as two separate player entries, click <strong>"Merge Players"</strong> in
                            the header. Select the source (duplicate) and target (keeper) — all stats and history from the
                            source will be merged into the target, and the duplicate is removed.
                        </p>
                    ),
                },
                {
                    title: 'Add & Drop Players',
                    content: (
                        <>
                            <p>
                                Click <strong>"+ Add Player"</strong> on a team card to add someone — search for an existing
                                player or create a new one.
                            </p>
                            <p className="mt-1">
                                To remove a player from the roster, use the actions menu and select <strong>"Drop"</strong>.
                                This deactivates them from the team but preserves their historical data.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'Save Changes',
                    content: (
                        <p>
                            All changes are <strong>staged locally</strong> until you click <strong>"Save All"</strong> in the
                            bottom bar. This lets you make multiple changes and review them before committing. Click
                            <strong> "Discard"</strong> to undo all pending changes.
                        </p>
                    ),
                },
            ]}
        />
    )
}

// ─── Help content for Player Manager ───
export function PlayerManagerHelp() {
    return (
        <AdminHelp
            pageTitle="Player Manager"
            sections={[
                {
                    title: 'Browse & Search Players',
                    content: (
                        <p>
                            The table shows every player in the system across all leagues and seasons.
                            Use the <strong>search bar</strong> to find players by name, Discord username, or alias.
                            Use the <strong>filter dropdowns</strong> to narrow by season, team, or role. Click a column header to sort.
                        </p>
                    ),
                },
                {
                    title: 'Player Details (Expand Row)',
                    content: (
                        <p>
                            Click the arrow next to any player name to expand their row. You'll see their
                            <strong> Discord name</strong>, <strong>Tracker.gg link</strong>, <strong>aliases</strong>,
                            and full <strong>season history</strong> — every team and season they've been part of,
                            with games played per roster entry.
                        </p>
                    ),
                },
                {
                    title: 'Edit Discord & Tracker Info',
                    content: (
                        <p>
                            Click <strong>"Edit"</strong> on any player row to update their Discord username or
                            Tracker.gg profile URL. This info is stored globally and shared across all seasons.
                        </p>
                    ),
                },
                {
                    title: 'Bulk Enroll Players in a New Season',
                    content: (
                        <>
                            <p>
                                Use the <strong>checkboxes</strong> to select multiple players, then click
                                <strong> "Enroll in Season"</strong>. Choose a target season, team, and default role.
                                All selected players will be added to that team's roster.
                            </p>
                            <p className="mt-1">
                                <strong>Tip:</strong> Filter by a previous season's team first, select all,
                                then enroll them into the new season — this is the fastest way to carry rosters forward.
                            </p>
                        </>
                    ),
                },
                {
                    title: 'Free Agents',
                    content: (
                        <p>
                            Players tagged <strong>"FA"</strong> (Free Agent) are not on any active season roster.
                            Use the <strong>"Free Agents"</strong> filter to find them quickly. These are players
                            who played in a previous season but haven't been enrolled in the current one yet.
                        </p>
                    ),
                },
                {
                    title: 'Export to CSV',
                    content: (
                        <p>
                            Click the <strong>"CSV"</strong> button to download the currently filtered player list
                            as a spreadsheet. Includes name, Discord, tracker URL, team, role, season, games played, and aliases.
                        </p>
                    ),
                },
            ]}
        />
    )
}

// ─── Help content for Match Manager ───
export function MatchManagerHelp() {
    return (
        <AdminHelp
            pageTitle="Match Manager"
            sections={[
                {
                    title: 'Select a Season',
                    content: (
                        <p>
                            Choose a season to load all matches submitted for that season. Matches are listed with
                            their date, week, and team matchup.
                        </p>
                    ),
                },
                {
                    title: 'Expand a Match',
                    content: (
                        <p>
                            Click on any match row to expand it and see the full detail — each game in the set,
                            the winner, and all player stats. This loads the full match data from the database.
                        </p>
                    ),
                },
                {
                    title: 'Edit Match Info',
                    content: (
                        <p>
                            In the expanded view, you can change the <strong>date</strong>, <strong>week number</strong>,
                            and <strong>team assignments</strong>. Changes are saved per-field when you click the save button.
                        </p>
                    ),
                },
                {
                    title: 'Edit Game Stats',
                    content: (
                        <>
                            <p>
                                Switch between games using the game tabs. For each game you can change:
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li><strong>Winner</strong> — toggle between Team 1 and Team 2</li>
                                <li><strong>God picks</strong> — use the autocomplete to change a player's god</li>
                                <li><strong>Stats</strong> — edit Kills, Deaths, Assists, Damage, Mitigated directly</li>
                                <li><strong>Players</strong> — click a player name to swap them for someone else</li>
                            </ul>
                        </>
                    ),
                },
                {
                    title: 'Delete a Game or Match',
                    content: (
                        <p>
                            Use the <strong>"Delete Game"</strong> button to remove a single game from a match, or
                            <strong> "Delete Match"</strong> to remove the entire match and all its games. Both actions
                            require confirmation. Deletions are permanent.
                        </p>
                    ),
                },
            ]}
        />
    )
}
