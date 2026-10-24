// utils/compassAngle.ts
// 角度の正規化・最短差分・矢印表示角度の計算

/** 任意の角度差を-180〜180度の最短差分に正規化する */
export function shortestAngleDelta(
  fromDegrees: number,
  toDegrees: number
): number {
  const diff = ((toDegrees - fromDegrees + 180) % 360 + 360) % 360 - 180;
  // -180になった場合は180に揃える（0〜360境界の回転方向を一定にするため）
  return diff === -180 ? 180 : diff;
}

/** 目的地方位と端末方位から、矢印の表示角度を0〜360度で返す（= 目的地方位 − 端末方位 を正規化） */
export function calcArrowAngle(
  targetBearingDegrees: number,
  deviceHeadingDegrees: number
): number {
  const diff = targetBearingDegrees - deviceHeadingDegrees;
  return ((diff % 360) + 360) % 360;
}
