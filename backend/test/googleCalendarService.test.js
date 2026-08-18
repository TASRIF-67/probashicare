import assert from "node:assert/strict";
import test from "node:test";
import {
  checkGoogleCalendarAccess,
  createDoctorVisitCalendarEvent,
} from "../services/googleCalendarService.js";

/**
 * Temporarily removes Calendar variables so optional-integration behavior can be tested.
 * @returns {() => void} Function that restores the original environment values.
 * @sideEffects Changes three process environment variables until the returned function runs.
 */
function removeCalendarEnvironment() {
  const originalValues = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  };

  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_CALENDAR_ID;

  /**
   * Restores Calendar variables after one test.
   * @returns {void}
   * @sideEffects Restores process environment variables.
   */
  function restoreEnvironment() {
    const entries = [
      ["GOOGLE_SERVICE_ACCOUNT_EMAIL", originalValues.email],
      ["GOOGLE_PRIVATE_KEY", originalValues.privateKey],
      ["GOOGLE_CALENDAR_ID", originalValues.calendarId],
    ];

    for (const [name, value] of entries) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }

  return restoreEnvironment;
}

test(
  "calendar access reports disabled when optional settings are missing",
  async () => {
    const restoreEnvironment = removeCalendarEnvironment();

    try {
      const result = await checkGoogleCalendarAccess();

      assert.equal(result.status, "disabled");
      assert.equal(result.errorCode, null);
    } finally {
      restoreEnvironment();
    }
  },
);

test(
  "appointment creation remains available when Calendar is disabled",
  async () => {
    const restoreEnvironment = removeCalendarEnvironment();

    try {
      const result = await createDoctorVisitCalendarEvent({
        appointment: {
          appointmentDate: "2026-08-21T07:30:00.000Z",
        },
      });

      assert.equal(result.status, "disabled");
      assert.equal(result.event, null);
    } finally {
      restoreEnvironment();
    }
  },
);
