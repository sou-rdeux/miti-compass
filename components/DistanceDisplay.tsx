// components/DistanceDisplay.tsx
// 残り距離 / GOAL表示専用コンポーネント

export interface DistanceDisplayProps {
  /** 整数mに丸める前のメートル値。まだ計測不能な場合はnull */
  distanceMeters: number | null;
  /** trueの場合、距離表示の代わりにGOAL表示を行う */
  goalReached: boolean;
}

export default function DistanceDisplay({
  distanceMeters,
  goalReached,
}: DistanceDisplayProps) {
  if (goalReached) {
    return (
      <p className="text-center text-6xl font-bold tracking-wide text-black">
        GOAL
      </p>
    );
  }

  const text = distanceMeters === null ? "--- m" : `${Math.round(distanceMeters)}m`;

  return (
    <p className="text-center text-6xl font-bold text-black">{text}</p>
  );
}
