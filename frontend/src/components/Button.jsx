/**
 * Renders a consistent action button.
 * @param {{children: import("react").ReactNode, variant?: "primary"|"secondary"|"ghost", isLoading?: boolean, className?: string} & import("react").ButtonHTMLAttributes<HTMLButtonElement>} props - Button content and native attributes.
 * @returns {import("react").ReactElement} Styled button.
 * @sideEffects Invokes the supplied native event handlers.
 */
export function Button({
  children,
  variant = "primary",
  isLoading = false,
  className = "",
  disabled,
  ...props
}) {
  const buttonClassName = [
    "button",
    `button--${variant}`,
    isLoading ? "button--loading" : "",
    className,
  ].join(" ").trim();

  return (
    <button
      className={buttonClassName}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      <span
        className="button__content"
        aria-hidden={isLoading || undefined}
      >
        {children}
      </span>
      {isLoading && (
        <span className="button__loading-indicator">
          <span className="spinner" aria-hidden="true" />
          <span className="sr-only">Loading, please wait</span>
        </span>
      )}
    </button>
  );
}
