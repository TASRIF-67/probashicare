import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env, validateEnvironment } from "./config/env.js";

/**
 * Validates configuration, connects MongoDB, and starts the HTTP server.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<import("http").Server>} Listening Node HTTP server.
 * @sideEffects Opens a database connection, binds a network port, and exits on startup failure.
 */
async function startServer() {
  validateEnvironment();
  await connectDatabase();
  return app.listen(env.port, () => {
    console.log(`ProbashiCare API listening on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
