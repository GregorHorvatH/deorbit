/** The pickups as small inline icons, drawn like their counterparts in the game (the same shapes and colours as the
 *  heart in render/heartShape.ts and the drum in render/barrelModel.ts). */

/** A heart. */
export function HeartIcon() {
  return (
    <svg className="icon" viewBox="-1.15 -1.15 2.3 2.3" role="img" aria-label="heart">
      <path
        d="M0 1 C-0.2 0.8 -1 0.2 -1 -0.3 C-1 -0.8 -0.4 -1 0 -0.55 C0.4 -1 1 -0.8 1 -0.3 C1 0.2 0.2 0.8 0 1 Z"
        fill="#ff5d7a"
      />
    </svg>
  )
}

/** A barrel of fuel: an orange drum with two dark bands and a stripe. */
export function BarrelIcon() {
  return (
    <svg className="icon" viewBox="0 0 10 12" role="img" aria-label="barrel of fuel">
      <rect x="1.4" y="1" width="7.2" height="10" rx="1" fill="#f08a2c" />
      <rect x="1.2" y="2.6" width="7.6" height="1.6" fill="#7c3a10" />
      <rect x="1.2" y="7.8" width="7.6" height="1.6" fill="#7c3a10" />
      <rect x="4.4" y="1" width="1.2" height="10" fill="#7c3a10" />
    </svg>
  )
}
