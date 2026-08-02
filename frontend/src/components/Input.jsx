import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons.jsx";

/**
 * Renders an accessible labeled input with validation feedback.
 * @param {{label: string, error?: string, id: string, showPasswordToggle?: boolean} & import("react").InputHTMLAttributes<HTMLInputElement>} props - Label, error, password toggle, and native attributes.
 * @returns {import("react").ReactElement} Labeled form control.
 * @sideEffects Manages password visibility and invokes supplied native input handlers.
 */
export function Input({ label, error, id, showPasswordToggle = false, type = "text", ...props }) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const errorId = `${id}-error`;
  const canTogglePassword = showPasswordToggle && type === "password";
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className={canTogglePassword ? "input-with-action" : ""}>
        <input
          id={id}
          type={canTogglePassword && isPasswordVisible ? "text" : type}
          className={error ? "input input--error" : "input"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {canTogglePassword && (
          <button
            type="button"
            className="input-action"
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((current) => !current)}
          >
            {isPasswordVisible ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
          </button>
        )}
      </span>
      {error && (
        <small id={errorId} className="field__error">
          {error}
        </small>
      )}
    </label>
  );
}
