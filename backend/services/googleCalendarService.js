import { google } from "googleapis";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Builds an authenticated Google Calendar client from optional environment values.
 * @returns {{calendar: import("googleapis").calendar_v3.Calendar, calendarId: string, clientEmail: string}|null} Configured client details, or null when Calendar integration is disabled.
 * @sideEffects Creates an in-memory Google authentication client.
 */
function getCalendarClient() {
  const clientEmail = String(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  ).trim();
  const privateKey = String(
    process.env.GOOGLE_PRIVATE_KEY || "",
  )
    .replace(/\\n/g, "\n")
    .trim();
  const calendarId = String(
    process.env.GOOGLE_CALENDAR_ID || "",
  ).trim();

  if (!clientEmail || !privateKey || !calendarId) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [CALENDAR_SCOPE],
  });

  return {
    calendar: google.calendar({
      version: "v3",
      auth,
    }),
    calendarId,
    clientEmail,
  };
}

/**
 * Converts a Google SDK error into a short, safe message for logs and API responses.
 * @param {unknown} error - Error returned by the Google Calendar SDK.
 * @returns {{errorCode: number|null, message: string}} Safe status code and explanation.
 * @sideEffects None.
 */
function describeCalendarError(error) {
  const responseStatus = Number(error?.response?.status);
  const directStatus = Number(error?.code);
  let errorCode = null;

  if (Number.isFinite(responseStatus) && responseStatus > 0) {
    errorCode = responseStatus;
  } else if (Number.isFinite(directStatus) && directStatus > 0) {
    errorCode = directStatus;
  }

  if (errorCode === 404) {
    return {
      errorCode,
      message:
        "The configured calendar was not found or has not been shared with the service account.",
    };
  }

  if (errorCode === 403) {
    return {
      errorCode,
      message:
        "The service account does not have permission to change the configured calendar.",
    };
  }

  if (errorCode === 401) {
    return {
      errorCode,
      message:
        "Google rejected the configured service-account credentials.",
    };
  }

  return {
    errorCode,
    message:
      "Google Calendar could not be reached. The ProbashiCare appointment was still saved.",
  };
}

/**
 * Returns a standard response when optional Google Calendar settings are absent.
 * @returns {{status: "disabled", event: null, errorCode: null, message: string}} Disabled synchronization result.
 * @sideEffects None.
 */
function createDisabledResult() {
  return {
    status: "disabled",
    event: null,
    errorCode: null,
    message:
      "Google Calendar is not configured. The appointment was saved in ProbashiCare only.",
  };
}

/**
 * Checks whether the configured service account can open the configured calendar.
 * @returns {Promise<{status: "available"|"disabled"|"failed", calendarId: string|null, clientEmail: string|null, errorCode: number|null, message: string}>} Calendar-access diagnostic result.
 * @sideEffects Sends one read request to the Google Calendar API when configured.
 */
export async function checkGoogleCalendarAccess() {
  const client = getCalendarClient();

  if (!client) {
    return {
      status: "disabled",
      calendarId: null,
      clientEmail: null,
      errorCode: null,
      message:
        "Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID first.",
    };
  }

  try {
    await client.calendar.calendars.get(
      {
        calendarId: client.calendarId,
      },
      {
        retry: false,
      },
    );

    return {
      status: "available",
      calendarId: client.calendarId,
      clientEmail: client.clientEmail,
      errorCode: null,
      message:
        "The service account can access the configured Google Calendar.",
    };
  } catch (error) {
    const details = describeCalendarError(error);

    return {
      status: "failed",
      calendarId: client.calendarId,
      clientEmail: client.clientEmail,
      errorCode: details.errorCode,
      message: details.message,
    };
  }
}

/**
 * Creates a one-hour Google Calendar event for a saved doctor appointment.
 * @param {{appointment: object, caregiverEmail?: string|null}} options - Populated appointment and optional caregiver email.
 * @returns {Promise<{status: "synced"|"disabled"|"failed", event: object|null, errorCode: number|null, message: string}>} Synchronization result and created event when successful.
 * @sideEffects May create a Google Calendar event and writes one concise warning on failure.
 */
export async function createDoctorVisitCalendarEvent({
  appointment,
  caregiverEmail = null,
}) {
  const client = getCalendarClient();

  if (!client) {
    return createDisabledResult();
  }

  if (!appointment || !appointment.appointmentDate) {
    return {
      status: "failed",
      event: null,
      errorCode: null,
      message:
        "The appointment does not contain a valid date for Calendar synchronization.",
    };
  }

  const startingAt = new Date(appointment.appointmentDate);

  if (Number.isNaN(startingAt.getTime())) {
    return {
      status: "failed",
      event: null,
      errorCode: null,
      message:
        "The appointment date could not be converted for Google Calendar.",
    };
  }

  const endingAt = new Date(
    startingAt.getTime() + 60 * 60 * 1000,
  );
  const isServiceAccount = client.clientEmail.includes(
    "gserviceaccount.com",
  );
  const eventBody = {
    summary: `Doctor Visit - ${appointment.doctorName}`,
    location: `${appointment.clinicName}, ${appointment.clinicAddress}`,
    description: [
      `Doctor: ${appointment.doctorName}`,
      `Specialty: ${appointment.specialty}`,
      `Clinic: ${appointment.clinicName}`,
      `Contact: ${appointment.contactPhone}`,
      `Notes: ${appointment.notes || "None provided"}`,
    ].join("\n"),
    start: {
      dateTime: startingAt.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: endingAt.toISOString(),
      timeZone: "UTC",
    },
    reminders: {
      useDefault: true,
    },
  };

  // A service account cannot invite attendees without domain-wide delegation.
  if (caregiverEmail && !isServiceAccount) {
    eventBody.attendees = [
      {
        email: caregiverEmail,
      },
    ];
  }

  try {
    const response = await client.calendar.events.insert(
      {
        calendarId: client.calendarId,
        requestBody: eventBody,
        sendUpdates:
          caregiverEmail && !isServiceAccount
            ? "all"
            : undefined,
      },
      {
        retry: false,
      },
    );

    return {
      status: "synced",
      event: response.data,
      errorCode: null,
      message:
        "The appointment was added to the configured Google Calendar.",
    };
  } catch (error) {
    const details = describeCalendarError(error);

    console.warn(
      `[Google Calendar] Event was not created: ${details.message}`,
    );

    return {
      status: "failed",
      event: null,
      errorCode: details.errorCode,
      message: details.message,
    };
  }
}

/**
 * Deletes a previously synchronized Google Calendar event.
 * @param {string|null|undefined} eventId - Google event identifier saved on the appointment.
 * @returns {Promise<{status: "deleted"|"disabled"|"failed", errorCode: number|null, message: string}>} Calendar deletion result.
 * @sideEffects May delete a Google Calendar event and writes one concise warning on failure.
 */
export async function deleteCalendarEvent(eventId) {
  const client = getCalendarClient();

  if (!client || !eventId) {
    return {
      status: "disabled",
      errorCode: null,
      message:
        "There was no configured Google Calendar event to remove.",
    };
  }

  try {
    await client.calendar.events.delete(
      {
        calendarId: client.calendarId,
        eventId,
      },
      {
        retry: false,
      },
    );

    return {
      status: "deleted",
      errorCode: null,
      message:
        "The linked Google Calendar event was removed.",
    };
  } catch (error) {
    const details = describeCalendarError(error);

    console.warn(
      `[Google Calendar] Event was not deleted: ${details.message}`,
    );

    return {
      status: "failed",
      errorCode: details.errorCode,
      message: details.message,
    };
  }
}
