export default {
    title: 'Creating a Team',
    baseUrl: 'http://localhost:5173',

    steps: [
        {
            narrate: 'To create a team, head to the Team Manager in the admin panel.',
            action: 'navigate',
            url: 'http://localhost:5173/admin/teams',
            pauseAfter: 800,
        },
        {
            narrate: 'Select the season you want to add a team to.',
            action: 'select',
            selector: 'select',
            value: 'Tanuki',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'Click Add Team to open the creation form.',
            action: 'click',
            selector: 'button:has-text("Add Team")',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'You can upload a team icon here. Use a transparent background so it looks clean on all surfaces.',
            action: 'wait',
            duration: 300,
            selector: '.border-dashed',
            highlight: true,
            pauseAfter: 600,
        },
        {
            narrate: 'Type in your team name, pick a color, and hit the green check to save.',
            action: 'type',
            selector: 'input[placeholder="Team name"]',
            value: 'Sunset Foxes',
            highlight: true,
            pauseAfter: 800,
        },
        {
            narrate: 'Your team is now created and ready for players.',
            action: 'click',
            selector: 'button[title="Save"]',
            pauseAfter: 800,
        },
    ],
}
