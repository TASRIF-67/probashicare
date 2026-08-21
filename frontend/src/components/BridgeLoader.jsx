/**
 * Displays ProbashiCare's connection-themed loader for care data that is
 * being opened or synchronized across people and locations.
 * @param {object} props - Component settings.
 * @param {string} [props.label="Connecting care workspace"] - Accessible loading message.
 * @param {boolean} [props.compact=false] - Whether to use the smaller embedded layout.
 * @returns {import("react").ReactElement} The connection loader.
 * @sideEffects Announces the current loading message to screen readers.
 */
export function BridgeLoader({
  label = "Connecting care workspace",
  compact = false,
}) {
  let className = "bridge-loader";

  if (compact) {
    className += " bridge-loader--compact";
  }

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
    >
      <div
        className="bridge-loader__route"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 140 46"
          focusable="false"
        >
          <path d="M 10 35 C 42 3, 98 3, 130 35" />
          <circle
            className="bridge-loader__origin"
            cx="10"
            cy="35"
            r="3.5"
          />
          <circle
            className="bridge-loader__destination"
            cx="130"
            cy="35"
            r="3.5"
          />
        </svg>
        <span className="bridge-loader__traveler" />
      </div>
      <span className="bridge-loader__label">{label}</span>
    </div>
  );
}
