// utils/distance.ts
// 2点間の距離計算（Haversine formula）

/** 地球の半径（メートル）。物理定数のため constants.ts には含めない */
const EARTH_RADIUS_METERS = 6371000;

export interface Coordinate {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine formulaによる2点間の距離（メートル）を返す */
export function calcDistanceMeters(from: Coordinate, to: Coordinate): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const a =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}
