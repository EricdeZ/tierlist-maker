// pokemonTileData.js — Embedded data from pret/pokecrystal Celadon Game Corner
// Tileset: TILESET_GAME_CORNER (gfx/tilesets/game_corner.png, 128x96, 16x12 tiles)
// Map: CeladonGameCorner.blk (10x7 blocks, each block = 4x4 tiles = 32x32px)

// Map dimensions (in blocks)
export const MAP_W_BLOCKS = 10
export const MAP_H_BLOCKS = 7

// Map dimensions (in 8x8 tiles)
export const MAP_W_TILES = 40
export const MAP_H_TILES = 28

// Native pixel size
export const NATIVE_W = 320
export const NATIVE_H = 224

// Tile size in pixels
export const TILE_PX = 8
export const TILES_PER_ROW = 16 // tiles across in the tileset PNG

// ── Metatile definitions (1024 bytes, 64 metatiles × 16 bytes each) ──
// Each metatile = 4×4 grid of tile indices, row-major
// prettier-ignore
export const METATILES = new Uint8Array([
    45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,
    1,16,1,16,17,18,17,18,1,16,1,16,17,18,17,18,
    2,2,2,2,2,2,2,2,1,16,1,16,17,18,17,18,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    22,23,23,24,38,39,39,40,54,55,55,56,17,18,17,18,
    1,16,10,11,17,18,26,27,1,16,10,11,17,18,26,27,
    10,11,1,16,26,27,17,18,10,11,1,16,26,27,17,18,
    160,161,162,163,144,145,146,147,160,161,162,163,144,145,146,147,
    1,16,1,16,17,18,17,18,128,129,130,131,144,145,146,147,
    1,16,1,16,17,18,17,18,14,14,14,14,30,30,30,30,
    1,16,1,16,17,18,17,18,14,14,148,134,30,30,30,31,
    160,161,162,163,144,145,146,147,176,177,178,179,192,193,194,195,
    1,16,1,16,17,18,17,18,3,3,3,3,19,19,19,19,
    2,2,2,2,2,2,2,2,1,16,1,16,17,18,17,18,
    166,167,166,167,34,35,34,35,42,43,42,43,58,59,58,59,
    45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,
    77,77,77,77,196,81,77,77,14,14,14,14,30,30,30,30,
    135,136,77,77,151,152,77,77,14,14,14,14,30,30,30,30,
    25,44,25,44,41,60,41,60,57,15,57,15,36,37,36,37,
    2,2,2,2,4,5,2,2,20,21,1,16,20,21,17,18,
    20,21,1,16,20,21,17,18,20,132,14,14,61,30,30,30,
    46,13,13,47,28,12,12,29,62,80,80,63,168,78,79,169,
    20,21,1,16,20,21,17,18,20,21,1,16,20,21,17,18,
    20,21,1,16,20,21,17,18,20,132,14,14,61,30,30,30,
    1,16,1,16,17,18,17,18,14,14,14,14,30,30,30,30,
    10,11,10,11,26,27,26,27,1,16,1,16,17,18,17,18,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    1,16,133,134,17,18,133,134,14,14,148,134,30,30,30,31,
    2,2,2,2,2,2,149,150,1,16,133,134,17,18,133,134,
    1,16,66,67,17,18,82,83,1,16,68,69,17,18,84,85,
    66,67,1,16,82,83,17,18,68,69,1,16,84,85,17,18,
    1,16,1,16,17,18,17,18,1,16,70,71,17,18,86,87,
    72,73,73,73,88,89,89,89,92,77,77,77,94,91,91,91,
    73,73,73,74,89,89,89,90,77,77,77,93,91,91,91,95,
    73,73,73,74,45,45,45,76,45,45,45,76,45,45,45,76,
    45,45,45,76,45,45,45,76,45,45,45,76,45,45,45,76,
    72,73,73,73,75,45,45,45,75,45,45,45,75,45,45,45,
    75,45,45,45,75,45,45,45,75,45,45,45,75,45,45,45,
    77,77,77,77,91,91,91,91,1,16,1,16,17,18,17,18,
    1,16,1,16,52,53,17,18,64,65,14,14,30,30,30,30,
    2,2,6,7,2,2,8,9,1,16,1,16,17,18,17,18,
    2,2,2,2,2,2,2,2,1,16,70,71,17,18,86,87,
    25,44,1,16,41,60,17,18,57,15,1,16,36,37,17,18,
    2,2,2,2,2,2,164,165,1,16,180,181,17,18,50,51,
    1,16,1,16,17,18,17,18,1,16,1,16,46,13,13,47,
    2,2,2,2,2,2,2,2,1,16,1,16,46,13,13,47,
    28,32,33,29,28,48,49,29,62,80,80,63,168,78,79,169,
    2,2,2,2,2,2,137,138,10,11,140,141,26,27,153,154,
    2,2,2,2,138,139,2,2,141,142,10,11,155,156,26,27,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
])

