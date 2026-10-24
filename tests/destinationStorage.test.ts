// tests/destinationStorage.test.ts
// utils/destinationStorage.ts の単体テスト（目的地のlocalStorage保存・復元）
// spec.md 5.7節・16章参照。
//
// Node.jsのテストランナーにはブラウザのwindow/localStorageが存在しない。
// これは「SSR環境・windowが存在しない環境」のテストにとってはむしろ都合がよく、
// 何もモックしない状態がそのまま16.4節の「window未定義」ケースの確認になる。
// 一方、正常系・異常系（壊れたJSON・型不正・範囲外・例外発生）を確認するには
// globalThis.window を一時的にモックし、各テスト終了後に必ず元の状態へ戻す。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTINATION_STORAGE_KEY,
  saveDestination,
  loadDestination,
} from "../utils/destinationStorage";

/** テスト用のメモリ内localStorage実装（Storageインターフェースの最小限のサブセット） */
interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

/** getItem/setItemの呼び出しが常に例外を投げるlocalStorage実装（プライベートブラウズ等の模倣） */
function createThrowingStorage(): MemoryStorage {
  return {
    getItem() {
      throw new Error("SecurityError: storage is disabled");
    },
    setItem() {
      throw new Error("SecurityError: storage is disabled");
    },
    removeItem() {
      throw new Error("SecurityError: storage is disabled");
    },
  };
}

interface WindowLike {
  localStorage: MemoryStorage;
}

// globalThisの型にはlib "dom"によりwindowプロパティが既に存在するため、
// any型を使わずunknown経由で最小限の形（WindowLike）として扱う。
const globalWithWindow = globalThis as unknown as { window?: WindowLike };

/**
 * globalThis.windowを指定したstorageを持つモックに差し替えてfnを実行し、
 * 実行後（成功・例外どちらでも）必ず元の状態に戻す。
 */
function withMockedWindow<T>(storage: MemoryStorage, fn: () => T): T {
  const original = globalWithWindow.window;
  globalWithWindow.window = { localStorage: storage };
  try {
    return fn();
  } finally {
    globalWithWindow.window = original;
  }
}

// --- 正常系 ---

test("saveDestinationで保存した値をloadDestinationで同じ値として復元できる", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    saveDestination({ lat: 35.6895, lng: 139.6917 });
    const loaded = loadDestination();
    assert.deepEqual(loaded, { lat: 35.6895, lng: 139.6917 });
  });
});

test("保存キー名はDESTINATION_STORAGE_KEYが指す'miti-compass:destination:v1'である", () => {
  assert.equal(DESTINATION_STORAGE_KEY, "miti-compass:destination:v1");

  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    saveDestination({ lat: 1, lng: 2 });
    const raw = storage.getItem("miti-compass:destination:v1");
    assert.notEqual(raw, null);
  });
});

test("保存データにはlat/lng以外のフィールドを含まない（goalReached等を保存しない）", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    saveDestination({ lat: 35.0, lng: 139.0 });
    const raw = storage.getItem(DESTINATION_STORAGE_KEY);
    assert.notEqual(raw, null);
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed).sort(), ["lat", "lng"]);
  });
});

test("緯度・経度の境界値ちょうど（lat=90, lng=180）も正常に復元できる", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    saveDestination({ lat: 90, lng: 180 });
    assert.deepEqual(loadDestination(), { lat: 90, lng: 180 });
  });
});

test("緯度・経度の境界値ちょうど（lat=-90, lng=-180）も正常に復元できる", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    saveDestination({ lat: -90, lng: -180 });
    assert.deepEqual(loadDestination(), { lat: -90, lng: -180 });
  });
});

test("保存データが存在しない場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    assert.equal(loadDestination(), null);
  });
});

// --- 異常系：壊れたJSON・型不正・範囲外 ---

test("壊れたJSON（JSON.parseに失敗する文字列）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(DESTINATION_STORAGE_KEY, "{not valid json");
    assert.equal(loadDestination(), null);
  });
});

