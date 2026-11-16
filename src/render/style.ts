/** Look-and-feel constants. Colours are plain display values: the renderer runs WITHOUT colour management (see
 *  App.tsx), so the night shade blends plain sRGB numbers. */
import { ATMO_WIDTH } from '../sim'

export const BG = '#050a08'
export const OCEAN = '#21496b'
export const LAND_FILL = '#0d7a38'
export const DESERT = '#a98f4a' // sand
export const GLACIER = '#e4eef6' // ice sheets
export const RIVER = '#2f7fb5'

// --- Relief (the shader mixes these in by height / depth; see globeFrag) ---
export const HIGHLAND = '#8b7a45' // high ground turns brown ...
export const SNOW = '#eef3f7' // ... and the highest peaks white
export const OCEAN_SHALLOW = '#2d6a92' // the shelf
export const OCEAN_DEEP = '#183a58'

// --- Night on the left hemisphere (fractions of the globe radius; x grows to the right) ---
export const NIGHT_START = 0.1 // the transition starts here ...
export const NIGHT_END = -0.15 // ... and ends here, in full night
export const NIGHT_DARKNESS = 0.94 // how dark the night side gets (0 = not at all, 1 = pitch black)

// --- Atmosphere ---
export const ATMO_COLOR = '#4aa8ff'
export const ATMO_STRENGTH = 0.4 // brightness near the surface
export const ATMO_NIGHT = 0.06 // fraction of the brightness left on the night side
export { ATMO_WIDTH }

// --- Stars ---
export const STAR_COUNT = 98
export const STAR_COLORS = ['#ffffff', '#cfe0ff', '#fff1d0']
export const STAR_TWINKLE = 1.0

/** Mirrors the "Day / night" checkbox for the objects that are coloured on the CPU (see state/settings.ts). */
export const nightLayer = { on: true }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 0 = day ... 1 = full night for a world x (Earth radii): a smooth S-curve. The sun stands still on
 *  the right of the picture (the globe turns beneath it), so the terminator is a vertical band. */
export function nightFactor(x: number): number {
  if (!nightLayer.on) return 0 // the "Day / night" layer is switched off: everything is lit evenly
  const s = clamp01((NIGHT_START - x) / (NIGHT_START - NIGHT_END))
  return s * s * (3 - 2 * s)
}

// --- Satellites: day -> night ---
export const SAT_BODY = ['#eef3f8', '#7d8590'] as const
export const SAT_PANEL = ['#6fa8ff', '#2c4a75'] as const
export const SAT_TRAIL_COLOR = ['#8fb8ff', '#2f4560'] as const
export const SAT_TRAIL = 14 // segments
export const SAT_TRAIL_STEP = 0.05 // rad between trail points

// --- ISS ---
export const ISS_SIZE = 1.35
export const ISS_TRAIL = 22
export const ISS_BODY = ['#f4f6f8', '#8f98a3'] as const
export const ISS_TRUSS = ['#c9ced4', '#6c737c'] as const
export const ISS_PANEL = ['#e2ab3c', '#7d5f22'] as const
export const ISS_TRAIL_COLOR = '#ffe7a6'

// --- The turtle ---
export const PLAYER_SIZE = 1.5
export const PLAYER_COLOR = ['#3ddc84', '#04170b'] as const
export const PLAYER_EDGE = ['#e9fff2', '#0b3a1d'] as const
export const PLAYER_TRAIL = ['#3f9f6a', '#0b3a1d'] as const
export const PLAYER_PREDICTION = '#58c98a'
export const PLAYER_HIDDEN_OUTLINE = '#3f9f6a'
/** The outline of the turtle, in design pixels: the nose is at (0, 16) and points "forward". */
export const TURTLE_SHAPE: ReadonlyArray<readonly [number, number]> = [
  [0, 16], [-2, 14], [-1, 10], [-4, 7], [-7, 9], [-9, 8], [-6, 5], [-7, 1], [-5, -3], [-8, -6], [-6, -8], [-4, -5],
  [0, -7], [4, -5], [6, -8], [8, -6], [5, -3], [7, 1], [6, 5], [9, 8], [7, 9], [4, 7], [1, 10], [2, 14],
]

// --- Catch ring and flashes ---
export const RING_GREEN = '#7dffb0'
export const RING_AMBER = '#ffd479'
export const RING_AMBER_HIDDEN = '#8a6a30'
export const EFFECT_COLORS = { capture: '#7dffb0', bump: '#ff9a3c', spawn: '#8fb8ff', burnout: '#ff9a3c', heal: '#ff7a9a', refuel: '#ffb347' } as const

// --- The heart pickup, and the thruster puff beside the turtle ---
export const HEART_SIZE = 7
export const HEART_COLORS = ['#ff5d7a', '#a8344d'] as const // day, night
export const HEART_RING = '#ff8fa8'
export const HEART_RING_HIDDEN = '#7a3a48'
export const HEART_TRAIL = 12
// --- The barrel of fuel ---
export const BARREL_SIZE = 1.9
export const BARREL_BODY = ['#f08a2c', '#6e3a12'] as const // day, night
export const BARREL_BAND = ['#7c3a10', '#3a1c08'] as const
export const BARREL_TRAIL_COLOR = '#ffc474'
export const BARREL_TRAIL = 12
export const BARREL_RING = '#ffb347'
export const BARREL_RING_HIDDEN = '#7a5320'
// --- The turtle's outline flickers while the sinking alarm sounds ---
export const WARN_OUTLINE = '#ffd23c'
export const DANGER_OUTLINE = '#ff3b3b'
export const JET_COLOR = '#bfe6ff'

// --- The caught station burns up: white-hot ... a cooling ember ---
export const BURN_COLORS = ['#fff7d6', '#ffd36b', '#ff8a2a', '#d83a12', '#5a1408'] as const

// --- Clouds (procedural, see CLOUD_GLSL in shaders.ts) ---
export const CLOUD_SCALE = 1.03 // clouds float above the surface (the city lights are below, at 1.004; the lowest orbit is at 1.10)
export const CLOUD_DRIFT = 1.15 // clouds turn slightly faster than the surface

// --- City lights ---
export const CITY_COLOR = '#ffcf6e'
export const CITY_GLOW = 0.16 // how much of a city light goes into the bloom (the fireball uses all of its light)
export const CITY_DOTS = 1 // smaller lights around each city (few: the lights belong on the coasts)
export const CITY_SPREAD = 0.7 // degrees
export const COAST_SPACING = 0.6 // degrees between candidate coast lights along an outline
export const COAST_DEPTH = 1.1 // how far inland (degrees, at most) a coast light may sit
export const CITY_VISIBLE_FROM = 0.82 // how deep into the night gradient (0..1) the lights start to glow: nothing on the lit side
