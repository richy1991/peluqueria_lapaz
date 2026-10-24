import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBusinessHours,
  getBusinessHourError,
  isBusinessOpenNow,
  prepareBusinessHourForSave,
  resolveBusinessStatus,
} from "../lib/business-hours.ts";

const friday = {
  weekday: 5,
  active: true,
  opens_at: "09:00:00",
  closes_at: "13:00:00",
  afternoon_opens_at: "14:00:00",
  afternoon_closes_at: "20:00:00",
};
const localTime = (time) => new Date(`2026-10-23T${time}:00-04:00`);

test("opens at each shift start and closes during lunch and at final closing", () => {
  const expectations = [
    ["08:59", false], ["09:00", true], ["12:59", true],
    ["13:00", false], ["13:30", false], ["13:59", false],
    ["14:00", true], ["19:59", true], ["20:00", false],
  ];
  for (const [time, expected] of expectations) {
    assert.equal(isBusinessOpenNow([friday], "America/La_Paz", localTime(time)), expected, time);
  }
});

test("uses the configured variable lunch break instead of a fixed noon interval", () => {
  const day = { ...friday, closes_at: "12:15", afternoon_opens_at: "13:45" };
  assert.equal(isBusinessOpenNow([day], "America/La_Paz", localTime("12:14")), true);
  assert.equal(isBusinessOpenNow([day], "America/La_Paz", localTime("12:15")), false);
  assert.equal(isBusinessOpenNow([day], "America/La_Paz", localTime("13:30")), false);
  assert.equal(isBusinessOpenNow([day], "America/La_Paz", localTime("13:45")), true);
});

test("supports one continuous shift and ignores inactive days", () => {
  const day = { ...friday, closes_at: "20:00", afternoon_opens_at: null, afternoon_closes_at: null };
  assert.equal(isBusinessOpenNow([day], "America/La_Paz", localTime("13:30")), true);
  assert.equal(isBusinessOpenNow([{ ...day, active: false }], "America/La_Paz", localTime("10:00")), false);
  assert.equal(isBusinessOpenNow([], "America/La_Paz", localTime("10:00")), false);
});

test("preserves existing hours when afternoon columns have not been migrated yet", () => {
  const legacyDay = { weekday: 5, active: true, opens_at: "09:00:00", closes_at: "20:00:00" };
  assert.equal(isBusinessOpenNow([legacyDay], "America/La_Paz", localTime("13:30")), true);
  assert.equal(formatBusinessHours([legacyDay]), "Viernes · 09:00–20:00");
  assert.deepEqual(prepareBusinessHourForSave(legacyDay), {
    weekday: 5, active: true, opens_at: "09:00", closes_at: "20:00",
    afternoon_opens_at: null, afternoon_closes_at: null,
  });
});

test("uses La Paz weekday and clock time, including the UTC date boundary", () => {
  const lateFriday = { ...friday, afternoon_closes_at: "23:00" };
  assert.equal(isBusinessOpenNow([lateFriday], "America/La_Paz", new Date("2026-10-24T01:00:00Z")), true);
  assert.equal(isBusinessOpenNow([friday], "America/La_Paz", new Date("2026-10-23T13:00:00Z")), true);
  assert.equal(isBusinessOpenNow([friday], "invalid-zone", new Date("2026-10-23T17:30:00Z")), false);
});

test("manual closures take priority and appointment-only status follows both shifts", () => {
  for (const status of ["closed", "emergency_closed"]) {
    assert.equal(resolveBusinessStatus(status, [friday], "America/La_Paz", localTime("10:00")), status);
    assert.equal(resolveBusinessStatus(status, [friday], "America/La_Paz", localTime("15:00")), status);
  }
  assert.equal(resolveBusinessStatus("open", [friday], "America/La_Paz", localTime("13:30")), "schedule_closed");
  assert.equal(resolveBusinessStatus("appointment_only", [friday], "America/La_Paz", localTime("10:00")), "appointment_only");
  assert.equal(resolveBusinessStatus("appointment_only", [friday], "America/La_Paz", localTime("15:00")), "appointment_only");
  assert.equal(resolveBusinessStatus("appointment_only", [friday], "America/La_Paz", localTime("13:30")), "schedule_closed");
});