test("JSON.parseの結果がオブジェクトでない（文字列）場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(DESTINATION_STORAGE_KEY, JSON.stringify("35.0,139.0"));
    assert.equal(loadDestination(), null);
  });
});

test("JSON.parseの結果がオブジェクトでない（数値）場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(DESTINATION_STORAGE_KEY, JSON.stringify(42));
    assert.equal(loadDestination(), null);
  });
});

test("JSON.parseの結果がnullの場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(DESTINATION_STORAGE_KEY, "null");
    assert.equal(loadDestination(), null);
  });
});

test("latが数値型でない（文字列）場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: "35.0", lng: 139.0 })
    );
    assert.equal(loadDestination(), null);
  });
});

test("lngが数値型でない（文字列）場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: 35.0, lng: "139.0" })
    );
    assert.equal(loadDestination(), null);
  });
});

test("lat/lngのいずれかが欠けている場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(DESTINATION_STORAGE_KEY, JSON.stringify({ lat: 35.0 }));
    assert.equal(loadDestination(), null);
  });
});

test("latが非数値（Infinity相当、JSON数値のオーバーフロー）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    // "1e400"はJSONとして有効な数値トークンだが、JS上はInfinityとなりNumber.isFinite=falseになる
    storage.setItem(DESTINATION_STORAGE_KEY, '{"lat":1e400,"lng":139.0}');
    assert.equal(loadDestination(), null);
  });
});

test("緯度が範囲外（91、-90〜90を超える）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: 91, lng: 139.0 })
    );
    assert.equal(loadDestination(), null);
  });
});

test("緯度が範囲外（-91）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: -91, lng: 139.0 })
    );
    assert.equal(loadDestination(), null);
  });
});

test("経度が範囲外（181、-180〜180を超える）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: 35.0, lng: 181 })
    );
    assert.equal(loadDestination(), null);
  });
});

test("経度が範囲外（-181）の場合、loadDestinationはnullを返す", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    storage.setItem(
      DESTINATION_STORAGE_KEY,
      JSON.stringify({ lat: 35.0, lng: -181 })
    );
    assert.equal(loadDestination(), null);
  });
});

// --- 異常系：localStorageが使えない・例外が発生する環境 ---

test("windowが存在しない環境（SSR相当）でも、saveDestinationは例外を投げずに正常終了する", () => {
  // globalThis.windowを一切モックせず、Node標準のテスト実行環境のまま呼び出す
  assert.doesNotThrow(() => {
    saveDestination({ lat: 35.0, lng: 139.0 });
  });
});

test("windowが存在しない環境（SSR相当）では、loadDestinationはnullを返す", () => {
  assert.equal(loadDestination(), null);
});

test("localStorageの操作が例外を投げる環境（プライベートブラウズ等）でも、saveDestinationは例外を投げずに正常終了する", () => {
  const storage = createThrowingStorage();
  withMockedWindow(storage, () => {
    assert.doesNotThrow(() => {
      saveDestination({ lat: 35.0, lng: 139.0 });
    });
  });
});

test("localStorageの操作が例外を投げる環境（プライベートブラウズ等）では、loadDestinationはnullを返す", () => {
  const storage = createThrowingStorage();
  withMockedWindow(storage, () => {
    assert.equal(loadDestination(), null);
  });
});

test("JSON.stringifyできない循環参照等が万が一渡ってもsaveDestinationは例外を投げない（型上は発生し得ないが防御の確認）", () => {
  const storage = createMemoryStorage();
  withMockedWindow(storage, () => {
    // StoredDestination型はlat/lngのみのnumberで、循環参照は型上あり得ないが、
    // try...catchで囲まれている実装であることをNaN等の異常値でも確認する。
    assert.doesNotThrow(() => {
      saveDestination({ lat: Number.NaN, lng: Number.NaN });
    });
  });
});
