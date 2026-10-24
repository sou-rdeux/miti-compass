// tests/distance.test.ts
// utils/distance.ts の単体テスト（Haversine formula）

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcDistanceMeters } from "../utils/distance";

test("同一地点の距離は0になる", () => {
  const p = { lat: 35.6895, lng: 139.6917 };
  const d = calcDistanceMeters(p, p);
  assert.ok(Math.abs(d) < 1e-6, `distance should be ~0 but was ${d}`);
});

test("東京駅→新宿駅のおおよその距離（約6.4km前後）", () => {
  const tokyoStation = { lat: 35.681236, lng: 139.767125 };
  const shinjukuStation = { lat: 35.690921, lng: 139.700257 };
  const d = calcDistanceMeters(tokyoStation, shinjukuStation);
  // 実測の直線距離はおよそ6.0〜6.5km程度
  assert.ok(d > 5500 && d < 7000, `distance out of expected range: ${d}`);
});

test("緯度1度分の距離はおよそ111km", () => {
  const from = { lat: 0, lng: 0 };
  const to = { lat: 1, lng: 0 };
  const d = calcDistanceMeters(from, to);
  assert.ok(d > 110500 && d < 111500, `distance out of expected range: ${d}`);
});

test("距離は対称（from/toを入れ替えても同じ値）", () => {
  const a = { lat: 35.0, lng: 135.0 };
  const b = { lat: 36.0, lng: 136.0 };
  const d1 = calcDistanceMeters(a, b);
  const d2 = calcDistanceMeters(b, a);
  assert.ok(Math.abs(d1 - d2) < 1e-9, `distance should be symmetric: ${d1} vs ${d2}`);
});

test("20m以内のごく短い距離も正しく小さい値になる（ゴール判定の境界確認用）", () => {
  // 緯度1度 ≈ 111320m なので、約0.00018度 ≈ 20mに相当
  const from = { lat: 35.0, lng: 135.0 };
  const to = { lat: 35.00018, lng: 135.0 };
  const d = calcDistanceMeters(from, to);
  assert.ok(d > 15 && d < 25, `distance out of expected range for ~20m case: ${d}`);
});
