import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, accentInk, onColor, parsePreferences } from "../features/space/preferences";
test("corrupt and stale persisted preferences restore a complete usable navigation", () => {
  assert.deepEqual(parsePreferences("broken-json"), defaults);
  const result = parsePreferences(JSON.stringify({ color:"not-a-color", order:["tasks", "tasks", "missing"], hidden:["overview", "journey", "unknown"], dark:"yes" }));
  assert.equal(result.color, defaults.color);
  assert.deepEqual(result.hidden, ["journey"]);
  assert.equal(result.order[0], "tasks");
  assert.equal(new Set(result.order).size, defaults.order.length);
  assert.ok(result.order.includes("overview"));
  assert.equal(result.dark, false);
});
test("valid navigation order, visibility and appearance survive serialization", () => {
  const value = { ...defaults, color:"#4a154b", dark:true, compact:true, collapsed:true, hidden:["calendar"], order:[...defaults.order].reverse() };
  assert.deepEqual(parsePreferences(JSON.stringify(value)), value);
});
test("custom light and dark brand colors choose readable foregrounds", () => {
  assert.equal(onColor("#ffffff"), "#17191c");
  assert.equal(onColor("#ffff00"), "#17191c");
  assert.equal(onColor("#12658a"), "#ffffff");
  assert.equal(onColor("#4a154b"), "#ffffff");
  assert.equal(accentInk("#ffff00"), "#17191c");
  assert.equal(accentInk("#12658a"), "#ffffff");
});
