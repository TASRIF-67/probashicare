import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext(null);

/**
 * Owns session restoration and authentication actions.
 * @param {{children: import("react").ReactNode}} props - Application tree.
 * @returns {import("react").ReactElement} Authentication provider.
 * @sideEffects Restores session on mount and calls auth APIs on actions.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(
    /**
     * Restores an existing cookie-backed session once on application startup.
     * @returns {() => void} Cleanup that blocks late state updates.
     * @sideEffects Calls /auth/me and updates authentication state.
     */
    function restoreSessionOnMount() {
      let isActive = true;

      /**
       * Performs the asynchronous session lookup without returning its Promise
       * from the React effect.
       * @returns {Promise<void>}
       * @sideEffects Calls the API and updates user/loading state.
       */
      async function restoreSession() {
        try {
          const data =
            await authService.getCurrentUser();

          if (isActive) {
            setUser(data.user);
          }
        } catch (_error) {
          if (isActive) {
            // A missing or expired session is normal for a public visitor.
            setUser(null);
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void restoreSession();

      /**
       * Prevents an in-flight request from updating an unmounted provider.
       * @returns {void}
       * @sideEffects Changes the effect-local activity flag.
       */
      return function stopSessionStateUpdates() {
        isActive = false;
      };
    },
    [],
  );

  /**
   * Authenticates with email/password and stores the public user.
   * @param {{email: string, password: string}} input - Credentials.
   * @returns {Promise<object>} Authenticated public user.
   * @sideEffects Calls API and updates context state.
   */
  async function login(input) {
    const data = await authService.login(input);
    setUser(data.user);
    return data.user;
  }

  /**
   * Authenticates through Google and stores the Family user.
   * @param {string} credential - Google ID token.
   * @returns {Promise<object>} Authenticated public user.
   * @sideEffects Calls API and updates context state.
   */
  async function loginWithGoogle(credential) {
    const data =
      await authService.loginWithGoogle(credential);
    setUser(data.user);
    return data.user;
  }

  /**
   * Clears the server session and local authentication state.
   * @returns {Promise<void>} Resolves after state is cleared.
   * @sideEffects Calls logout API and updates context state.
   */
  async function logout() {
    await authService.logout();
    setUser(null);
  }

  /**
   * Clears local user state after the server already ended the session.
   * @returns {void}
   * @sideEffects Removes the current React user.
   */
  function clearSession() {
    setUser(null);
  }

  /**
   * Reloads the public user and role-specific state.
   * @returns {Promise<object>} Refreshed public user.
   * @sideEffects Calls /auth/me and updates context state.
   */
  async function refreshUser() {
    const data =
      await authService.getCurrentUser();
    setUser(data.user);
    return data.user;
  }

  // `useMemo` keeps one context object until user/loading changes.
  const value = useMemo(
    /**
     * Builds the exact value returned by useAuth.
     * @returns {object} Session state and authentication actions.
     * @sideEffects None.
     */
    function createAuthContextValue() {
      return {
        user,
        isLoading,
        login,
        loginWithGoogle,
        logout,
        clearSession,
        refreshUser,
      };
    },
    [user, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Reads session state and actions from AuthProvider.
 * @returns {object} Current user, loading state, and authentication actions.
 * @sideEffects None.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}
