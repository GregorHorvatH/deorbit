/** three.js r183+ prints "THREE.Clock: This module has been deprecated" every time a Clock is made, and
 *  @react-three/fiber (9.x, still the latest stable) makes one inside its own store. The game uses its own fixed-step
 *  clock (state/world.ts), so the warning is not about our code and nothing can be done about it here until R3F moves to
 *  THREE.Timer. Only that one message is dropped; every other warning goes through. Delete this file then. */
const clockWarning = 'Clock: This module has been deprecated'
const warn = console.warn.bind(console)
console.warn = (...args: unknown[]): void => {
  if (typeof args[0] === 'string' && args[0].includes(clockWarning)) return
  warn(...args)
}
