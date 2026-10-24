// utils/parseCoordinates.ts
// 貼り付け文字列から緯度・経度（または単一の数値）を検出する純粋関数（spec.md 15章参照）

export interface ParsedCoordinatePair {
  kind: "pair";
  lat: number;
  lng: number;
}

export interface ParsedSingleNumber {
  kind: "single";
  value: number;
}

export interface ParsedNone {
  kind: "none";
}

export type ParseCoordinatesResult =
  | ParsedCoordinatePair
  | ParsedSingleNumber
  | ParsedNone;

/** 全角数字（U+FF10-FF19）を半角数字に変換する */
function normalizeFullWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) => {
    const fullWidthCodePoint = char.codePointAt(0);
    if (fullWidthCodePoint === undefined) {
      return char;
    }
    return String.fromCharCode(fullWidthCodePoint - 0xff10 + 0x30);
  });
}

/** 手順1：全角→半角の正規化（数字・小数点・負号・カンマ・丸括弧・全角スペース） */
function normalize(text: string): string {
  let result = normalizeFullWidthDigits(text);
  result = result.replace(/．/g, "."); // 全角小数点
  result = result.replace(/[－−]/g, "-"); // 全角マイナス・マイナス記号
  result = result.replace(/，/g, ","); // 全角カンマ
  result = result.replace(/（/g, "("); // 全角丸括弧（開）
  result = result.replace(/）/g, ")"); // 全角丸括弧（閉）
  result = result.replace(/　/g, " "); // 全角スペース
  return result;
}

/** 手順2：区切り文字・括弧の除去（丸・角・波括弧、カンマを空白1文字に置換） */
function stripDelimiters(text: string): string {
  return text.replace(/[()[\]{},]/g, " ");
}

/** 貼り付け文字列等から数値を検出し、2値・1値・検出不可のいずれかを判別して返す */
export function parseCoordinates(text: string): ParseCoordinatesResult {
  const normalized = normalize(text);
  const stripped = stripDelimiters(normalized);

  const matches = stripped.match(/-?\d+(?:\.\d+)?/g);

  if (matches === null) {
    return { kind: "none" };
  }

  if (matches.length === 2) {
    return { kind: "pair", lat: Number(matches[0]), lng: Number(matches[1]) };
  }

  if (matches.length === 1) {
    return { kind: "single", value: Number(matches[0]) };
  }

  return { kind: "none" };
}
