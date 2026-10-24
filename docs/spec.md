# 街歩きコンパス 仕様書（Phase1 MVP）

最終更新：2026-10-25
対象：Next.js 16.4.3 / React 19.3 / TypeScript 5（strict）/ Tailwind CSS 4 / App Router

## 0. コンセプト

目的地の方角だけを頼りに歩く体験を検証するスマホ向けWebアプリ。
「画面を見せるな、街を見せろ」。地図・ルート・現在地の数値は一切表示しない。

サーバー・DB・認証・地図API・Firebaseは使わない。すべてブラウザ内で完結する1ページのアプリ。
複数人が同じURLを同時に開いても、各端末は自分のGPS・コンパスのみを使用し、端末間の通信は一切発生しない（完全にクライアントサイドの独立動作）。

---

## 1. 画面構成（1ページのみ・`app/page.tsx`）

上から縦に以下を配置する。

| # | 要素 | 内容 |
|---|------|------|
| 1 | タイトル | 「街歩きコンパス」固定文字列 |
| 2 | 開始ボタン | 初期表示時のみ表示。タップでGPS・コンパスの許可を要求する |
| 3 | 目的地設定フォーム（GoalForm） | 緯度入力・経度入力・「目的地設定」ボタン。権限確認が完了するまでは入力不可（disabled） |
| 4 | コンパス（Compass） | 目的地方向を指す大きな矢印。中央に円形の背景。コンパスが未許可・非対応の場合は矢印の代わりに「コンパスが使えません（距離表示のみ有効です）」を表示する（表示条件は2章・8章参照） |
| 5 | 残り距離表示 / GOAL表示（DistanceDisplay） | 整数＋m（例：425m）。ゴール後は「GOAL」を大きく表示 |
| 6 | GPS取得状態ラベル | 「取得中」「良好」「精度が低い」「未許可」のいずれか1つのテキストのみ |
| 7 | エラー表示領域 | 該当するエラーがある場合、ページ内の対応箇所にインライン表示（別ページ・モーダルは使わない） |

**画面に表示しないもの**：現在地の緯度経度、地図、ルート線、方位角の数値、accuracyの数値、デバッグ情報。

**デザイン方針**：
- スマホファースト（幅375px基準、最大幅は中央寄せでもよいがPC最適化はしない）
- 屋外の直射日光下でも視認できる高コントラスト（背景とテキスト・矢印の明度差を大きく取る。例：白背景＋黒矢印、または黒背景＋白矢印のどちらか一方に統一）
- 文字・矢印は大きく（距離表示は48px以上、矢印アイコンは画面幅の50%程度を占める大きさ）
- 余計な装飾・アイコン・説明文は置かない
- 画面は縦向き前提。横向きロック（Screen Orientation API等での強制）は行わない。レイアウトが大きく崩れない程度のレスポンシブ対応のみ行う

---

## 2. 状態遷移

アプリ全体の状態は、`app/page.tsx`（クライアントコンポーネント）が `useGeolocation` と `useCompass` の2つのフックの戻り値、および `destination`（目的地）・`goalReached`（ゴール済みフラグ）の内部stateから導出する。独立した状態機械を1つに固めるのではなく、以下の**優先順位付きの表示ルール**として定義する（上から順に評価し、最初に合致した行を表示する）。

| 優先 | 状態名 | 判定条件 | 表示内容 |
|---|---|---|---|
| 1 | `initial`（初期表示） | まだ「開始」が押されていない | タイトル＋開始ボタンのみ。フォーム・コンパス・距離は非表示 |
| 2 | `requestingPermission`（許可確認中） | 開始が押され、GPSまたはコンパスの許可ダイアログ応答待ち | 「位置情報・方位センサーの許可を確認しています…」 |
| 3 | `gpsUnsupported` | `navigator.geolocation` が存在しない | エラー「この端末・ブラウザは位置情報に対応していません。」（以降の操作不可・終端状態） |
| 4 | `gpsDenied` | Geolocationの許可が拒否された | エラー「位置情報の利用が許可されていません。端末の設定を確認し、ページを再読み込みしてください。」＋「再試行」ボタン |
| 5 | `awaitingDestination`（目的地未設定） | GPS許可は得られたが `destination === null` | GoalFormを有効化して表示。コンパス・距離欄には「目的地の緯度・経度を入力し、『目的地設定』を押してください。」 |
| 6 | `goal`（ゴール済み） | `goalReached === true` | コンパス・距離欄を「GOAL」の大表示に置き換える |
| 7 | `tracking`（計測中） | 上記以外（GPS許可済み・目的地設定済み・未ゴール） | コンパスの矢印＋残り距離（m）を表示 |

