import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import elderlyProfileRoutes from "./routes/elderlyProfileRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import caregiverRoutes from "./routes/caregiverRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import wellnessReportRoutes from "./routes/wellnessReportRoutes.js";
import wellnessInsightRoutes from "./routes/wellnessInsightRoutes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/**
 * GET /api/health
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { status: "ok" } }`.
 * Failure: shared standard error shape if middleware fails.
 * Auth: public; intended for uptime checks and contains no sensitive state.
 * @param {import("express").Request} _request - Express request, unused.
 * @param {import("express").Response} response - Express response writer.
 * @returns {void}
 * @sideEffects Sends an HTTP response without reading the database.
 */
function healthCheck(_request, response) {
  response.json({ success: true, data: { status: "ok" } });
}

app.get("/api/health", healthCheck);
app.use("/api/auth", authRoutes);
app.use("/api/elderly-profiles", elderlyProfileRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/wellness-reports", wellnessReportRoutes);
app.use("/api", wellnessInsightRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