// ── Map block data (70 bytes, 10×7 row-major) ──
// Each byte = metatile index into METATILES
// prettier-ignore
export const MAP_BLOCKS = new Uint8Array([
    0x04,0x04,0x04,0x1c,0x28,0x0d,0x02,0x28,0x0d,0x02,
    0x09,0x09,0x27,0x1b,0x01,0x01,0x12,0x0e,0x0e,0x12,
    0x08,0x01,0x01,0x08,0x01,0x01,0x08,0x01,0x01,0x08,
    0x07,0x06,0x05,0x07,0x06,0x05,0x07,0x06,0x05,0x07,
    0x07,0x06,0x05,0x07,0x06,0x05,0x07,0x06,0x05,0x07,
    0x0b,0x06,0x05,0x0b,0x06,0x05,0x0b,0x06,0x05,0x0b,
    0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x0c,0x01,0x01,
])

// ── Collision data (64 metatiles × 4 quadrants) ──
// 0=WALL, 1=FLOOR, 2=COUNTER, 3=WARP
const W = 0, F = 1, C = 2, WP = 3
// prettier-ignore
export const COLLISION = [
    [W,W,W,W],[F,F,F,F],[W,W,F,F],[F,F,F,F],[W,W,F,F],[F,F,F,F],[F,F,F,F],[C,C,C,C],
    [F,F,C,C],[F,F,C,C],[F,F,C,C],[W,W,W,W],[F,F,WP,WP],[W,W,F,F],[W,W,W,W],[W,W,W,W],
    [W,W,C,C],[W,W,C,C],[W,W,W,W],[W,W,C,F],[C,F,C,C],[W,W,W,W],[C,F,C,F],[C,F,C,C],
    [F,F,C,C],[F,F,F,F],[F,F,F,F],[F,C,C,C],[W,W,F,C],[F,W,F,W],[W,F,W,F],[F,F,F,W],
    [W,W,W,W],[W,W,W,W],[W,W,W,W],[W,W,W,W],[W,W,W,W],[W,W,W,W],[W,W,F,F],[F,F,C,C],
    [W,W,F,F],[W,W,F,W],[W,F,W,F],[W,W,F,W],[F,F,W,W],[W,W,W,W],[W,W,W,W],[W,W,F,W],
    [W,W,W,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],
    [F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],[F,F,F,F],
]

// ── Palette data ──
// GBC 5-bit RGB → 8-bit conversion
function c5to8(v) { return (v << 3) | (v >> 2) }
function rgb(r, g, b) { return [c5to8(r), c5to8(g), c5to8(b)] }

// Indoor palettes from pokecrystal bg_tiles.pal
// Index: 0=GRAY, 1=RED, 2=GREEN, 3=WATER, 4=YELLOW, 5=BROWN, 6=ROOF, 7=TEXT
export const PALETTES = [
    [rgb(30,28,26), rgb(19,19,19), rgb(13,13,13), rgb(7,7,7)],     // 0 GRAY
    [rgb(30,28,26), rgb(31,19,24), rgb(30,10,6),  rgb(7,7,7)],     // 1 RED
    [rgb(18,24,9),  rgb(15,20,1),  rgb(9,13,0),   rgb(7,7,7)],     // 2 GREEN
    [rgb(30,28,26), rgb(15,16,31), rgb(9,9,31),   rgb(7,7,7)],     // 3 WATER
    [rgb(30,28,26), rgb(31,31,7),  rgb(31,16,1),  rgb(7,7,7)],     // 4 YELLOW
    [rgb(26,24,17), rgb(21,17,7),  rgb(16,13,3),  rgb(7,7,7)],     // 5 BROWN
    [rgb(30,28,26), rgb(17,19,31), rgb(14,16,31), rgb(7,7,7)],     // 6 ROOF
    [rgb(31,31,16), rgb(31,31,16), rgb(14,9,0),   rgb(0,0,0)],     // 7 TEXT
]

