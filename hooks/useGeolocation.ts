"use client";

// hooks/useGeolocation.ts
// GPS位置情報の取得・監視を行うフック

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type GeoStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

export interface UseGeolocationResult {
  status: GeoStatus;
  /** 直近で取得できた現在地。一度も取得できていなければnull */
  position: GeoPosition | null;
  /** 直近のaccuracy（メートル）。画面には出さず、精度ラベル判定にのみ使う */
  accuracy: number | null;
  /** PERMISSION_DENIED以外の一時的エラー（TIMEOUT等）が発生中かどうか */
  hasTransientError: boolean;
  /** 開始ボタン押下時に呼ぶ。watchPositionを開始する */
  requestPermission: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [hasTransientError, setHasTransientError] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("granted");
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setHasTransientError(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setHasTransientError(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    watchIdRef.current = watchId;
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { status, position, accuracy, hasTransientError, requestPermission };
}
