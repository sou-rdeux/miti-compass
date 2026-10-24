// types/device-orientation.d.ts
// WebKit固有・Android向けの非標準APIをdeclaration mergingで型安全に扱う

// このファイルはexport {}によりモジュールとして扱われるため、
// グローバルの型を拡張（declaration merging）するにはdeclare globalで包む必要がある。
declare global {
  // iOS Safari: deviceorientationイベントにwebkitCompassHeadingが乗ってくる
  interface DeviceOrientationEvent {
    readonly webkitCompassHeading?: number;
    readonly webkitCompassAccuracy?: number;
  }

  // iOS 13+: DeviceOrientationEvent.requestPermission()はユーザー操作内でのみ呼べる
  interface DeviceOrientationEventiOSConstructor {
    requestPermission?: () => Promise<"granted" | "denied">;
  }

  // Android Chrome等: deviceorientationabsoluteイベントの型をaddEventListenerに認識させる
  interface WindowEventMap {
    deviceorientationabsolute: DeviceOrientationEvent;
  }
}

export {};
