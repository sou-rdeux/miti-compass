"use client";

// app/page.tsx
// 街歩きコンパス：状態管理の中心（コンテナ）。
// useGeolocation / useCompass の戻り値と destination / goalReached から
// 画面状態を導出し、各表示専用コンポーネントに渡すだけの責務を持つ。

import { useMemo, useState } from "react";
import Compass from "../components/Compass";
import DistanceDisplay from "../components/DistanceDisplay";
import GoalForm from "../components/GoalForm";
import { useCompass } from "../hooks/useCompass";
import { useGeolocation } from "../hooks/useGeolocation";
import { calcInitialBearing } from "../utils/bearing";
import { calcArrowAngle } from "../utils/compassAngle";
import type { Coordinate } from "../utils/distance";
import { calcDistanceMeters } from "../utils/distance";
import { ACCURACY_GOOD_THRESHOLD_METERS } from "../utils/constants";
import { isGoalReached } from "../utils/goal";

type AppState =
  | "initial"
  | "requestingPermission"
  | "gpsUnsupported"
  | "gpsDenied"
  | "awaitingDestination"
  | "goal"
  | "tracking";

type GeoLabel = "未許可" | "取得中" | "良好" | "精度が低い";

const GPS_PERMISSION_GUIDANCE = `位置情報の利用が許可されていません。
再試行しても許可ダイアログが出ない場合は、以下の手順でブラウザの設定から許可してください。

[iPhone（Safari）の場合]
1. 「設定」アプリを開く
2. 「Safari」を選択する
3. 「位置情報」をタップする
4. 「許可」を選択する（または、サイトごとの設定が必要な場合は「設定」>「プライバシーとセキュリティ」>「位置情報サービス」>「SafariのWebサイト」で該当サイトを「許可」に変更する）
5. このページを再読み込みする

[Android（Chrome）の場合]
1. Chromeでこのページを開いた状態で、アドレスバー左側の鍵（またはアイコン）をタップする
2. 「権限」または「サイトの設定」をタップする
3. 「位置情報」を「許可」に変更する
4. このページを再読み込みする
   （鍵アイコンから変更できない場合は、Chromeの「設定」>「サイトの設定」>「位置情報」から該当サイトを探して「許可」に変更する）`;

const COMPASS_PERMISSION_GUIDANCE = `方位センサー（コンパス）の利用が許可されていません。距離表示のみでご利用いただけますが、
矢印で方向を確認したい場合は、以下の手順で許可してください。

[iPhone（Safari）の場合]
1. 「設定」アプリを開く
2. 「Safari」を選択する
3. 「モーションと方向のアクセス」をタップする
4. スイッチを「オン」にする
5. このページを再読み込みし、もう一度「開始」を押す

[Android（Chrome）の場合]
Android Chromeでは方位センサーに個別の許可ダイアログは無く、端末のセンサー自体が
無効化されていない限り自動的に利用できます。矢印が表示されない場合は以下を確認してください。
1. 端末を取り出した状態（ポケットやケースに入れたままでない状態）で数秒待つ
2. 端末を8の字を描くように軽く動かしてセンサーを初期化する
3. それでも反応しない場合は、その端末・ブラウザの組み合わせでは方位センサーに対応していない
   可能性があるため、距離表示のみでご利用ください`;

const DESTINATION_GUIDANCE_TEXT =
  "目的地の緯度・経度を入力し、『目的地設定』を押してください。";

function resolveGeoLabel(
  status: ReturnType<typeof useGeolocation>["status"],
  position: Coordinate | null,
  accuracy: number | null,
  hasTransientError: boolean
): GeoLabel {
  if (status === "denied" || status === "unsupported") {
    return "未許可";
  }
  if (status === "requesting" || position === null || hasTransientError) {
    return "取得中";
  }
  if (accuracy !== null) {
    return accuracy <= ACCURACY_GOOD_THRESHOLD_METERS ? "良好" : "精度が低い";
  }
  return "取得中";
}

