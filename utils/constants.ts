// utils/constants.ts
// 実機テストの結果次第で調整される可能性が高い数値を一元管理する。
// 各hooks/utilsファイルはここからimportし、値を再定義しない。

/** GPSのaccuracy（メートル）がこの値以下なら「良好」、超えたら「精度が低い」と判定する */
export const ACCURACY_GOOD_THRESHOLD_METERS = 20;

/** 目的地からの距離がこの値（メートル）以内になったらゴール判定とする */
export const GOAL_RADIUS_METERS = 20;

/** コンパスのスムージングに使うEMA（指数移動平均）係数。0〜1、小さいほど滑らかだが追従が遅れる */
export const SMOOTHING_FACTOR = 0.2;

/** Android等でdeviceorientationabsoluteイベントが一度も発火しない場合に「非対応」と判定するまでの待機時間（ミリ秒） */
export const COMPASS_TIMEOUT_MS = 3000;