補足ルール：

- **コンパス未許可・非対応は致命的エラーにしない（ユーザー承認済み）。** コンパスの `status` が `denied` または `unsupported` になった時点から、`awaitingDestination` / `tracking` / `goal` のいずれの状態でも、コンパス（矢印）領域を常に「コンパスが使えません（距離表示のみ有効です）」という文言に置き換える。この表示はページをリロードするか、コンパスの許可が後から得られるまで維持される。GPSによる距離表示・GoalForm・GPS状態ラベルは通常通り機能し続ける（距離だけでも歩く手がかりになるため）。表示文言・表示条件の詳細は8章「コンパス未許可」「コンパス非対応」の行を参照。
- **GPS信号の一時的ロスト（`TIMEOUT` / `POSITION_UNAVAILABLE`）は `gpsDenied` に遷移させない。** 許可（`PERMISSION_DENIED`）とは明確に区別し、一度でも位置情報を取得済みであれば直前の値を保持したまま、GPS状態ラベルを「取得中」に戻すのみとする。まだ一度も取得できていない場合は `awaitingDestination` 等の下に「GPSの電波を取得できません。屋外の見晴らしの良い場所に移動してください。」を表示する。
- **目的地の再設定は常に可能。** `tracking` / `goal` のどちらの状態でもGoalFormは常に操作可能。再設定（送信）すると `goalReached` は `false` にリセットされ、`tracking` 状態に戻る。
- **一度 `goalReached = true` になったら、距離が再び20mを超えても `goal` 表示を維持する。** 目的地の再設定（GoalFormの再送信）以外に `goal` から `tracking` へ戻る手段はない。

### 開始ボタン押下時の許可要求フロー（実装上重要な制約）

1. 「開始」ボタンの `onClick` 内で、**同一のユーザー操作（クリックイベント）の中で**以下を同期的に呼び出す。
   - `navigator.geolocation.watchPosition(...)` を呼び出す（非同期コールバックだが呼び出し自体は同期）
   - iOSの場合、`DeviceOrientationEvent.requestPermission()` を呼び出す（戻り値はPromiseだが、呼び出し自体をクリックハンドラ内で`await`を挟まず直接実行することで「ユーザー操作内」の制約を満たす）
2. iOS以外（Android等、`requestPermission` 静的メソッドが存在しない場合）は明示的な許可APIが無いため、`deviceorientationabsolute` イベントのリスナーを登録するだけでよい。イベントが実際に発火するかどうかで対応状況を判定する（後述 `useCompass` 参照）。
3. GPSとコンパスそれぞれの許可結果は独立して扱われる（上記の状態遷移表の通り、GPSが最優先でブロッキングし、コンパスは非ブロッキング）。

---

## 3. コンポーネント設計

全コンポーネントは **props駆動の表示専用（Presentational）コンポーネント** とし、状態管理やGPS/コンパスの購読ロジックは一切持たない。状態管理・ロジックの統合はすべて `app/page.tsx` が担う。

### 3.1 `components/Compass.tsx`

```ts
interface CompassProps {
  /** 目的地方向の表示角度（0〜360度、utils/compassAngle.ts の calcArrowAngle の戻り値をそのまま渡す） */
  arrowAngle: number
  /** コンパスが利用不可（未許可・非対応）の場合に true */
  disabled: boolean
}
```

