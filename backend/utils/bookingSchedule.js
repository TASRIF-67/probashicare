const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

export function parseDateOnly(value) {
  const match = DATE_PATTERN.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null;
}

export function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function weekday(date) {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getUTCDay()];
}

export function parseTimeSlot(value) {
  if (!TIME_SLOT_PATTERN.test(String(value || ""))) return null;
  const [startText, endText] = value.split("-");
  const toMinutes = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
  const start = toMinutes(startText);
  const end = toMinutes(endText);
  return end > start ? { start, end } : null;
}

export function buildOccurrences({ bookingType, startDate, endDate, slots }) {
  const slotsByDay = new Map(slots.map((slot) => [slot.weekday, `${slot.startTime}-${slot.endTime}`]));
  const occurrences = [];
  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = weekday(cursor);
    const timeSlot = slotsByDay.get(day);
    if (timeSlot) occurrences.push({ date: new Date(cursor), timeSlot });
  }
  if (bookingType === "one-time") return occurrences.slice(0, 1);
  return occurrences;
}

export function occurrenceEndInstant(occurrence) {
  const parsed = parseTimeSlot(occurrence.timeSlot);
  if (!parsed) return null;
  return new Date(occurrence.date.getTime() + parsed.end * 60000);
}

export function buildReservationDocuments({ bookingId, caregiverId, occurrences }) {
  return occurrences.flatMap((occurrence) => {
    const { start, end } = parseTimeSlot(occurrence.timeSlot);
    return Array.from({ length: end - start }, (_, offset) => ({ bookingId, caregiverId, occurrenceDate: occurrence.date, minute: start + offset }));
  });
}