test("public hours include both shifts and the exact lunch closure", () => {
  assert.equal(formatBusinessHours([{ ...friday, weekday: 2 }]), "Martes · 09:00–13:00 y 14:00–20:00 (descanso: 13:00–14:00)");
  assert.equal(formatBusinessHours([{ ...friday, afternoon_opens_at: null, afternoon_closes_at: null }]), "Viernes · 09:00–13:00");
  assert.equal(formatBusinessHours([{ ...friday, active: false }]), "Cerrado todos los días");
});

test("groups consecutive days only when their morning and afternoon schedules match", () => {
  const result = formatBusinessHours([
    { ...friday, weekday: 4, afternoon_opens_at: "14:30:00" },
    { ...friday, weekday: 2 },
    { ...friday, weekday: 3 },
    { ...friday, weekday: 5, active: false },
    { ...friday, weekday: 6 },
  ]);
  assert.equal(result, "Martes y miércoles · 09:00–13:00 y 14:00–20:00 (descanso: 13:00–14:00); Jueves · 09:00–13:00 y 14:30–20:00 (descanso: 13:00–14:30); Sábado · 09:00–13:00 y 14:00–20:00 (descanso: 13:00–14:00)");
});

test("accepts valid split or continuous hours in database and input formats", () => {
  assert.equal(getBusinessHourError(friday), null);
  assert.equal(getBusinessHourError({ ...friday, opens_at: "09:00", closes_at: "13:00" }), null);
  assert.equal(getBusinessHourError({ ...friday, afternoon_opens_at: null, afternoon_closes_at: null }), null);
});

test("rejects missing or unordered morning hours and identifies the affected input", () => {
  assert.equal(getBusinessHourError({ ...friday, opens_at: "" })?.field, "opens_at");
  assert.equal(getBusinessHourError({ ...friday, closes_at: "" })?.field, "closes_at");
  assert.equal(getBusinessHourError({ ...friday, opens_at: "13:00", closes_at: "13:00:00" })?.field, "closes_at");
  assert.equal(getBusinessHourError({ ...friday, opens_at: "14:00", closes_at: "13:00" })?.field, "closes_at");
});

test("requires both afternoon hours and rejects overlap or a missing lunch gap", () => {
  assert.equal(getBusinessHourError({ ...friday, afternoon_opens_at: null })?.field, "afternoon_opens_at");
  assert.equal(getBusinessHourError({ ...friday, afternoon_closes_at: null })?.field, "afternoon_closes_at");
  assert.equal(getBusinessHourError({ ...friday, afternoon_opens_at: "12:30" })?.field, "afternoon_opens_at");
  assert.equal(getBusinessHourError({ ...friday, closes_at: "13:00", afternoon_opens_at: "13:00:00" })?.field, "afternoon_opens_at");
  assert.equal(getBusinessHourError({ ...friday, afternoon_opens_at: "20:00", afternoon_closes_at: "20:00:00" })?.field, "afternoon_closes_at");
});

test("normalizes saved times without changing the selected schedule", () => {
  const result = prepareBusinessHourForSave(friday);
  assert.deepEqual(result, {
    weekday: 5, active: true, opens_at: "09:00", closes_at: "13:00",
    afternoon_opens_at: "14:00", afternoon_closes_at: "20:00",
  });
  const continuous = prepareBusinessHourForSave({ ...friday, afternoon_opens_at: "", afternoon_closes_at: "" });
  assert.equal(continuous.afternoon_opens_at, null);
  assert.equal(continuous.afternoon_closes_at, null);
});

test("closing a day with an unfinished edit preserves its saved valid hours", () => {
  const invalidClosedDay = { ...friday, active: false, opens_at: "", afternoon_closes_at: null };
  const result = prepareBusinessHourForSave(invalidClosedDay, friday);
  assert.deepEqual(result, { ...prepareBusinessHourForSave(friday), active: false });
  assert.equal(getBusinessHourError(result), null);
  assert.equal(friday.active, true);
  assert.equal(invalidClosedDay.opens_at, "");
});

test("closing an unsaved day with invalid hours still produces a valid closed day", () => {
  const result = prepareBusinessHourForSave({ ...friday, active: false, closes_at: "", afternoon_opens_at: null });
  assert.equal(result.active, false);
  assert.equal(result.weekday, friday.weekday);
  assert.equal(getBusinessHourError(result), null);
});