- 責務：円形の背景＋矢印アイコンをCSSの `transform: rotate()` で表示するだけ。
- `disabled === true` の場合、矢印を非表示（または強い半透明表示）にし、コンポーネント内に「コンパスが使えません（距離表示のみ有効です）」を表示する。この文言はユーザーが一目で「コンパス機能が使えない状態である」と分かることを目的とした固定文言とする（8章と同一文言で統一する）。
- **回転の跳ね返り対策**：`arrowAngle` は毎回 0〜360度の範囲で渡されるため、359度→0度のようにpropsの値が不連続に変化する瞬間がある。これをCSSの `transform` にそのまま使うと矢印が逆方向に1回転してしまう。これを防ぐため、コンポーネント内部で「画面に現在表示している累積回転角」を `useRef`（0〜360に収めない、単調に増減してよい数値）で保持し、新しい `arrowAngle` を受け取るたびに `utils/compassAngle.ts` の `shortestAngleDelta` で現在の表示角度との最短差分（-180〜180度）を求め、それを累積回転角に加算してから `transform: rotate()` に適用する。この累積値の保持とCSS適用はCompassコンポーネントのみの責務とする（親のpage.tsxや他のコンポーネントには影響しない）。

### 3.2 `components/GoalForm.tsx`

```ts
interface GoalFormProps {
  /** 入力値が検証OKだった場合にのみ呼ばれる */
  onSubmit: (destination: { lat: number; lng: number }) => void
  /** 権限確認が完了していない間はtrue（操作不可） */
  disabled: boolean
}
```

- 責務：緯度・経度のテキスト入力2つと「目的地設定」ボタン。
- input要素は `type="text"` `inputMode="decimal"` を使用する（`type="number"` はブラウザにより負号・小数点の挙動が異なるため採用しない）。
- バリデーションはコンポーネント内部で行い、NGの場合はフォーム直下に赤文字でエラーメッセージを表示し `onSubmit` を呼ばない（詳細は5章）。
- 入力値はコンポーネント内部の `useState<string>` で文字列として保持し、送信時にのみ数値変換・検証を行う。

### 3.3 `components/DistanceDisplay.tsx`

```ts
interface DistanceDisplayProps {
  /** 整数mに丸める前のメートル値。まだ計測不能な場合はnull */
  distanceMeters: number | null
  /** trueの場合、距離表示の代わりにGOAL表示を行う */
  goalReached: boolean
}
```

- 責務：`goalReached === true` なら大きな「GOAL」を表示。`false` なら `Math.round(distanceMeters)` + "m" を表示（例：425m）。`distanceMeters === null` の場合は「--- m」のようなプレースホルダーを表示。
- 距離の丸め処理（四捨五入）はこのコンポーネントの責務とし、呼び出し元は生のメートル値（小数）を渡す。

---

## 4. hooks設計

### 4.1 `hooks/useGeolocation.ts`

```ts
export interface GeoPosition {
  lat: number
  lng: number
}

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export interface UseGeolocationResult {
  status: GeoStatus
  /** 直近で取得できた現在地。一度も取得できていなければnull */
  position: GeoPosition | null
  /** 直近のaccuracy（メートル）。画面には出さず、精度ラベル判定にのみ使う */
  accuracy: number | null
  /** PERMISSION_DENIED以外の一時的エラー（TIMEOUT等）が発生中かどうか */
  hasTransientError: boolean
  /** 開始ボタン押下時に呼ぶ。watchPositionを開始する */
  requestPermission: () => void
}

export function useGeolocation(): UseGeolocationResult
```

**内部ロジック**：

- `requestPermission()` 呼び出し時、`navigator.geolocation` が存在しなければ `status` を即 `'unsupported'` にする。存在する場合は `status` を `'requesting'` にし、`navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })` を呼び出し、返却される watch ID を `useRef` に保存する。
- `onSuccess(pos)`：`status` を `'granted'` にし、`position = { lat: pos.coords.latitude, lng: pos.coords.longitude }`、`accuracy = pos.coords.accuracy` を更新。`hasTransientError` を `false` に戻す。
- `onError(err)`：
  - `err.code === err.PERMISSION_DENIED` → `status` を `'denied'` にする（以後、位置情報は取得不能として扱う）。
  - それ以外（`TIMEOUT` / `POSITION_UNAVAILABLE`）→ `status` は変更せず、`hasTransientError = true` のみ設定する（直前の `position` は保持する）。
