// tests/helpers/resolve-ts-extension.mjs
//
// テスト実行専用のカスタムESMリゾルバフック。
// utils/ 配下のソースはtsconfigの moduleResolution: "bundler" を前提に
// 拡張子なしの相対import（例: import { X } from "./constants"）を書いているため、
// 素のNode.js ESMローダーでは解決できない（Node ESMは拡張子省略を許さない）。
// このフックは、通常解決に失敗した相対importに対してのみ ".ts" を補って再試行する。
// 機能コード（utils/ 配下）は一切変更せず、テスト実行環境側だけで解決方法を調整するためのもの。

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const isModuleNotFound = err && err.code === "ERR_MODULE_NOT_FOUND";
    if (isRelative && isModuleNotFound && !specifier.endsWith(".ts")) {
      return await nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
