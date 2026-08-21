/**
 * Builds one restrained reveal-animation configuration for Framer Motion.
 * @param {boolean|null} reduceMotion - Browser reduced-motion preference.
 * @param {{delay?: number, distance?: number, duration?: number}} [options] - Small timing and movement adjustments.
 * @returns {object} Framer Motion initial, viewport, target, and transition values.
 * @sideEffects None.
 */
export function createRevealMotion(reduceMotion, options = {}) {
  if (reduceMotion) {
    return {
      initial: false,
    };
  }

  const delay = options.delay || 0;
  const distance = options.distance || 18;
  const duration = options.duration || 0.55;

  return {
    initial: {
      opacity: 0,
      y: distance,
    },
    whileInView: {
      opacity: 1,
      y: 0,
    },
    viewport: {
      once: true,
      amount: 0.15,
    },
    transition: {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
    },
  };
}
