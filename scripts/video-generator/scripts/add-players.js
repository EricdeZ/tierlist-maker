export default {
    title: 'Adding Players to a Roster',
    baseUrl: 'http://localhost:5173',

    steps: [
        {
            narrate: 'To build your roster, open the Roster Manager from the admin panel.',
            action: 'navigate',
            url: 'http://localhost:5173/admin/rosters',
            pauseAfter: 600,
        },
        {
            narrate: 'Select your season.',
            action: 'select',
            selector: 'select',
            value: 'Upper',
            highlight: true,
            pauseAfter: 400,
        },
        {
            narrate: 'Open the Player Pool to see all free agents. You can drag players directly onto any team card to add them.',
            action: 'click',
            selector: 'button:has-text("Player Pool")',
            highlight: true,
            pauseAfter: 600,
        },
        {
            // Search pool for a specific player
            action: 'type',
            selector: 'input[placeholder="Search players..."]',
            value: 'Adora',
            pauseAfter: 400,
        },
        {
            narrate: 'Grab a player and drop them on the team.',
            action: 'drag',
            selector: 'div[draggable="true"]:has-text("Adora")',
            target: ':nth-match(div.rounded-xl, 1)',
            pauseAfter: 800,
        },
        {
            // Close the pool panel before opening modal
            action: 'click',
            selector: 'button:has-text("Player Pool")',
            pauseAfter: 300,
        },
        {
            narrate: 'You can also use Add Player for more control. Search by name or Discord handle — Discord names show up right below each player.',
            action: 'click',
            selector: 'div.rounded-xl:has-text("Sunset Foxes") button:has-text("+ Add Player")',
            pauseAfter: 400,
        },
        {
            action: 'type',
            selector: 'input[placeholder="Search by player name..."]',
            value: 'Airborne',
            pauseAfter: 800,
        },
        {
            narrate: 'Click a player to add them to the roster.',
            action: 'click',
            selector: 'button:has-text("+ ADD")',
            pauseAfter: 600,
        },
        {
            // Close modal
            action: 'click',
            selector: 'button:has-text("Done")',
            pauseAfter: 400,
        },
        {
            narrate: 'Back on the roster, click any role badge to reassign it. Use the crown icon to set a team captain, then save your changes.',
            action: 'wait',
            duration: 500,
            pauseAfter: 800,
        },
    ],
}