- クリーンアップ：コンポーネントのアンマウント時に `navigator.geolocation.clearWatch(watchId)` を呼ぶ（`useEffect` の cleanup）。

**GPS状態ラベルの判定（`app/page.tsx` 側のロジック。閾値定数は `utils/constants.ts` からimportする。5.5節参照）**：

| ラベル | 条件 |
|---|---|
| 未許可 | `status === 'denied' \|\| status === 'unsupported'` |
| 取得中 | `status === 'requesting'`、または `status === 'granted'` かつ `position === null`、または `hasTransientError === true` |
| 良好 | `status === 'granted' && accuracy !== null && accuracy <= ACCURACY_GOOD_THRESHOLD_METERS` |
| 精度が低い | `status === 'granted' && accuracy !== null && accuracy > ACCURACY_GOOD_THRESHOLD_METERS` |

閾値20mの根拠：市街地でのスマホGPSは好条件下でおおむね5〜20m、建物密集地や遮蔽物がある場所では20〜50m程度まで悪化することが多い。ゴール判定半径（20m）と同じ値に揃えることで「良好な精度が出ていればゴール判定も信頼できる」という直感に合わせた。**この値は実機テスト後に調整する前提であることが確定しているため、コード中にマジックナンバーとして埋め込まず、`utils/constants.ts` の `ACCURACY_GOOD_THRESHOLD_METERS` を参照する（5.5節参照）。**

### 4.2 `hooks/useCompass.ts`

```ts
export type CompassStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export interface UseCompassResult {
  status: CompassStatus
  /** スムージング済みの端末方位（0〜360度、北=0、時計回り）。未取得ならnull */
  heading: number | null
  /** 開始ボタン押下時、ユーザー操作イベントハンドラの中から同期的に呼ぶ */
  requestPermission: () => void
}

export function useCompass(): UseCompassResult
```

**内部ロジック**：

1. **iOS判定**：`DeviceOrientationEvent` コンストラクタに `requestPermission` 静的メソッドが存在するかどうかで判定する（型定義は6章参照）。
2. **iOSの場合**：
   - `requestPermission()` を呼び出し、`'granted'` が返れば `window.addEventListener('deviceorientation', handler)` を登録し `status = 'requesting'`（最初のイベント受信まで）。
   - `'denied'` が返れば `status = 'denied'`。
   - `handler(event)` では `event.webkitCompassHeading` が `number` であることを確認し、それを生の方位（rawHeading、0=北・時計回り）として採用する。初回受信時に `status = 'granted'` にする。
3. **iOS以外（Android Chrome等）の場合**：
   - 明示的な許可APIが無いため、`window.addEventListener('deviceorientationabsolute', handler)` を登録し、`status = 'requesting'` にする。
   - `COMPASS_TIMEOUT_MS`（`utils/constants.ts` で定義。初期値3000ms）の間イベントが一度も発火しなければ `status = 'unsupported'` にする（`setTimeout` で監視し、イベント受信時にタイマーをクリアする）。
   - `handler(event)` では `event.absolute === true` かつ `event.alpha` が `number` であることを確認し、`rawHeading = (360 - event.alpha) % 360` とする（**`event.alpha` をそのまま北基準として使わない**。Androidの `alpha` は北基準ではないため、この変換が必須）。初回受信時に `status = 'granted'` にする。
