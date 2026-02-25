export default {
    title: 'Reporting a Match',
    baseUrl: 'http://localhost:5173',

    steps: [
        // ── INTRO ──
        {
            narrate: 'The Admin Dashboard is where you report match results. There are several ways to get data in, from fully automated to completely manual.',
            action: 'navigate',
            url: 'http://localhost:5173/admin/matchreport',
            pauseAfter: 600,
        },
        {
            narrate: 'Start by selecting your season.',
            action: 'select',
            selector: 'select',
            value: 'Upper',
            highlight: true,
            pauseAfter: 400,
        },

        // ── DISCORD PANEL ──
        {
            narrate: 'If your league uses Discord, screenshots from match channels are collected automatically. Open the Discord Panel to see them.',
            action: 'click',
            selector: 'button:has-text("Discord Panel")',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'Hit Get Images to poll for new screenshots.',
            action: 'click',
            selector: 'button:has-text("Get Images")',
            highlight: true,
            pauseAfter: 1200,
        },
        {
            narrate: 'Select the screenshots you need and load them into a report. The system also auto-matches images to your scheduled games.',
            action: 'wait',
            duration: 500,
            pauseAfter: 600,
        },
        {
            // Close Discord Panel
            action: 'click',
            selector: 'button:has-text("Discord Panel")',
            pauseAfter: 300,
        },

        // ── READY TO REPORT ──
        {
            narrate: 'Auto-matched screenshots appear in Ready to Report, already linked to the right scheduled game.',
            action: 'highlight',
            selector: '#ready-to-report',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'Click Report Match to start with pre-loaded images and team data.',
            action: 'click',
            selector: 'button:has-text("Report Match")',
            highlight: true,
            pauseAfter: 800,
        },

        // ── IMAGE SELECTION + EXTRACTION ──
        {
            narrate: 'Select your details screenshots and extract. The AI reads every scoreboard.',
            action: 'click',
            selector: 'button:has-text("Select All")',
            pauseAfter: 400,
        },
        {
            action: 'click',
            selector: 'button:has-text("Extract")',
            pauseAfter: 300,
        },
        {
            narrate: 'This can take up to thirty seconds. The AI is reading player names, gods, roles, stats, and determining the winner from each game.',
            action: 'waitFor',
            selector: 'button:has-text("+ Game")',
            timeout: 45000,
            pauseAfter: 600,
        },

        // ── VIEW SCREENSHOTS ──
        {
            narrate: 'Toggle View Screenshots to see the original scoreboards alongside the extracted data.',
            action: 'click',
            selector: 'button:has-text("View Screenshots")',
            highlight: true,
            pauseAfter: 800,
        },
        {
            // Hide screenshots — force click past the floating image viewer overlay
            action: 'click',
            selector: 'button:has-text("Hide Screenshots")',
            force: true,
            pauseAfter: 300,
        },

        // ── AUDIT: MATCH DETAILS ──
        {
            narrate: 'Time to audit. First, check that the match details are correct — the right teams, date, and week.',
            action: 'scroll',
            scrollY: 300,
            selector: '[data-match-card] .grid.gap-3',
            highlight: true,
            pauseAfter: 600,
        },

        // ── AUDIT: OUTCOME ──
        {
            narrate: 'Check that the right team won each game. Use the winner buttons to correct if needed.',
            action: 'scroll',
            scrollY: 400,
            pauseAfter: 600,
        },

        // ── AUDIT: NAMES ──
        {
            narrate: 'Next, check player names. Green dots mean matched to your roster. Yellow means unmatched. In most cases, just correct the name to the actual player name and it will match.',
            action: 'scroll',
            scrollY: 500,
            selector: 'input[placeholder="Search player..."]',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'If a player changed their name or goes by multiple names, use Link Alias so future reports recognize them automatically.',
            action: 'click',
            selector: 'button:has-text("Link Alias")',
            highlight: true,
            pauseAfter: 800,
        },
        {
            // Close alias modal without saving
            action: 'click',
            selector: 'button:has-text("Cancel")',
            pauseAfter: 300,
        },

        // ── AUDIT: ROLES ──
        {
            narrate: 'Verify the roles. Click any role icon to change it, or drag to swap between players.',
            action: 'highlight',
            selector: 'table th:nth-child(2)',
            highlight: true,
            pauseAfter: 600,
        },

        // ── AUDIT: GODS ──
        {
            narrate: 'Check the gods column. The AI reads the labels from the scoreboard.',
            action: 'highlight',
            selector: 'table th:nth-child(3)',
            highlight: true,
            pauseAfter: 600,
        },

        // ── AUDIT: STATS ──
        {
            narrate: 'Finally, verify the numbers — kills, deaths, assists, damage, and mitigation. When everything checks out, hit Submit.',
            action: 'scroll',
            scrollY: 600,
            selector: 'table th:nth-child(4)',
            highlight: true,
            pauseAfter: 800,
        },

        // ── SCROLL BACK UP ──
        {
            action: 'scroll',
            scrollY: 0,
            pauseAfter: 300,
        },

        // ── NEW MATCH REPORT (explain without clicking) ──
        {
            narrate: 'You can also start from scratch with New Match Report. Link to a scheduled match, choose between Discord images or pasting screenshots, and the AI handles the rest.',
            action: 'highlight',
            selector: 'button:has-text("New Match Report")',
            highlight: true,
            pauseAfter: 800,
        },

        // ── MANUAL MATCH REPORT + FF ──
        {
            narrate: 'For quick entries without screenshots, Manual Match Report skips extraction entirely. You fill in everything by hand.',
            action: 'click',
            selector: 'button:has-text("Manual Match Report")',
            highlight: true,
            pauseAfter: 600,
        },
        {
            // Add a regular game
            action: 'click',
            selector: 'button:has-text("+ Game")',
            pauseAfter: 300,
        },
        {
            narrate: 'For forfeits, click plus FF. The winner still counts toward the series, but no player stats are recorded.',
            action: 'click',
            selector: 'button:has-text("+ FF")',
            highlight: true,
            pauseAfter: 800,
        },

        // ── CLOSING: MATCH MANAGER ──
        {
            narrate: 'If you catch a mistake after submitting, head to the Match Manager. Every submitted match can be edited or corrected there.',
            action: 'navigate',
            url: 'http://localhost:5173/admin/matches',
            pauseAfter: 800,
        },
    ],
}
