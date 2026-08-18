import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./styles/global.css";
import "./styles/modern-theme.css";
import "./styles/grocery.css";
import "./styles/dashboard.css";
import "./styles/navigation.css";
import "./styles/doctor-appointments.css";

/**
 * Mounts the React application with its global providers.
 * @param {HTMLElement} rootElement - Existing `#root` DOM node.
 * @returns {void}
 * @sideEffects Creates a React root and renders into the document.
 */
function mountApplication(rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "google-client-id-not-configured"}>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </StrictMode>,
  );
}

mountApplication(document.getElementById("root"));
