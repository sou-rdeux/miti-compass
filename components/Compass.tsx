"use client";

// components/Compass.tsx
// 目的地方向を指す矢印の表示専用コンポーネント

import { useEffect, useRef } from "react";
import { shortestAngleDelta } from "../utils/compassAngle";

export interface CompassProps {
  /** 目的地方向の表示角度（0〜360度、utils/compassAngle.ts の calcArrowAngle の戻り値をそのまま渡す） */
  arrowAngle: number;
  /** コンパスが利用不可（未許可・非対応）の場合に true */
  disabled: boolean;
}

export default function Compass({ arrowAngle, disabled }: CompassProps) {
  // 画面に現在表示している累積回転角（0〜360に収めず、単調に増減してよい）
  const displayedRotationRef = useRef(0);
  const arrowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }
    const delta = shortestAngleDelta(
      displayedRotationRef.current % 360,
      arrowAngle
    );
    displayedRotationRef.current += delta;

    if (arrowRef.current !== null) {
      arrowRef.current.style.transform = `rotate(${displayedRotationRef.current}deg)`;
    }
  }, [arrowAngle, disabled]);

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <div className="relative flex aspect-square w-[50vw] max-w-[320px] items-center justify-center rounded-full border-4 border-black bg-white">
        {disabled ? (
          <p className="px-4 text-center text-base font-bold text-black">
            コンパスが使えません（距離表示のみ有効です）
          </p>
        ) : (
          <div
            ref={arrowRef}
            className="text-[18vw] leading-none text-black"
            style={{ transform: "rotate(0deg)" }}
            aria-label="目的地の方向"
          >
            ↑
          </div>
        )}
      </div>
    </div>
  );
}
