// tests/compassAngle.test.ts
// utils/compassAngle.ts の単体テスト（角度の最短差分・矢印表示角度の正規化）

import { test } from "node:test";
import assert from "node:assert/strict";
import { shortestAngleDelta, calcArrowAngle } from "../utils/compassAngle";

test("shortestAngleDelta: 差が0の場合は0を返す", () => {
  assert.equal(shortestAngleDelta(10, 10), 0);
});

test("shortestAngleDelta: 通常の差分（10→30）は+20", () => {
  assert.equal(shortestAngleDelta(10, 30), 20);
});

test("shortestAngleDelta: 通常の差分（30→10）は-20", () => {
  assert.equal(shortestAngleDelta(30, 10), -20);
});

test("shortestAngleDelta: 0度跨ぎ（350→10）は最短+20（340ではない）", () => {
  const delta = shortestAngleDelta(350, 10);
  assert.equal(delta, 20);
});

test("shortestAngleDelta: 0度跨ぎ（10→350）は最短-20", () => {
  const delta = shortestAngleDelta(10, 350);
  assert.equal(delta, -20);
});

test("shortestAngleDelta: ちょうど180度差は180（-180にならない、回転方向が一定）", () => {
  const delta = shortestAngleDelta(0, 180);
  assert.equal(delta, 180);
});

test("shortestAngleDelta: ちょうど180度差（逆方向から見た場合）も180に揃える", () => {
  const delta = shortestAngleDelta(180, 0);
  assert.equal(delta, 180);
});

test("shortestAngleDelta: 戻り値は常に-180〜180の範囲", () => {
  for (let from = 0; from < 360; from += 37) {
    for (let to = 0; to < 360; to += 53) {
      const delta = shortestAngleDelta(from, to);
      assert.ok(delta > -180 - 1e-9 && delta <= 180 + 1e-9, `delta out of range: ${delta} (from=${from}, to=${to})`);
    }
  }
});

test("calcArrowAngle: 目的地方位と端末方位が同じなら0度（矢印は真上=前方を指す）", () => {
  assert.equal(calcArrowAngle(90, 90), 0);
});

test("calcArrowAngle: 目的地が北(0度)、端末が東(90度)を向いていれば270度", () => {
  // 矢印角度 = 目的地方位 - 端末方位 を 0〜360 に正規化
  assert.equal(calcArrowAngle(0, 90), 270);
});

test("calcArrowAngle: 負の差分も0〜360度に正規化される", () => {
  const angle = calcArrowAngle(10, 350);
  assert.equal(angle, 20);
});

test("calcArrowAngle: 戻り値は常に0以上360未満（一回転しない前提のための正規化確認）", () => {
  for (let target = 0; target < 360; target += 41) {
    for (let heading = 0; heading < 360; heading += 59) {
      const angle = calcArrowAngle(target, heading);
      assert.ok(angle >= 0 && angle < 360, `angle out of range: ${angle}`);
    }
  }
});

test("calcArrowAngle: 360度ちょうどの境界（例 360 - 0）は0に正規化される", () => {
  const angle = calcArrowAngle(360, 0);
  assert.equal(angle, 0);
});
