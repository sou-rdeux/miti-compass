// utils/goal.ts
// ゴール判定

import { GOAL_RADIUS_METERS } from "./constants";

/** 距離がゴール半径以内かどうかを返す */
export function isGoalReached(distanceMeters: number): boolean {
  return distanceMeters <= GOAL_RADIUS_METERS;
}
