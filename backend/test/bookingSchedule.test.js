import test from "node:test";
import assert from "node:assert/strict";
import { buildOccurrences, buildReservationDocuments, dateKey, parseDateOnly, parseTimeSlot, weekday } from "../utils/bookingSchedule.js";

test("date-only parsing rejects impossible and ambiguous dates", () => {
  assert.equal(parseDateOnly("2026-02-29"), null);
  assert.equal(parseDateOnly("08/12/2026"), null);
  assert.equal(dateKey(parseDateOnly("2028-02-29")), "2028-02-29");
});

test("time slots require valid ascending ranges", () => {
  assert.deepEqual(parseTimeSlot("09:30-11:00"), { start: 570, end: 660 });
  assert.equal(parseTimeSlot("11:00-09:30"), null);
  assert.equal(parseTimeSlot("24:00-25:00"), null);
});

test("one-time occurrence matches its selected calendar weekday", () => {
  const startDate = parseDateOnly("2026-08-10");
  assert.equal(weekday(startDate), "monday");
  assert.deepEqual(buildOccurrences({ bookingType: "one-time", startDate, endDate: startDate, slots: [{ weekday: "monday", startTime: "09:00", endTime: "10:00" }] }).map((entry) => [dateKey(entry.date), entry.timeSlot]), [["2026-08-10", "09:00-10:00"]]);
  assert.equal(buildOccurrences({ bookingType: "one-time", startDate, endDate: startDate, slots: [{ weekday: "tuesday", startTime: "09:00", endTime: "10:00" }] }).length, 0);
});

test("weekly schedules contain only selected weekdays within the range", () => {
  const occurrences = buildOccurrences({ bookingType: "scheduled", startDate: parseDateOnly("2026-08-10"), endDate: parseDateOnly("2026-08-23"), slots: [{ weekday: "monday", startTime: "09:00", endTime: "10:00" }, { weekday: "wednesday", startTime: "14:00", endTime: "16:00" }] });
  assert.deepEqual(occurrences.map((entry) => dateKey(entry.date)), ["2026-08-10", "2026-08-12", "2026-08-17", "2026-08-19"]);
});

test("reservations conflict only on the same caregiver, date, and overlapping minute", () => {
  const documents = buildReservationDocuments({ bookingId: "booking-a", caregiverId: "caregiver-a", occurrences: [{ date: parseDateOnly("2026-08-10"), timeSlot: "09:00-10:00" }, { date: parseDateOnly("2026-08-17"), timeSlot: "09:00-10:00" }] });
  assert.equal(documents.length, 120);
  assert.equal(documents.filter((item) => dateKey(item.occurrenceDate) === "2026-08-10").at(-1).minute, 599);
  assert.equal(documents.some((item) => dateKey(item.occurrenceDate) === "2026-08-11"), false);
});
