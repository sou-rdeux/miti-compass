// utils/destinationStorage.ts
// 目的地のlocalStorage保存・読み込みを行う純粋関数群（Reactに依存しない）。
// 保存・読み込みのみに責務を限定し、stateやuseEffectのタイミング制御は持たない。
// spec.md 5.7節・16章参照。

export interface StoredDestination {
  lat: number;
  lng: number;
}

/** 保存先のlocalStorageキー */
export const DESTINATION_STORAGE_KEY = "miti-compass:destination:v1";

function isStoredDestination(value: unknown): value is StoredDestination {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { lat, lng } = value as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 目的地をlocalStorageに保存する。失敗しても例外を投げない（内部でcatchして無視する） */
export function saveDestination(destination: StoredDestination): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify(destination)
    );
  } catch {
    // プライベートブラウズ・ストレージ無効化等で例外が発生しても無視する
  }
}

/**
 * localStorageから目的地を読み込む。
 * 以下のいずれかに該当する場合はnullを返す（例外は投げない）：
 * - localStorage自体が使えない（SSR時のwindow未定義、プライベートブラウズ等での例外）
 * - 保存データが存在しない
 * - JSON.parseに失敗する
 * - 形式が不正（lat/lngがnumber型でない、NaN、緯度-90〜90・経度-180〜180の範囲外）
 */
export function loadDestination(): StoredDestination | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DESTINATION_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDestination(parsed)) {
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}