4. **スムージング（指数移動平均・EMA）**：
   - 角度は0〜360度で循環するため、単純なEMAでは0/360の境界で破綻する。以下の手順で行う。
     1. `delta = shortestAngleDelta(smoothedHeadingRef.current, rawHeading)`（-180〜180度の最短差分。`utils/compassAngle.ts` の関数を使用）
     2. `smoothedHeadingRef.current = normalizeTo0_360(smoothedHeadingRef.current + delta * SMOOTHING_FACTOR)`
   - `SMOOTHING_FACTOR`（`utils/constants.ts` で定義。初期値0.2）をEMA係数として用いる。値が小さいほど滑らかだが追従が遅れる。**実機テスト後に調整する前提であることが確定しているため、コード中にマジックナンバーとして埋め込まず、`utils/constants.ts` からimportして使用する（5.5節参照）。**
   - 初回のイベント受信時は `smoothedHeadingRef.current = rawHeading` で初期化する（スムージングを適用しない）。
5. クリーンアップ：アンマウント時に登録したイベントリスナーと `setTimeout` を解除する。

---

## 5. utils設計

### 5.1 `utils/distance.ts`

```ts
export interface Coordinate {
  lat: number
  lng: number
}

/** Haversine formulaによる2点間の距離（メートル）を返す */
export function calcDistanceMeters(from: Coordinate, to: Coordinate): number
```

地球半径は `6371000`（m）を定数として使用する。

### 5.2 `utils/bearing.ts`

```ts
/** fromからtoへの大円初期方位（initial bearing）を0〜360度（真北基準・時計回り）で返す */
export function calcInitialBearing(from: Coordinate, to: Coordinate): number
```

`Coordinate` は `utils/distance.ts` からimportして共用する。

### 5.3 `utils/compassAngle.ts`

```ts
/** 任意の角度差を-180〜180度の最短差分に正規化する */
export function shortestAngleDelta(fromDegrees: number, toDegrees: number): number

/** 目的地方位と端末方位から、矢印の表示角度を0〜360度で返す（= 目的地方位 − 端末方位 を正規化） */
export function calcArrowAngle(targetBearingDegrees: number, deviceHeadingDegrees: number): number
```

- `calcArrowAngle` は内部で `(targetBearingDegrees - deviceHeadingDegrees)` を計算し、`((x % 360) + 360) % 360` で0〜360度に正規化して返す。
- `shortestAngleDelta` は `useCompass` のEMAスムージング、および `Compass` コンポーネントの累積回転角計算の両方で共通利用する。

### 5.4 `utils/goal.ts`

```ts
import { GOAL_RADIUS_METERS } from './constants'

/** 距離がゴール半径以内かどうかを返す */
export function isGoalReached(distanceMeters: number): boolean
```

### 5.5 `utils/constants.ts`（調整前提の閾値・係数を集約する定数ファイル）

GPS精度閾値・EMA係数など、**実機テストの結果次第で変更される可能性が高い「調整対象の数値」はコード中にマジックナンバーとして直接書かず、すべて `utils/constants.ts` に集約してexportする。** 各hooks/utilsファイルはこのファイルから必要な定数をimportして使用し、値そのものを再定義しない。これにより、tester/developerが実機確認の結果を踏まえて調整する際、変更箇所を1ファイルに限定できる。

```ts
// utils/constants.ts

/** GPSのaccuracy（メートル）がこの値以下なら「良好」、超えたら「精度が低い」と判定する */
export const ACCURACY_GOOD_THRESHOLD_METERS = 20

/** 目的地からの距離がこの値（メートル）以内になったらゴール判定とする */
export const GOAL_RADIUS_METERS = 20

/** コンパスのスムージングに使うEMA（指数移動平均）係数。0〜1、小さいほど滑らかだが追従が遅れる */
export const SMOOTHING_FACTOR = 0.2

/** Android等でdeviceorientationabsoluteイベントが一度も発火しない場合に「非対応」と判定するまでの待機時間（ミリ秒） */
export const COMPASS_TIMEOUT_MS = 3000
```

