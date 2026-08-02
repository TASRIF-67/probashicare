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
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="spinner" aria-label="Loading" /> : children}
    </button>
  );
}
