// Pokemon Crystal overworld NPC sprites for the Arcade Hub
// Each PNG is 16×96 (6 frames of 16×16). Frame 0 (top) = front-facing standing pose.
// Grayscale 2-bit PNGs — colorized at render time with GBC palettes.

import clerk from '../../assets/arcade/npcs/clerk.png'
import cooltrainerM from '../../assets/arcade/npcs/cooltrainer_m.png'
import cooltrainerF from '../../assets/arcade/npcs/cooltrainer_f.png'
import pokefanM from '../../assets/arcade/npcs/pokefan_m.png'
import pokefanF from '../../assets/arcade/npcs/pokefan_f.png'
import gentleman from '../../assets/arcade/npcs/gentleman.png'
import beauty from '../../assets/arcade/npcs/beauty.png'
import lass from '../../assets/arcade/npcs/lass.png'
import youngster from '../../assets/arcade/npcs/youngster.png'
import gameboyKid from '../../assets/arcade/npcs/gameboy_kid.png'
import rocker from '../../assets/arcade/npcs/rocker.png'
import superNerd from '../../assets/arcade/npcs/super_nerd.png'
import rocket from '../../assets/arcade/npcs/rocket.png'
import rocketGirl from '../../assets/arcade/npcs/rocket_girl.png'
import sailor from '../../assets/arcade/npcs/sailor.png'

// GBC 5-bit RGB → 8-bit
const c = (r, g, b) => [Math.round(r * 255 / 31), Math.round(g * 255 / 31), Math.round(b * 255 / 31)]

// Overworld sprite palettes (morn/indoor, from npc_sprites.pal)
// Each palette: [lightest, light, dark, darkest] matching gray values [0xFF, 0xAA, 0x55, 0x00]
const OW_PALETTES = {
    red:   [c(28,31,16), c(31,19,10), c(31, 7, 1), c(0,0,0)],
    blue:  [c(28,31,16), c(31,19,10), c(10, 9,31), c(0,0,0)],
    green: [c(28,31,16), c(31,19,10), c( 7,23, 3), c(0,0,0)],
    brown: [c(28,31,16), c(31,19,10), c(15,10, 3), c(0,0,0)],
    pink:  [c(28,31,16), c(31,19,10), c(30,10, 6), c(0,0,0)],
}

// All available NPC sprites with their palette assignments (from data/sprites/sprites.asm)
export const NPC_SPRITES = [
    { key: 'clerk',         label: 'Clerk',           src: clerk,        palette: 'green' },
    { key: 'cooltrainer_m', label: 'Cool Trainer',    src: cooltrainerM, palette: 'blue'  },
    { key: 'cooltrainer_f', label: 'Cool Trainer F',  src: cooltrainerF, palette: 'blue'  },
    { key: 'pokefan_m',     label: 'Pokefan',         src: pokefanM,     palette: 'brown' },
    { key: 'pokefan_f',     label: 'Pokefan F',       src: pokefanF,     palette: 'brown' },
    { key: 'gentleman',     label: 'Gentleman',       src: gentleman,    palette: 'blue'  },
    { key: 'beauty',        label: 'Beauty',          src: beauty,       palette: 'blue'  },
    { key: 'lass',          label: 'Lass',            src: lass,         palette: 'red'   },
    { key: 'youngster',     label: 'Youngster',       src: youngster,    palette: 'blue'  },
    { key: 'gameboy_kid',   label: 'Gameboy Kid',     src: gameboyKid,   palette: 'green' },
    { key: 'rocker',        label: 'Rocker',          src: rocker,       palette: 'green' },
    { key: 'super_nerd',    label: 'Super Nerd',      src: superNerd,    palette: 'blue'  },
    { key: 'rocket',        label: 'Rocket',          src: rocket,       palette: 'brown' },
    { key: 'rocket_girl',   label: 'Rocket Girl',     src: rocketGirl,   palette: 'brown' },
    { key: 'sailor',        label: 'Sailor',          src: sailor,       palette: 'blue'  },
]

// Quick lookup by key
export const NPC_SPRITE_MAP = Object.fromEntries(NPC_SPRITES.map(s => [s.key, s]))

// Get the palette colors for a sprite key
export function getSpritePalette(key) {
    const sprite = NPC_SPRITE_MAP[key]
    if (!sprite) return OW_PALETTES.red
    return OW_PALETTES[sprite.palette] || OW_PALETTES.red
}

export { OW_PALETTES }
