// tests/bearing.test.ts
// utils/bearing.ts の単体テスト（初期方位角 initial bearing）

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcInitialBearing } from "../utils/bearing";

function assertCloseTo(actual: number, expected: number, tolerance: number, message: string) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${message}: expected ~${expected}, got ${actual}`
  );
}

test("真北方向（toの緯度が高く、経度が同じ）は0度に近い", () => {
  const from = { lat: 35.0, lng: 135.0 };
  const to = { lat: 36.0, lng: 135.0 };
  const bearing = calcInitialBearing(from, to);
  assertCloseTo(bearing, 0, 1, "北方向の方位");
});

test("真南方向（toの緯度が低く、経度が同じ）は180度に近い", () => {
  const from = { lat: 35.0, lng: 135.0 };
  const to = { lat: 34.0, lng: 135.0 };
  const bearing = calcInitialBearing(from, to);
  assertCloseTo(bearing, 180, 1, "南方向の方位");
});

test("赤道上での真東方向（緯度が同じ、経度が高い）は90度に近い", () => {
  const from = { lat: 0, lng: 135.0 };
  const to = { lat: 0, lng: 136.0 };
  const bearing = calcInitialBearing(from, to);
  assertCloseTo(bearing, 90, 1, "東方向の方位");
});

test("赤道上での真西方向（緯度が同じ、経度が低い）は270度に近い", () => {
  const from = { lat: 0, lng: 135.0 };
  const to = { lat: 0, lng: 134.0 };
  const bearing = calcInitialBearing(from, to);
  assertCloseTo(bearing, 270, 1, "西方向の方位");
});

test("戻り値は常に0〜360度の範囲（負の値にならない）", () => {
  // from/toを多数組み合わせて範囲外にならないか確認
  const points = [
    { lat: 35.0, lng: 135.0 },
    { lat: -10.0, lng: -50.0 },
    { lat: 80.0, lng: 170.0 },
    { lat: -80.0, lng: -170.0 },
  ];
  for (const from of points) {
    for (const to of points) {
      if (from === to) continue;
      const bearing = calcInitialBearing(from, to);
      assert.ok(bearing >= 0 && bearing < 360, `bearing out of range: ${bearing}`);
    }
  }
});
