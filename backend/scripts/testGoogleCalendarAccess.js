import "dotenv/config";
import { checkGoogleCalendarAccess } from "../services/googleCalendarService.js";

/**
 * Checks the configured Google Calendar without creating or deleting an event.
 * @returns {Promise<void>}
 * @sideEffects Sends one Google Calendar API request and writes the result to the terminal.
 */
async function testGoogleCalendarAccess() {
  const result = await checkGoogleCalendarAccess();

  console.log(result.message);

  if (result.status === "available") {
    console.log(`Calendar ID: ${result.calendarId}`);
    console.log(`Service account: ${result.clientEmail}`);
    return;
  }

  if (result.status === "failed") {
    console.error(
      `Calendar access check failed${result.errorCode ? ` (HTTP ${result.errorCode})` : ""}.`,
    );
    process.exitCode = 1;
    return;
  }

  process.exitCode = 1;
}

testGoogleCalendarAccess().catch((error) => {
  console.error(
    "Calendar access check could not run:",
    error.message,
  );
  process.exitCode = 1;
});
