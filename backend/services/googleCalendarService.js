import { google } from "googleapis";

function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) {
    return null;
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return {
    auth,
    calendar: google.calendar({ version: "v3", auth }),
    calendarId,
  };
}

export async function createDoctorVisitCalendarEvent({
  appointment,
  caregiverEmail = null,
  calendarId = process.env.GOOGLE_CALENDAR_ID,
}) {
  if (!appointment || !appointment.appointmentDate || !calendarId) {
    return null;
  }

  const client = getCalendarClient();

  if (!client) {
    return null;
  }

  const startingAt = new Date(appointment.appointmentDate);
  const endingAt = new Date(startingAt.getTime() + 60 * 60 * 1000);

  const isServiceAccountMode = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.includes("gserviceaccount.com"),
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

  if (caregiverEmail && !isServiceAccountMode) {
    eventBody.attendees = [{ email: caregiverEmail }];
  }

  try {
    const response = await client.calendar.events.insert({
      calendarId,
      requestBody: eventBody,
      sendUpdates: caregiverEmail && !isServiceAccountMode ? "all" : undefined,
    });

    return response.data;
  } catch (error) {
    console.error("Google Calendar event creation failed:", error);
    return null;
  }
}

export async function deleteCalendarEvent(eventId, calendarId = process.env.GOOGLE_CALENDAR_ID) {
  if (!eventId || !calendarId) {
    return null;
  }

  const client = getCalendarClient();

  if (!client) {
    return null;
  }

  try {
    await client.calendar.events.delete({
      calendarId,
      eventId,
    });

    return { deleted: true };
  } catch (error) {
    console.error("Google Calendar event deletion failed:", error);
    return null;
  }
}
