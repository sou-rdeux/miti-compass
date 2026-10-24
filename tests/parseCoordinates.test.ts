// tests/parseCoordinates.test.ts
// utils/parseCoordinates.ts の単体テスト（座標の貼り付け対応・spec.md 15章）

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCoordinates } from "../utils/parseCoordinates";

test("半角カッコ・カンマ・スペース付き形式を2値として検出する", () => {
  const result = parseCoordinates("(35.1371196, 138.6607245)");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("カッコなし（カンマ・スペースのみ）を2値として検出する", () => {
  const result = parseCoordinates("35.1371196, 138.6607245");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("カンマのみ・スペースなしを2値として検出する", () => {
  const result = parseCoordinates("35.1371196,138.6607245");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("全角カッコ・全角カンマ・全角スペースが混在していても2値として検出する", () => {
  const result = parseCoordinates("（35.1371196，　138.6607245）");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("スペース区切りのみ（カンマなし）でも2値として検出する（15.4節4項）", () => {
  const result = parseCoordinates("35.1371196 138.6607245");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("数値1個のみの貼り付けはsingleとして検出する", () => {
  const result = parseCoordinates("35.1371196");
  assert.deepEqual(result, { kind: "single", value: 35.1371196 });
});

test("数値0個（数字を含まない文字列）はnoneとして検出する", () => {
  const result = parseCoordinates("東京タワー");
  assert.deepEqual(result, { kind: "none" });
});

test("数値3個以上の貼り付けはnoneとして検出する", () => {
  const result = parseCoordinates("35.1371196, 138.6607245, 100");
  assert.deepEqual(result, { kind: "none" });
});

test("空文字列はnoneとして検出する", () => {
  const result = parseCoordinates("");
  assert.deepEqual(result, { kind: "none" });
});

test("負の値（南半球・西経相当）も2値として検出する", () => {
  const result = parseCoordinates("-35.12, -138.91");
  assert.deepEqual(result, { kind: "pair", lat: -35.12, lng: -138.91 });
});

test("全角マイナス（U+FF0D）を含む負の値も2値として検出する", () => {
  const result = parseCoordinates("－35.12，－138.91");
  assert.deepEqual(result, { kind: "pair", lat: -35.12, lng: -138.91 });
});

test("マイナス記号（U+2212）を含む負の値も2値として検出する", () => {
  const result = parseCoordinates("−35.12, −138.91");
  assert.deepEqual(result, { kind: "pair", lat: -35.12, lng: -138.91 });
});

test("全角数字・全角小数点混在でも2値として検出する", () => {
  const result = parseCoordinates("３５．１２，１３８．９１");
  assert.deepEqual(result, { kind: "pair", lat: 35.12, lng: 138.91 });
});

test("2値検出時は1番目が緯度、2番目が経度として固定される（順序の確認）", () => {
  const result = parseCoordinates("1.5, 2.5");
  assert.equal(result.kind, "pair");
  if (result.kind === "pair") {
    assert.equal(result.lat, 1.5);
    assert.equal(result.lng, 2.5);
  }
});

test("角括弧・波括弧区切りでも2値として検出する（区切り文字の種類に依存しない）", () => {
  const result = parseCoordinates("[35.1371196, 138.6607245]");
  assert.deepEqual(result, { kind: "pair", lat: 35.1371196, lng: 138.6607245 });
});

test("整数のみ（小数点なし）の2値も検出する", () => {
  const result = parseCoordinates("35, 138");
  assert.deepEqual(result, { kind: "pair", lat: 35, lng: 138 });
});

test("指数表記（1e5等）は数値として抽出されない（整数部のみがマッチする）", () => {
  // 15.2節の正規表現仕様上、指数表記は対象外。"1e5"からは"1"と"5"の2個が抽出される想定
  const result = parseCoordinates("1e5");
  assert.deepEqual(result, { kind: "pair", lat: 1, lng: 5 });
});