export default function Home() {
  const geo = useGeolocation();
  const compass = useCompass();

  const [started, setStarted] = useState(false);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [goalReached, setGoalReached] = useState(false);

  const compassDisabled =
    compass.status === "denied" || compass.status === "unsupported";

  const distanceMeters = useMemo(() => {
    if (geo.position === null || destination === null) {
      return null;
    }
    return calcDistanceMeters(geo.position, destination);
  }, [geo.position, destination]);

  // ゴール判定：一度trueになったら、目的地の再設定以外では戻さない。
  // レンダー中に計算した値をもとにstateを補正する（Reactが公式に許容するパターン）。
  if (distanceMeters !== null && !goalReached && isGoalReached(distanceMeters)) {
    setGoalReached(true);
  }

  const arrowAngle = useMemo(() => {
    if (
      geo.position === null ||
      destination === null ||
      compass.heading === null
    ) {
      return 0;
    }
    const bearing = calcInitialBearing(geo.position, destination);
    return calcArrowAngle(bearing, compass.heading);
  }, [geo.position, destination, compass.heading]);

  let appState: AppState;
  if (!started) {
    appState = "initial";
  } else if (geo.status === "requesting" || geo.status === "idle") {
    appState = "requestingPermission";
  } else if (geo.status === "unsupported") {
    appState = "gpsUnsupported";
  } else if (geo.status === "denied") {
    appState = "gpsDenied";
  } else if (destination === null) {
    appState = "awaitingDestination";
  } else if (goalReached) {
    appState = "goal";
  } else {
    appState = "tracking";
  }

  const geoLabel = resolveGeoLabel(
    geo.status,
    geo.position,
    geo.accuracy,
    geo.hasTransientError
  );

  const handleStart = () => {
    setStarted(true);
    // iOSの制約上、許可要求は同一クリックイベント内で同期的に呼び出す
    geo.requestPermission();
    compass.requestPermission();
  };

  const handleGoalSubmit = (dest: Coordinate) => {
    setDestination(dest);
    setGoalReached(false);
  };

  const formEnabled =
    appState === "awaitingDestination" ||
    appState === "tracking" ||
    appState === "goal";

  const showMainArea =
    appState === "awaitingDestination" ||
    appState === "tracking" ||
    appState === "goal";

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-white px-4 py-8 text-black">
      <h1 className="text-2xl font-bold">街歩きコンパス</h1>

      {appState === "initial" && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full max-w-xs rounded bg-black px-6 py-4 text-xl font-bold text-white"
        >
          開始
        </button>
      )}

      {appState !== "initial" && (
        <>
          <p className="text-sm font-medium">GPS: {geoLabel}</p>

          <GoalForm onSubmit={handleGoalSubmit} disabled={!formEnabled} />

          {appState === "requestingPermission" && (
            <p className="text-center text-base">
              {geo.hasTransientError
                ? "GPSの電波を取得できません。屋外の見晴らしの良い場所に移動してください。"
                : "位置情報・方位センサーの許可を確認しています…"}
            </p>
          )}

          {appState === "gpsUnsupported" && (
            <p className="text-center text-base font-bold text-red-600">
              この端末・ブラウザは位置情報に対応していません。
            </p>
          )}

          {appState === "gpsDenied" && (
            <div className="flex w-full flex-col items-center gap-3">
              <p className="text-center text-base font-bold text-red-600">
                位置情報の利用が許可されていません。端末の設定を確認し、ページを再読み込みしてください。
              </p>
              <button
                type="button"
                onClick={() => geo.requestPermission()}
                className="rounded border border-black px-4 py-2 font-bold"
              >
                再試行
              </button>
              <pre className="w-full whitespace-pre-wrap text-left text-xs font-sans text-zinc-700">
                {GPS_PERMISSION_GUIDANCE}
              </pre>
            </div>
          )}

          {showMainArea && (
            <>
              {compassDisabled ? (
                <Compass arrowAngle={0} disabled />
              ) : destination === null ? (
                <p className="text-center text-base">
                  {DESTINATION_GUIDANCE_TEXT}
                </p>
              ) : (
                <Compass arrowAngle={arrowAngle} disabled={false} />
              )}

              {destination === null ? (
                <>
                  {compassDisabled && (
                    <p className="text-center text-base">
                      {DESTINATION_GUIDANCE_TEXT}
                    </p>
                  )}
                  <DistanceDisplay distanceMeters={null} goalReached={false} />
                </>
              ) : (
                <DistanceDisplay
                  distanceMeters={distanceMeters}
                  goalReached={goalReached}
                />
              )}

              {compass.status === "denied" && (
                <div className="flex w-full flex-col items-center gap-3">
                  <p className="text-center text-base font-bold text-red-600">
                    方位センサーの利用が許可されていません。端末の設定を確認してください。
                  </p>
                  <button
                    type="button"
                    onClick={() => compass.requestPermission()}
                    className="rounded border border-black px-4 py-2 font-bold"
                  >
                    再試行
                  </button>
                  <pre className="w-full whitespace-pre-wrap text-left text-xs font-sans text-zinc-700">
                    {COMPASS_PERMISSION_GUIDANCE}
                  </pre>
                </div>
              )}

              {compass.status === "unsupported" && (
                <p className="text-center text-base font-bold text-red-600">
                  この端末・ブラウザは方位センサーに対応していません。
                </p>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