// Palette name constants
const GRAY = 0, RED = 1, GREEN = 2, WATER = 3, YELLOW = 4, BROWN = 5, ROOF = 6

// Per-tile palette assignments (192 tiles, from game_corner_palette_map.asm)
// Bank 0 (tiles 0-95), then bank 1 (tiles 128-191 mapped to indices 128+)
// prettier-ignore
const PALETTE_MAP_BANK0 = [
    GRAY,GRAY,BROWN,RED,BROWN,GREEN,GREEN,GREEN,
    GREEN,GREEN,GRAY,GRAY,RED,RED,GREEN,BROWN,
    GRAY,GRAY,GRAY,RED,BROWN,GREEN,GRAY,GRAY,
    GRAY,GREEN,GRAY,GRAY,RED,RED,BROWN,BROWN,
    BROWN,BROWN,RED,RED,BROWN,BROWN,GRAY,GRAY,
    GRAY,GREEN,RED,RED,GREEN,GRAY,RED,RED,
    BROWN,BROWN,GRAY,GRAY,GRAY,GRAY,BROWN,BROWN,
    BROWN,BROWN,RED,RED,GREEN,BROWN,RED,RED,
    ROOF,ROOF,GRAY,GRAY,GRAY,GRAY,GRAY,GRAY,
    GRAY,GRAY,GRAY,GRAY,GRAY,ROOF,RED,RED,
    RED,ROOF,GRAY,GRAY,GRAY,GRAY,GRAY,GRAY,
    GRAY,GRAY,GRAY,WATER,ROOF,ROOF,WATER,WATER,
]
// prettier-ignore
const PALETTE_MAP_BANK1 = [
    YELLOW,RED,YELLOW,RED,GREEN,GREEN,BROWN,ROOF,
    ROOF,ROOF,ROOF,ROOF,ROOF,ROOF,ROOF,BROWN,
    YELLOW,RED,YELLOW,RED,GREEN,GREEN,BROWN,ROOF,
    ROOF,GRAY,GRAY,GRAY,GRAY,RED,ROOF,ROOF,
    YELLOW,RED,YELLOW,RED,WATER,WATER,RED,RED,
    RED,RED,RED,RED,GREEN,GRAY,RED,RED,
    RED,RED,YELLOW,YELLOW,WATER,WATER,BROWN,BROWN,
    BROWN,BROWN,RED,RED,GREEN,ROOF,RED,RED,
    RED,RED,YELLOW,YELLOW,ROOF,ROOF,RED,RED,
    GRAY,GRAY,GRAY,GRAY,GRAY,ROOF,RED,RED,
    RED,GRAY,GRAY,GRAY,GRAY,GRAY,RED,RED,
    GRAY,GRAY,GRAY,WATER,ROOF,ROOF,WATER,WATER,
]

export function getTilePalette(tileIdx) {
    if (tileIdx < 96) return PALETTE_MAP_BANK0[tileIdx]
    if (tileIdx < 128) return GRAY // filler/unused
    return PALETTE_MAP_BANK1[tileIdx - 128] ?? GRAY
}

// ── Collision helpers ──
// Build a walkability grid at the quadrant level (20×14 cells, each 16×16 px)
export const QUAD_W = MAP_W_BLOCKS * 2  // 20
export const QUAD_H = MAP_H_BLOCKS * 2  // 14

export function buildCollisionGrid() {
    const grid = new Uint8Array(QUAD_W * QUAD_H)
    for (let by = 0; by < MAP_H_BLOCKS; by++) {
        for (let bx = 0; bx < MAP_W_BLOCKS; bx++) {
            const blockId = MAP_BLOCKS[by * MAP_W_BLOCKS + bx]
            const coll = COLLISION[blockId]
            // Quadrants: [TL, TR, BL, BR]
            const qx = bx * 2, qy = by * 2
            grid[qy * QUAD_W + qx] = coll[0]         // TL
            grid[qy * QUAD_W + qx + 1] = coll[1]     // TR
            grid[(qy + 1) * QUAD_W + qx] = coll[2]   // BL
            grid[(qy + 1) * QUAD_W + qx + 1] = coll[3] // BR
        }
    }
    return grid
}
