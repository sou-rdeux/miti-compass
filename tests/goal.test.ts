// tests/goal.test.ts
// utils/goal.ts の単体テスト（ゴール判定）
// GOAL_RADIUS_METERS は utils/constants.ts で 20 と定義されている前提のテスト。

import { test } from "node:test";
import assert from "node:assert/strict";
import { isGoalReached } from "../utils/goal";
import { GOAL_RADIUS_METERS } from "../utils/constants";

test("GOAL_RADIUS_METERSは仕様通り20mである", () => {
  assert.equal(GOAL_RADIUS_METERS, 20);
});

test("距離0mはゴール判定true", () => {
  assert.equal(isGoalReached(0), true);
});

test("距離がGOAL_RADIUS_METERSちょうど（20m）はゴール判定true（境界は以内側に含む）", () => {
  assert.equal(isGoalReached(GOAL_RADIUS_METERS), true);
});

test("距離がGOAL_RADIUS_METERSをわずかに超える（20.01m）はゴール判定false", () => {
  assert.equal(isGoalReached(GOAL_RADIUS_METERS + 0.01), false);
});

test("距離が十分遠い（425m）はゴール判定false", () => {
  assert.equal(isGoalReached(425), false);
});

test("距離が19.99mはゴール判定true", () => {
  assert.equal(isGoalReached(19.99), true);
});
