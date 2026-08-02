import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext(null);

/**
 * Owns session restoration and authentication actions.
 * @param {{children: import("react").ReactNode}} props - Descendant application tree.
 * @returns {import("react").ReactElement} Authentication context provider.
 * @sideEffects Calls `/auth/me` on mount and authentication endpoints on actions.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  /**
   * Authenticates with email/password and stores the public user.
   * @param {{email: string, password: string}} input - Login form values.
   * @returns {Promise<object>} Authenticated public user.
   * @sideEffects Calls the API and updates context state.
   */
  async function login(input) {
    const data = await authService.login(input);
    setUser(data.user);
    return data.user;
  }

  /**
   * Authenticates through Google and stores the public user.
   * @param {string} credential - Google ID token.
   * @returns {Promise<object>} Authenticated public user.
   * @sideEffects Calls the API and updates context state.
   */
  async function loginWithGoogle(credential) {
    const data = await authService.loginWithGoogle(credential);
    setUser(data.user);
    return data.user;
  }

  /**
   * Clears the server session and local authentication state.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {Promise<void>}
   * @sideEffects Calls the API and updates context state.
   */
  async function logout() {
    await authService.logout();
    setUser(null);
  }

  /**
   * Reloads the public user, including the current elderly-profile onboarding status.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {Promise<object>} Refreshed public user.
   * @sideEffects Calls `/auth/me` and updates context state.
   */
  async function refreshUser() {
    const data = await authService.getCurrentUser();
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(
    () => ({ user, isLoading, login, loginWithGoogle, logout, refreshUser }),
    [user, isLoading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads session data and actions from AuthProvider.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {{user: object|null, isLoading: boolean, login: Function, loginWithGoogle: Function, logout: Function}} Auth context.
 * @sideEffects None.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
