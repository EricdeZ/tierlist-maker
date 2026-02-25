// arcadeHubMap.js — Interactive objects for the Celadon Game Corner map
// Positions are in QUADRANT coordinates (20×14 grid, each cell = 16×16 native px)
// The Crystal map is 10×7 blocks = 20×14 quadrants = 40×28 tiles

// Interactive objects the player can activate
// Positions chosen to match the Game Corner layout:
//   - Rows 3-5 (block): slot machine columns at block cols 0, 3, 6, 9
//   - Row 1 (block): counter/reception area
//   - Row 6 (block): floor with exit at block col 7
export const OBJECTS = [
    // Slot machine rows → "arcade cabinets" (inhouse lobbies)
    // Each machine column is at block cols 0, 3, 6, 9 → quadrant cols 0-1, 6-7, 12-13, 18-19
    // Player stands in the aisles (quadrant cols 2-5, 8-11, 14-17)
    // Interact from adjacent walkable quadrant
    { id: 1,  type: 'cabinets', qx: 2,  qy: 7,  label: 'PLAY',       color: '#00f0ff' },
    { id: 2,  type: 'cabinets', qx: 5,  qy: 7,  label: 'PLAY',       color: '#00f0ff' },
    { id: 3,  type: 'cabinets', qx: 8,  qy: 7,  label: 'PLAY',       color: '#ff44ff' },
    { id: 4,  type: 'cabinets', qx: 11, qy: 7,  label: 'PLAY',       color: '#ff44ff' },
    { id: 5,  type: 'cabinets', qx: 14, qy: 7,  label: 'PLAY',       color: '#ffe600' },
    { id: 6,  type: 'cabinets', qx: 17, qy: 7,  label: 'PLAY',       color: '#ffe600' },

    // Counter area (block row 1, cols 0-1) → "NEW GAME"
    { id: 7,  type: 'create',      qx: 2,  qy: 3,  label: 'NEW GAME',    color: '#ffe600' },

    // Right side of counter/reception → "HIGH SCORES"
    { id: 8,  type: 'high-scores', qx: 7,  qy: 2,  label: 'HIGH SCORES', color: '#ffe600' },

    // Near the poster on upper right → "MY GAMES"
    { id: 9,  type: 'my-games',    qx: 17, qy: 3,  label: 'MY GAMES',    color: '#00f0ff' },

    // Open floor near exit → "COIN FLIP"
    { id: 10, type: 'coinflip',    qx: 10, qy: 12, label: 'COIN FLIP',   color: '#ffe600' },
]

// Player spawn: bottom center, near the exit door (block row 6, col 7 is the warp)
// Quadrant (14, 12) = just above the exit
export const SPAWN_QX = 14
export const SPAWN_QY = 12
