/**
 * Wraps related content in a reusable surface.
 * @param {{children: import("react").ReactNode, className?: string}} props - Card content and optional class.
 * @returns {import("react").ReactElement} Card section.
 * @sideEffects None.
 */
export function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}
