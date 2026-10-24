// tests/helpers/register.mjs
// resolve-ts-extension.mjs をNode.jsのモジュールカスタマイズフックとして登録する。
// 使い方： node --import ./tests/helpers/register.mjs --test tests/*.test.ts

import { register } from "node:module";

register("./resolve-ts-extension.mjs", import.meta.url);
