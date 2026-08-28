import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { subscriptionService } from "../services/subscriptionService.js";
import { useAuth } from "./AuthContext.jsx";

const SubscriptionContext = createContext(null);

/**
 * Shares the signed-in Family account's current subscription access with the
 * workspace shell and Premium feature pages.
 * @param {{children: import("react").ReactNode}} props - Descendant application content.
 * @returns {import("react").ReactElement} Subscription context provider.
 * @sideEffects Loads subscription access whenever a Family session becomes available.
 */
export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: false,
    data: null,
    error: "",
  });

  /**
   * Reloads the authenticated Family account's effective access from the API.
   * @returns {Promise<object|null>} Subscription response, or null for non-Family users.
   * @sideEffects Calls the subscription API and updates shared React state.
   */
  const refreshSubscription = useCallback(async () => {
    if (user?.role !== "family") {
      setState({
        loading: false,
        data: null,
        error: "",
      });
      return null;
    }

    setState(
      /**
       * Preserves existing access while marking a refresh in progress.
       * @param {object} currentState - Existing context state.
       * @returns {object} Loading context state.
       * @sideEffects None.
       */
      function beginSubscriptionLoad(currentState) {
        return {
          ...currentState,
          loading: true,
          error: "",
        };
      },
    );

    try {
      const data = await subscriptionService.getMySubscription();
      setState({
        loading: false,
        data,
        error: "",
      });
      return data;
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error: "Subscription access could not be checked.",
      });
      return null;
    }
  }, [user?.role]);

  useEffect(
    /**
     * Refreshes subscription access when the authenticated role changes.
     * @returns {void}
     * @sideEffects Starts an asynchronous subscription request.
     */
    function refreshWhenFamilySessionChanges() {
      // An effect must not itself be async because React expects only a cleanup
      // function (or undefined) to be returned. The async callback is invoked
      // without returning its Promise to React.
      void refreshSubscription();
    },
    [refreshSubscription],
  );

  // `useMemo` keeps the shared object identity stable until its dependencies
  // change, which avoids unnecessary context consumer renders.
  const value = useMemo(
    /**
     * Builds the exact shared context value for consumers.
     * @returns {object} Subscription state plus refresh action.
     * @sideEffects None.
     */
    function createSubscriptionContextValue() {
      return {
        ...state,
        refreshSubscription,
      };
    },
    [refreshSubscription, state],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Reads current Family subscription access and the shared refresh action.
 * @returns {{loading: boolean, data: object|null, error: string, refreshSubscription: () => Promise<object|null>}} Shared subscription state.
 * @sideEffects None.
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error(
      "useSubscription must be used inside SubscriptionProvider.",
    );
  }

  return context;
}
