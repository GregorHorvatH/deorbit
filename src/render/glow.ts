/** Layer bits for the bloom (see Bloom.tsx). Everything is on layer 0 (the normal picture). A glowing object is ALSO on
 *  the glow layer; the Earth and the clouds have a black twin on the occluder layer that only the glow pass sees, so a
 *  light behind the Earth or under a cloud does not shine through. */
export const GLOW_MASK = 1 | 2 // layer 0 + the glow layer: put it on a glowing object (`layers-mask`)
export const OCCLUDER_MASK = 4 // the black twin of something that must hide glow
export const GLOW_PASS_MASK = 2 | 4

/** 1 while the glow pass is being drawn, 0 otherwise: lets a material glow less than it shines (see the city lights). */
export const glowPass = { value: 0 }
