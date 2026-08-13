import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarMonths,
  calculateSubscriptionPeriodEnd,
  selectRenewalStart,
} from "../utils/subscriptionPeriod.js";

test("Day Pass adds exactly twenty-four hours", () => {
  const start = new Date("2026-08-12T10:30:00.000Z");
  const end = calculateSubscriptionPeriodEnd(start, "hours", 24);

  assert.equal(end.toISOString(), "2026-08-13T10:30:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
});

test("monthly calculation clamps January 31 safely", () => {
  const end = addCalendarMonths("2026-01-31T09:15:00.000Z", 1);
  assert.equal(end.toISOString(), "2026-02-28T09:15:00.000Z");
});

test("monthly calculation supports leap-year February", () => {
  const end = addCalendarMonths("2028-01-31T09:15:00.000Z", 1);
  assert.equal(end.toISOString(), "2028-02-29T09:15:00.000Z");
});

test("yearly calculation safely clamps a leap day", () => {
  const end = calculateSubscriptionPeriodEnd(
    "2028-02-29T18:00:00.000Z",
    "years",
    1,
  );
  assert.equal(end.toISOString(), "2029-02-28T18:00:00.000Z");
});

test("early renewal extends from a future expiry", () => {
  const start = selectRenewalStart(
    "2026-08-12T10:00:00.000Z",
    "2026-08-20T10:00:00.000Z",
  );
  assert.equal(start.toISOString(), "2026-08-20T10:00:00.000Z");
});

test("expired renewal begins at payment completion", () => {
  const start = selectRenewalStart(
    "2026-08-12T10:00:00.000Z",
    "2026-08-01T10:00:00.000Z",
  );
  assert.equal(start.toISOString(), "2026-08-12T10:00:00.000Z");
});
