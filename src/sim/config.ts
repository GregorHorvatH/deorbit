/** Game constants. Lengths are in EARTH RADII (the game was tuned in "design pixels" with a globe radius of 250:
 *  every such value is converted with `px()`). Speeds are radians per simulation step; one step is
 *  TICK_MS milliseconds (the simulation runs at 1000 / TICK_MS = 40 Hz). */

/** The globe radius in design pixels: the factor between the pixel constants and Earth radii. */
export const RADIUS_PX = 250
/** Design pixels -> Earth radii. */
export const px = (v: number): number => v / RADIUS_PX

export const TICK_MS = 25
export const STEPS_PER_SECOND = 1000 / TICK_MS
/** After a pause the loop never advances by more than this many steps at once. */
export const MAX_STEPS = 4

export const TILT = (23.5 * Math.PI) / 180 // axial tilt of the globe
/** The globe rotation per step the game was designed with: 0.3 degrees = 12 degrees a second (a turn in 30 seconds). The reference tests compare against it. */
export const DESIGN_SPEED = (0.3 * Math.PI) / 180
/** The globe rotation per step as played: half of the design speed: 6 degrees a second (a turn in 60 seconds), slowed down on purpose. */
export const SPEED = DESIGN_SPEED / 2

// --- Atmosphere (only its thickness matters to the simulation: the burn starts at the top of the air) ---
export const ATMO_WIDTH = px(28)

// --- Satellites / ISS ---
export const SATELLITE_COUNT = 10
export const ISS_ORBIT = 1.18
export const ISS_INCLINATION = 51.6 // degrees
export const ISS_PHASE = 0.8
export const ISS_ALT_RANGE: readonly [number, number] = [1.12, 1.32]

// --- The turtle ---
export const CATCH_RADIUS = px(30)
export const PLAYER_SPEED = 0.02
export const PLAYER_REF_ALT = 1.22
export const PLAYER_ALT_RANGE: readonly [number, number] = [1.1, 1.34]
export const PLAYER_TURN_STEP = (15 * Math.PI) / 180
export const PLAYER_ALT_STEP = 0.04
export const BUMP_RADIUS = px(18)
export const BUMP_TURN = 0.3
export const BUMP_LEVELS: readonly number[] = [1]
export const BUMP_COOLDOWN = 45
/** A new ISS / satellite never appears closer than this to the turtle. */
export const ISS_SPAWN_CLEARANCE = px(170)
export const SAT_SPAWN_CLEARANCE = px(160)

// --- Difficulty ---
export const ISS_SPEED_START = 0.05
export const ISS_SPEED_FIRST_STEP = 0.2
export const ISS_SPEED_DECAY = 0.7
export const ISS_SPEED_MIN_STEP = 0.05
export const ISS_SPEED_MAX = 0.95

// --- The caught ISS burns up ---
export const BURN_ANIMATION = true
export const BURN_FALL = 0.45 // seconds, from the highest orbit
export const BURN_FALL_MIN = 0.15 // seconds, from the lowest orbit
export const BURN_FIRE = 0.45
export const BURN_DRIFT = px(30)
export const BURN_END = px(5)
export const FORECAST_SECONDS = 15

// --- Effects ---
export const EFFECT_LIFE = 26
export const WOBBLE_LIFE = 30

// --- HUD thresholds (also colour the catch ring) ---
export const HUD_CLOSE = 2.5 // DST turns green within this many catch radii
export const HUD_AIM = 10 // BRG turns green within this many degrees of straight ahead
export const HUD_ALT_NEAR = 2 // ALT is amber when the two orbits differ by 1 .. this many levels
export const PLAYER_PATH = 1.5 // length of the dotted orbit prediction ahead of the turtle, rad
