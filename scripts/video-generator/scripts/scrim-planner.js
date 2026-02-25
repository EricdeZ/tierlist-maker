export default {
    title: 'Scrim Planner',
    baseUrl: 'http://localhost:5173',

    youtube: {
        title: 'Scrim Planner — Find & Schedule Scrims',
        description: `The Scrim Planner makes it easy for team captains to post, discover, and accept scrimmage matches — all in one place.

Features shown:
• Windows XP-themed desktop with draggable windows
• Browse open scrims with league, tier, region, and division filters
• Post a scrim via the 7-step wizard (team, date, time, pick mode, opponent, region, review)
• Track your scrims: incoming challenges, upcoming matches, pending confirmations
• Reliability scores keep teams accountable
• Scrim Challenges to earn Passion rewards
• Calendar view of your upcoming scrims
• Blacklist system for team management

Built for SmiteComp — the competitive SMITE 2 companion.`,
        tags: ['smite 2', 'smitecomp', 'scrim', 'scrimmage', 'competitive', 'esports', 'team management', 'scrim finder'],
        privacy: 'unlisted',
    },

    steps: [
        // ── Landing ────────────────────────────────────────────────
        {
            narrate: 'Welcome to the Scrim Planner, a one-stop hub for finding and scheduling scrimmage matches for your team.',
            action: 'navigate',
            url: 'http://localhost:5173/scrims',
            pauseAfter: 1500,
        },
        {
            narrate: 'The entire page is styled after a retro desktop, complete with draggable windows, a taskbar, and even a built-in dino runner game. Let us take a look at what is inside.',
            action: 'wait',
            duration: 500,
            pauseAfter: 1000,
        },

        // ── Open Scrims ────────────────────────────────────────────
        {
            narrate: 'The main Scrim Planner window shows all open scrim requests posted by other captains. Each card shows the team, league, division, date, pick mode, region, and a reliability score.',
            action: 'click',
            selector: '.xp-tab:first-child',
            highlight: true,
            pauseAfter: 1200,
        },
        {
            narrate: 'Use the filter bar to narrow results by league, tier, region, or specific division. This makes it easy to find scrims at your level.',
            action: 'highlight',
            selector: '.xp-tab-content .flex.items-center.gap-2.mb-2',
            duration: 4000,
            pauseAfter: 500,
        },
        {
            narrate: 'Every scrim card shows the team logo, their division rank, a reliability percentage bar, the scheduled date, the pick mode, and which tiers or divisions can accept.',
            action: 'highlight',
            selector: '.xp-scrim-card',
            duration: 4000,
            pauseAfter: 800,
        },

        // ── My Scrims ──────────────────────────────────────────────
        {
            narrate: 'Switch to the My Scrims tab to see everything related to your team. This includes incoming challenges, pending confirmations, upcoming matches, and scrims that need a result reported.',
            action: 'click',
            selector: '.xp-tab:nth-child(2)',
            pauseAfter: 1500,
        },
        {
            narrate: 'After a scrim takes place, either captain can report the outcome — completed, we no-showed, or they no-showed. Accused teams get a 24-hour window to dispute, keeping the system fair.',
            action: 'wait',
            duration: 500,
            pauseAfter: 1000,
        },

        // ── Post Scrim Wizard ──────────────────────────────────────
        {
            narrate: 'Now let us post a new scrim. Click the Post Scrim button to open the wizard.',
            action: 'click',
            selector: '.xp-post-scrim-btn',
            highlight: true,
            pauseAfter: 1200,
        },
        {
            narrate: 'Step one asks you to select which team you are posting for. Your team name, league, and division tier are shown for reference.',
            action: 'highlight',
            selector: '.xp-wizard-content',
            duration: 3500,
            pauseAfter: 500,
        },
        {
            narrate: 'Click Next to move to the date picker. Days with an orange dot already have a scrim scheduled for your team, so you can avoid double-booking.',
            action: 'click',
            selector: '.xp-btn.xp-btn-primary',
            pauseAfter: 1500,
        },
        {
            narrate: 'Select any date on the calendar. If it overlaps with an existing scrim, you will get a warning dialog before proceeding.',
            action: 'highlight',
            selector: '.xp-wizard-content',
            duration: 3500,
            pauseAfter: 500,
        },

        // Skip ahead to settings to show pick mode
        {
            narrate: 'After picking a date and time, step four lets you choose the pick mode for your scrim: Regular, Fearless, Fearless Picks, or Fearless Bans. You can also apply a league\'s banned content rules.',
            action: 'click',
            selector: '.xp-wizard-step-item:nth-child(4)',
            pauseAfter: 1500,
        },
        {
            narrate: 'Step five is where you decide who can accept your scrim. Leave it open for any team, or search for a specific opponent to send a direct challenge. You also filter which tiers or divisions are acceptable.',
            action: 'click',
            selector: '.xp-wizard-step-item:nth-child(5)',
            pauseAfter: 1500,
        },
        {
            narrate: 'Step six lets you select the region — North America or Europe — and optionally require your manual confirmation before a scrim is accepted.',
            action: 'click',
            selector: '.xp-wizard-step-item:nth-child(6)',
            pauseAfter: 1500,
        },
        {
            narrate: 'Finally, the review screen shows a full summary of your scrim. Add any notes for the opponent, then click Finish to post.',
            action: 'click',
            selector: '.xp-wizard-step-item:nth-child(7)',
            pauseAfter: 1500,
        },

        // Close the wizard
        {
            narrate: 'Let us close the wizard and check out the other windows on the desktop.',
            action: 'click',
            selector: '.xp-post-window .xp-close-btn',
            pauseAfter: 800,
        },

        // ── Challenges ─────────────────────────────────────────────
        {
            narrate: 'The Scrim Challenges window gives you objectives to complete for Passion rewards. Post scrims, play matches, and maintain your reliability to earn bonus Passion.',
            action: 'click',
            selector: '.xp-taskbar-window-btn:has(span:has-text("Challenges"))',
            pauseAfter: 1500,
        },

        // ── Calendar ───────────────────────────────────────────────
        {
            narrate: 'The Calendar window shows all your upcoming scrims at a glance, organized by date. No more digging through Discord messages.',
            action: 'click',
            selector: '.xp-taskbar-window-btn:has(span:has-text("Calendar"))',
            pauseAfter: 1500,
        },

        // ── Blacklist ──────────────────────────────────────────────
        {
            narrate: 'The Blacklist window lets captains block specific teams from seeing their open scrim requests. It is a one-way filter — you can still accept their scrims if you choose to.',
            action: 'click',
            selector: '.xp-taskbar-window-btn:has(span:has-text("Blacklist"))',
            pauseAfter: 1500,
        },

        // ── Closing ────────────────────────────────────────────────
        {
            narrate: 'That is the Scrim Planner. Post scrims, accept challenges, track reliability, and keep your team organized — all without leaving the site. Head to SmiteComp to get started.',
            action: 'wait',
            duration: 500,
            pauseAfter: 1500,
        },
    ],
}
