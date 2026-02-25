export default {
    title: 'Fantasy Forge Introduction',
    baseUrl: 'http://localhost:5173',

    steps: [
        {
            narrate: 'Welcome to Fantasy Forge, the player investment market where you fuel the players you believe in.',
            action: 'navigate',
            url: 'http://localhost:5173/forge',
            pauseAfter: 2000,
        },
        {
            narrate: 'The Forge runs on a bonding curve. The more people invest in a player, the higher their Spark price rises. Early believers are rewarded.',
            action: 'wait',
            duration: 500,
            pauseAfter: 1500,
        },
        {
            narrate: 'At the top you can see a featured player with their price chart. Hit the shuffle button to discover different players.',
            action: 'click',
            selector: 'button svg.lucide-shuffle',
            highlight: true,
            pauseAfter: 1500,
        },
        {
            narrate: 'Use the search bar to find any player by name, team, or role.',
            action: 'click',
            selector: 'input[type="text"]',
            highlight: true,
            pauseAfter: 1000,
        },
        {
            narrate: 'Each player row shows their current price, recent price change, and total Sparks invested. Green means rising, red means cooling off.',
            action: 'scroll',
            scrollY: 400,
            pauseAfter: 2500,
        },
        {
            narrate: 'You can sort players by highest value, biggest gainers, most popular, and more.',
            action: 'scroll',
            scrollY: 200,
            pauseAfter: 2000,
        },
        {
            narrate: 'Now let us check the portfolio tab to see your investments.',
            action: 'click',
            selector: 'button span.hidden.sm\\:inline',
            pauseAfter: 500,
        },
        {
            narrate: '',
            action: 'navigate',
            url: 'http://localhost:5173/forge/portfolio',
            pauseAfter: 2000,
        },
        {
            narrate: 'My Sparks shows every player you have invested in, your total portfolio value, and your profit or loss on each position.',
            action: 'wait',
            duration: 500,
            pauseAfter: 2500,
        },
        {
            narrate: 'Finally, the Hall of Flame leaderboard ranks all investors by portfolio value. Compete to become the top forge master.',
            action: 'navigate',
            url: 'http://localhost:5173/forge/leaderboard',
            pauseAfter: 3000,
        },
        {
            narrate: 'That is Fantasy Forge. Invest your Passion, fuel your favorite players, and climb the leaderboard. Good luck.',
            action: 'wait',
            duration: 500,
            pauseAfter: 2000,
        },
    ],
}
