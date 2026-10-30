import { test } from "node:test";
import assert from "node:assert/strict";
import { memberTime } from "../features/space/member-time";
test("member clocks use their own zone across date boundaries", () => {
  assert.deepEqual(memberTime("Asia/Shanghai", new Date("2026-10-30T20:15:00Z")), { time: "04:15", offset: "UTC+8", date: "10月31日" });
  assert.equal(memberTime("Asia/Kolkata", new Date("2026-10-30T12:00:00Z"))?.time, "17:30");
  assert.equal(memberTime("Asia/Kolkata", new Date("2026-10-30T12:00:00Z"))?.offset, "UTC+5:30");
});
test("London offsets follow daylight saving instead of a fixed offset", () => {
  assert.equal(memberTime("Europe/London", new Date("2026-07-01T12:00:00Z"))?.time, "13:00");
  assert.equal(memberTime("Europe/London", new Date("2026-07-01T12:00:00Z"))?.offset, "UTC+1");
  assert.equal(memberTime("Europe/London", new Date("2026-10-30T12:00:00Z"))?.time, "12:00");
  assert.equal(memberTime("Europe/London", new Date("2026-10-30T12:00:00Z"))?.offset, "UTC+0");
  assert.equal(memberTime("Invalid/Zone", new Date()), undefined);
  assert.equal(memberTime(undefined, new Date()), undefined);
});