- `utils/goal.ts` は `GOAL_RADIUS_METERS` をこのファイルからimportする。
- `hooks/useGeolocation.ts` は `ACCURACY_GOOD_THRESHOLD_METERS` をこのファイルからimportする（GPS状態ラベル判定に使用。4.1節参照）。
- `hooks/useCompass.ts` は `SMOOTHING_FACTOR` と `COMPASS_TIMEOUT_MS` をこのファイルからimportする（4.2節参照）。
- `utils/distance.ts` の地球半径（6371000m）は物理定数であり調整対象ではないため、本ファイルに含めず `distance.ts` 内に定数定義してよい。

---

## 6. 型定義（非標準プロパティの拡張）

`any` は使用しない。WebKit固有・Android向けの非標準APIは、グローバル型の**宣言の拡張（declaration merging）**で型安全に扱う。配置場所は `types/device-orientation.d.ts`（新規、`tsconfig.json` の `include` に `**/*.ts` があるため自動的に対象になる）とする。

```ts
// types/device-orientation.d.ts

// iOS Safari: deviceorientationイベントにwebkitCompassHeadingが乗ってくる
interface DeviceOrientationEvent {
  readonly webkitCompassHeading?: number
  readonly webkitCompassAccuracy?: number
}

// iOS 13+: DeviceOrientationEvent.requestPermission()はユーザー操作内でのみ呼べる
interface DeviceOrientationEventiOSConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

// Android Chrome等: deviceorientationabsoluteイベントの型をaddEventListenerに認識させる
declare global {
  interface WindowEventMap {
    deviceorientationabsolute: DeviceOrientationEvent
  }
}

export {}
```

利用側（`useCompass.ts`）での呼び出し例（シグネチャのみ。実装はdeveloperが行う）：

```ts
const OrientationEventCtor = DeviceOrientationEvent as unknown as DeviceOrientationEventiOSConstructor &
  typeof DeviceOrientationEvent

if (typeof OrientationEventCtor.requestPermission === 'function') {
  // iOS分岐
}
```

`DeviceOrientationEvent.absolute` / `alpha` / `beta` / `gamma` は標準の `lib.dom.d.ts` に既に型定義があるため追加の拡張は不要。

---

## 7. 入力チェック（GoalForm内部バリデーション）

| 項目 | 条件 | エラー時の表示文言 |
|---|---|---|
| 緯度 | 数値変換可能かつ `-90 <= lat <= 90` | 「緯度は -90〜90 の範囲で入力してください。」 |
| 経度 | 数値変換可能かつ `-180 <= lng <= 180` | 「経度は -180〜180 の範囲で入力してください。」 |
| 共通 | 入力が空、または数値に変換できない（`Number()` が `NaN`、全角数字等の非対応文字含む） | 「緯度・経度は数値で入力してください。」 |

- 検証は「目的地設定」ボタン押下時に実行する（入力途中のリアルタイム検証は行わない）。
- 複数項目がNGの場合は、優先度の高い1件のメッセージのみ表示する（優先度：数値変換エラー > 緯度範囲エラー > 経度範囲エラー）。
- 検証OKの場合のみ `onSubmit({ lat, lng })` を呼び、入力欄の値はクリアせず残す（再編集・再送信しやすくするため）。

---

## 8. エラー処理一覧・表示文言

