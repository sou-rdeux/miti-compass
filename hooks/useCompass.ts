"use client";

// hooks/useCompass.ts
// 端末の方位センサー（コンパス）の取得・スムージングを行うフック

import { useCallback, useEffect, useRef, useState } from "react";
import { shortestAngleDelta } from "../utils/compassAngle";
import { COMPASS_TIMEOUT_MS, SMOOTHING_FACTOR } from "../utils/constants";

export type CompassStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

export interface UseCompassResult {
  status: CompassStatus;
  /** スムージング済みの端末方位（0〜360度、北=0、時計回り）。未取得ならnull */
  heading: number | null;
  /** 開始ボタン押下時、ユーザー操作イベントハンドラの中から同期的に呼ぶ */
  requestPermission: () => void;
}

// DeviceOrientationEventiOSConstructor は types/device-orientation.d.ts で
// グローバルに拡張済み（declaration merging）

function normalizeTo0_360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function useCompass(): UseCompassResult {
  const [status, setStatus] = useState<CompassStatus>("idle");
  const [heading, setHeading] = useState<number | null>(null);

  /** EMAスムージング後の方位（0〜360度）。初回イベントまでnull */
  const smoothedHeadingRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceOrientationHandlerRef = useRef<
    ((event: DeviceOrientationEvent) => void) | null
  >(null);
  const deviceOrientationAbsoluteHandlerRef = useRef<
    ((event: DeviceOrientationEvent) => void) | null
  >(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  /** 生の方位を受け取り、EMAスムージングを適用してstateに反映する */
  const applyRawHeading = useCallback((rawHeading: number) => {
    if (smoothedHeadingRef.current === null) {
      smoothedHeadingRef.current = rawHeading;
    } else {
      const delta = shortestAngleDelta(
        smoothedHeadingRef.current,
        rawHeading
      );
      smoothedHeadingRef.current = normalizeTo0_360(
        smoothedHeadingRef.current + delta * SMOOTHING_FACTOR
      );
    }
    setStatus("granted");
    setHeading(smoothedHeadingRef.current);
  }, []);

  const requestPermission = useCallback(() => {
    const OrientationEventCtor = DeviceOrientationEvent as unknown as DeviceOrientationEventiOSConstructor &
      typeof DeviceOrientationEvent;

    if (typeof OrientationEventCtor.requestPermission === "function") {
      // iOS：ユーザー操作内で同期的に呼び出す（戻り値はPromise）
      setStatus("requesting");
      OrientationEventCtor.requestPermission()
        .then((result) => {
          if (result === "granted") {
            const handler = (event: DeviceOrientationEvent): void => {
              if (typeof event.webkitCompassHeading === "number") {
                applyRawHeading(event.webkitCompassHeading);
              }
            };
            deviceOrientationHandlerRef.current = handler;
            window.addEventListener("deviceorientation", handler);
          } else {
            setStatus("denied");
          }
        })
        .catch(() => {
          setStatus("denied");
        });
    } else {
      // iOS以外（Android Chrome等）：明示的な許可APIが無いためイベント発火の有無で判定する
      setStatus("requesting");

      const handler = (event: DeviceOrientationEvent): void => {
        if (event.absolute === true && typeof event.alpha === "number") {
          clearPendingTimeout();
          const rawHeading = (360 - event.alpha) % 360;
          applyRawHeading(rawHeading);
        }
      };
      deviceOrientationAbsoluteHandlerRef.current = handler;
      window.addEventListener("deviceorientationabsolute", handler);

      timeoutIdRef.current = setTimeout(() => {
        setStatus("unsupported");
      }, COMPASS_TIMEOUT_MS);
    }
  }, [applyRawHeading, clearPendingTimeout]);

  useEffect(() => {
    return () => {
      clearPendingTimeout();
      if (deviceOrientationHandlerRef.current !== null) {
        window.removeEventListener(
          "deviceorientation",
          deviceOrientationHandlerRef.current
        );
      }
      if (deviceOrientationAbsoluteHandlerRef.current !== null) {
        window.removeEventListener(
          "deviceorientationabsolute",
          deviceOrientationAbsoluteHandlerRef.current
        );
      }
    };
  }, [clearPendingTimeout]);

  return { status, heading, requestPermission };
}