| エラー種別 | 発生条件 | 表示文言 | 復帰手段 |
|---|---|---|---|
| GPS未許可 | Geolocationの許可がdenied | 「位置情報の利用が許可されていません。端末の設定を確認し、ページを再読み込みしてください。」 | 「再試行」ボタン（再度 `requestPermission` を呼ぶ）。ブラウザが既に拒否を記憶している場合は即座にdeniedが返ることがあり、その場合は8.1節の設定変更手順＋リロードが必要 |
| GPS非対応 | `navigator.geolocation` が存在しない | 「この端末・ブラウザは位置情報に対応していません。」 | なし（終端状態） |
| コンパス未許可 | iOSで `requestPermission()` が `'denied'` を返した | コンパス領域に「コンパスが使えません（距離表示のみ有効です）」を常時表示。加えてエラー表示領域に「方位センサーの利用が許可されていません。端末の設定を確認してください。」を1回表示 | 「再試行」ボタン。ブラウザ/OSが拒否を記憶している場合は8.1節の設定変更手順＋リロードが必要 |
| コンパス非対応 | Android等でタイムアウト（3秒）までイベントが発火しない | コンパス領域に「コンパスが使えません（距離表示のみ有効です）」を常時表示。加えてエラー表示領域に「この端末・ブラウザは方位センサーに対応していません。」を1回表示 | なし（距離表示のみで運用継続） |
| GPS未取得（信号ロスト） | 許可済みだが一度も `position` が取れていない、または一時的エラー継続中 | 「GPSの電波を取得できません。屋外の見晴らしの良い場所に移動してください。」 | 自動的に`position`取得で解消 |
| 目的地未設定 | `destination === null` | 「目的地の緯度・経度を入力し、『目的地設定』を押してください。」 | GoalForm送信で解消 |
| 入力エラー（緯度） | 7章参照 | 7章参照 | 再入力 |
| 入力エラー（経度） | 7章参照 | 7章参照 | 再入力 |
| 入力エラー（数値以外） | 7章参照 | 7章参照 | 再入力 |

表示条件の補足：「コンパスが使えません」はコンパス領域（Compassコンポーネント）に表示され続ける常設表示であり、エラー表示領域に出る1行の案内文（上記表の「表示文言」後半部分）とは別物である。後者はトースト的な一度きりの案内ではなく、コンパスが`denied`/`unsupported`である間、エラー表示領域にも常時表示し続ける（ページ上から消えるのはコンパスの許可が得られるかページがリロードされるまで）。

### 8.1 許可拒否時の案内文（詳細・iPhone / Android別）

GPS・コンパスいずれも、ブラウザ/OSが「拒否」を記憶してしまうと、JavaScriptから再度ダイアログを表示させる手段がない。この場合、「再試行」ボタンの下に以下の案内文をそのまま表示する。

**位置情報（GPS）が許可されない場合の案内文**

```
位置情報の利用が許可されていません。
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
   （鍵アイコンから変更できない場合は、Chromeの「設定」>「サイトの設定」>「位置情報」から該当サイトを探して「許可」に変更する）
```

**方位センサー（コンパス）が許可されない場合の案内文**

```
方位センサー（コンパス）の利用が許可されていません。距離表示のみでご利用いただけますが、
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
   可能性があるため、距離表示のみでご利用ください
```

---

## 9. PWA

- `app/manifest.ts` を新規作成し、`MetadataRoute.Manifest` を返す（Next.js 16の標準App Router機能。Service Workerは実装しない）。
- 最低限のフィールド：`name`、`short_name`、`start_url: '/'`、`display: 'standalone'`、`background_color`、`theme_color`、`icons`（192x192 / 512x512のPNGを `public/` に配置）。
- アイコン画像自体は未用意のため、仮アイコン（単色＋コンパスを模した図形など）をデザイン担当なしで developer が簡易生成するか、ユーザーに準備してもらうかを確認事項とする。

---

## 10. ファイル構成（Phase1で作成するファイル一覧）

```
app/
  page.tsx          … 状態管理の中心（コンテナ）。現状のサンプル実装を置き換える
  layout.tsx         … 既存のまま（titleのみ「街歩きコンパス」に変更）
  manifest.ts        … 新規
components/
  Compass.tsx
  GoalForm.tsx
  DistanceDisplay.tsx
hooks/
  useGeolocation.ts
  useCompass.ts
utils/
  distance.ts
  bearing.ts
  compassAngle.ts
  goal.ts
  constants.ts      … GPS精度閾値・EMA係数等、調整前提の定数を集約（5.5節）
types/
  device-orientation.d.ts
docs/
  spec.md           … 本書
README.md            … 11章参照
```

---

## 11. README に含める内容

- 起動方法（`npm install` / `npm run dev`）
- Vercelデプロイ方法（GitHub連携 or `vercel` CLI）
- スマホ実機テストにはHTTPSが必要な旨、`next dev --experimental-https` の使い方、またはVercelプレビューURLでの確認方法
- iPhoneでの位置情報・モーションセンサー許可方法、Androidでの位置情報許可方法（手順はspec.md 8.1節の案内文をそのまま転記・参照する）

---

## 12. 完成条件（受け入れ基準）

1. URLを開くとタイトルと「開始」ボタンのみが表示される
2. 「開始」をタップ → GPS許可ダイアログ → （iOSの場合）コンパス許可ダイアログが表示される
3. 緯度・経度を入力し「目的地設定」を押すと目的地が設定される
4. コンパスの矢印が目的地方向を指す（端末を回転させると矢印も追従する）
5. 残り距離（整数m）がリアルタイムに更新される
6. 目的地から20m以内に入ると「GOAL」が大きく表示され、以後目的地を再設定するまで維持される
7. `npm run lint` と `npm run build` がエラーなく通る
8. 緯度・経度の範囲外入力・数値以外の入力でエラー文言が表示され、目的地が設定されない
9. GPS未許可・コンパス未許可（非対応）のそれぞれで、8章の文言が表示される

---

## 13. Phase2候補（MVPの範囲外）

以下はユーザー要件になく、今回は実装しない。将来検討用に記録のみ。

- 目的地・GOAL状態の `localStorage` への永続化（リロードしても状態維持）
- 複数の目的地（経由地）の設定、履歴保存
- 距離・方位の数値デバッグ表示切り替え機能
- 音・バイブレーションによるGOAL通知
- 磁気偏角（真北と磁北の差）の補正
- 横向き・タブレット向けの専用レイアウト
- オフライン対応（Service Worker、Serwist等）
- 多言語対応（現状は日本語のみ）

---

## 14. 確認事項（承認済み・2026-10-25）

以下はいずれもユーザー承認済み。本章は設計判断の記録として残す。

1. **コンパス未許可・非対応時の挙動**：矢印は出さず「距離表示のみ有効」として運用を継続する設計で承認。加えて、画面上で分かるように常設の「コンパスが使えません（距離表示のみ有効です）」表示を追加した（1章・2章・3.1節・8章に反映済み）。
2. **GPS精度の閾値（良好/精度が低い）**：20mを境界値とすることで承認。実機テスト後に調整する前提であることを明記し、`utils/constants.ts` の `ACCURACY_GOOD_THRESHOLD_METERS` として一元管理する（5.5節）。
3. **EMAスムージング係数（0.2）**：初期値0.2で承認。実機テスト後に調整する前提であることを明記し、`utils/constants.ts` の `SMOOTHING_FACTOR` として一元管理する（5.5節）。
4. **再試行ボタンの限界**：ブラウザ/OSが拒否を記憶し再試行で解決できない場合がある制約を受け入れることで承認。iPhone（Safari）・Android（Chrome）それぞれの設定からの許可の開き方を具体的な手順として8.1節に明記した。
5. **PWAアイコン画像**：仮アイコンで進めることで承認。
6. **「開始」ボタンの扱い**：許可完了後は非表示にする設計で承認。
7. **横向き対応**：「横向きロックはしないが、レイアウトが大きく崩れない程度の対応のみ行う」という解釈で承認。

iPhone / Android の差異（実装リスクとして明記、ユーザー確認は不要だが共有しておく点）：

- iOSは `DeviceOrientationEvent.requestPermission()` が**同一ユーザー操作内での同期呼び出し**を要求するため、他の非同期処理（GPS許可など）と呼び出し順序・タイミングを誤ると許可ダイアログ自体が出ない、または無言で失敗するリスクがある（2章の「開始ボタン押下時の許可要求フロー」で手順を明記済み）。
- Androidは明示的な許可APIが無く、「対応しているが権限设定でセンサーが無効」なケースと「そもそも非対応」なケースを区別できない。本仕様ではタイムアウト（3秒）で一律「非対応」として扱う簡易判定にしている。
- iOS Safariのプライベートブラウズモードや一部の省電力設定で、Geolocation/DeviceOrientationの挙動が不安定になることがあるが、これはMVPの対応範囲外として検出・案内は行わない。
