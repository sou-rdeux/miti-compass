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
| 3 | 目的地設定フォーム（GoalForm） | 緯度入力・経度入力・「目的地設定」ボタン。権限確認が完了するまでは入力不可（disabled）。緯度・経度いずれの欄に「緯度, 経度」形式の文字列を貼り付けても、2つの数値を自動検出して両欄に振り分ける（15章参照）。初期表示時、localStorageに保存済みの目的地があれば入力欄に自動反映される（16章参照） |
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
- **ページ初期表示時、localStorageに保存済みの目的地があれば自動的に復元される。** 復元されるのは緯度・経度のみで、`goalReached` は復元せず常に `false` から始まる（復元後は必ず `tracking` 状態からスタートする）。GoalForm自体は許可フロー完了まで表示されないため、ユーザーの目には「開始してGoalFormが表示された時点で、既に前回の目的地が入っている」という形で見える。詳細は16章参照。

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
  /** 初期表示時に入力欄へ反映する値（localStorageからの復元用）。保存が無ければnull */
  initialDestination: { lat: number; lng: number } | null
}
```

- 責務：緯度・経度のテキスト入力2つと「目的地設定」ボタン、および「座標を貼り付け」ボタン（17章）。
- input要素は `type="text"` `inputMode="decimal"` を使用する（`type="number"` はブラウザにより負号・小数点の挙動が異なるため採用しない）。
- バリデーションはコンポーネント内部で行い、NGの場合はフォーム直下に赤文字でエラーメッセージを表示し `onSubmit` を呼ばない（詳細は7章）。
- 入力値はコンポーネント内部の `useState<string>` で文字列として保持し、送信時にのみ数値変換・検証を行う。
- **座標の貼り付け対応（入力欄への直接ペースト）**：緯度・経度いずれの入力欄にも同一の `onPaste` ハンドラを設定し、`utils/parseCoordinates.ts` の `parseCoordinates` 関数を使って貼り付け文字列を解析する。解析結果が「2値検出」であれば両欄に振り分け、それ以外（1値検出・検出不可）であればブラウザ標準のペースト動作に委ねる。詳細な解析ルール・UI挙動は15章参照。
- **座標を貼り付けボタン（クリップボードからの読み取り）**：入力欄の上に専用ボタンを配置し、`navigator.clipboard.readText()` でクリップボードを読み取って同じ`parseCoordinates`で解析する。詳細は17章参照。
- **`initialDestination` による初期値復元**：緯度・経度の内部state（`useState<string>`）は `useState(() => initialDestination ? String(initialDestination.lat) : '')` のように**遅延初期化（lazy initializer）**でセットする。つまり `initialDestination` はGoalFormが**最初にマウントされた瞬間の値のみ**を使い、以後 `initialDestination` prop が変化してもGoalFormの入力欄を上書きしない（通常の制御/非制御の混在を避けるための単純化）。この方式が成立する前提は「GoalFormが実際にマウントされる時点で、`initialDestination`に渡る`destination`の値が既に確定（復元完了）していること」である。`app/page.tsx` 側は `destination` state自体を `useState(() => loadDestination())` という遅延初期化で持つ（16.3節）ため、`destination` の値は `Home` コンポーネントの最初のレンダーの時点で確定し、これはページ内のどの子コンポーネント（GoalForm含む）がマウントされるよりも必ず先である。したがって、GoalFormが`awaitingDestination`状態到達より前（許可確認中・GPS拒否等の表示）に先行してマウントされる実装であっても、この前提は自動的に満たされる。
- **プレースホルダー文言**（貼り付けが可能であることが分かるように変更する）：
  - 緯度欄：`緯度　例：35.137（貼り付け可）`
  - 経度欄：`経度　例：138.660（貼り付け可）`
  - いずれの欄も、`onPaste`（直接貼り付け）・貼り付けボタン（17章）のどちらで反映された場合でも、プレースホルダーではなく実際の入力値が表示される（通常のinput要素の挙動通り）。

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

**GPS状態ラベルの判定（`app/page.tsx` 側のロジック。閾値定数は `utils/constants.ts` からimportする。5.6節参照）**：

| ラベル | 条件 |
|---|---|
| 未許可 | `status === 'denied' \|\| status === 'unsupported'` |
| 取得中 | `status === 'requesting'`、または `status === 'granted'` かつ `position === null`、または `hasTransientError === true` |
| 良好 | `status === 'granted' && accuracy !== null && accuracy <= ACCURACY_GOOD_THRESHOLD_METERS` |
| 精度が低い | `status === 'granted' && accuracy !== null && accuracy > ACCURACY_GOOD_THRESHOLD_METERS` |

閾値20mの根拠：市街地でのスマホGPSは好条件下でおおむね5〜20m、建物密集地や遮蔽物がある場所では20〜50m程度まで悪化することが多い。ゴール判定半径（20m）と同じ値に揃えることで「良好な精度が出ていればゴール判定も信頼できる」という直感に合わせた。**この値は実機テスト後に調整する前提であることが確定しているため、コード中にマジックナンバーとして埋め込まず、`utils/constants.ts` の `ACCURACY_GOOD_THRESHOLD_METERS` を参照する（5.6節参照）。**

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
   - `SMOOTHING_FACTOR`（`utils/constants.ts` で定義。初期値0.2）をEMA係数として用いる。値が小さいほど滑らかだが追従が遅れる。**実機テスト後に調整する前提であることが確定しているため、コード中にマジックナンバーとして埋め込まず、`utils/constants.ts` からimportして使用する（5.6節参照）。**
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

### 5.5 `utils/parseCoordinates.ts`

貼り付けられた文字列から緯度・経度の2値（または単一の数値）を検出する純粋関数。UIロジック（`GoalForm`のonPasteハンドラ）とは分離し、単体テストしやすい形にする。解析ルール・設計判断の詳細は15章を参照。

```ts
export interface ParsedCoordinatePair {
  kind: 'pair'
  lat: number
  lng: number
}

export interface ParsedSingleNumber {
  kind: 'single'
  value: number
}

export interface ParsedNone {
  kind: 'none'
}

export type ParseCoordinatesResult =
  | ParsedCoordinatePair
  | ParsedSingleNumber
  | ParsedNone

/** 貼り付け文字列等から数値を検出し、2値・1値・検出不可のいずれかを判別して返す */
export function parseCoordinates(text: string): ParseCoordinatesResult
```

### 5.6 `utils/constants.ts`（調整前提の閾値・係数を集約する定数ファイル）

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

### 5.7 `utils/destinationStorage.ts`

目的地のlocalStorage保存・復元を行う**純粋関数群**（Reactに依存しない）。state管理やuseEffectのタイミング制御は持たず、「保存する」「読み込む」だけに責務を限定する。設計判断の詳細・利用側（`app/page.tsx`）の呼び出し方は16章を参照。

```ts
export interface StoredDestination {
  lat: number
  lng: number
}

/** 保存先のlocalStorageキー */
export const DESTINATION_STORAGE_KEY = 'miti-compass:destination:v1'

/** 目的地をlocalStorageに保存する。失敗しても例外を投げない（内部でcatchして無視する） */
export function saveDestination(destination: StoredDestination): void

/**
 * localStorageから目的地を読み込む。
 * 以下のいずれかに該当する場合はnullを返す（例外は投げない）：
 * - localStorage自体が使えない（SSR時のwindow未定義、プライベートブラウズ等での例外）
 * - 保存データが存在しない
 * - JSON.parseに失敗する
 * - 形式が不正（lat/lngがnumber型でない、NaN、緯度-90〜90・経度-180〜180の範囲外）
 */
export function loadDestination(): StoredDestination | null
```

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
- **座標の貼り付け（15章）によって入力欄に値が反映された場合も、この検証ルールは一切変更しない。** 貼り付けはあくまで入力欄への値の反映のみを行い、範囲外の値が貼り付けられた場合は「目的地設定」ボタン押下時に通常の入力エラーとして検出・表示する（自動では確定しない）。

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
  parseCoordinates.ts … 貼り付け文字列から緯度・経度を検出する純粋関数（5.5節・15章）
  constants.ts      … GPS精度閾値・EMA係数等、調整前提の定数を集約（5.6節）
  destinationStorage.ts … 目的地のlocalStorage保存・読み込みの純粋関数（5.7節・16章）
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
- Googleマップで座標をコピーする方法、および「📋 Googleマップの座標を貼り付け」ボタンの使い方（手順はspec.md 17.5節の案内文をそのまま転記・参照する）

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
10. 緯度欄・経度欄のどちらに `(35.1371196, 138.6607245)` 形式の文字列を貼り付けても、両欄に自動で振り分けられる（15章の対応形式すべてで確認する）
11. 目的地設定後にページを再読み込みすると、保存されていた緯度・経度がGoalFormの入力欄・内部のdestinationに復元され、GOAL表示は復元されず常に計測中（tracking）状態から始まる（16章参照）
12. ブラウザの設定でlocalStorageを無効化した状態・プライベートブラウズモードでも、目的地設定・コンパス表示・距離表示が通常通り動作する（保存機能のみ無効になり、エラーや画面停止は発生しない）
13. クリップボードに `(35.1371196, 138.6607245)` 形式の文字列をコピーした状態で「📋 Googleマップの座標を貼り付け」ボタンを押すと、緯度欄・経度欄に自動で振り分けられる
14. クリップボードに座標として解析できない文字列（または空）がある状態でボタンを押すと、「座標が見つかりません。Googleマップで地点を長押しして座標をコピーしてください」がフォーム内に表示される
15. クリップボード読み取りが使えない・拒否された場合（PC版ブラウザで権限拒否した場合等で代替確認可）、「入力欄を長押しして貼り付けてください」が表示され、緯度欄にフォーカスが移動する

---

## 13. Phase2候補（MVPの範囲外）

以下はユーザー要件になく、今回は実装しない。将来検討用に記録のみ。

- ~~目的地の `localStorage` への永続化~~ → 2026-10-25の追加承認によりMVPに取り込み済み（16章）。ただし **GOAL状態（goalReached）の永続化は依然Phase2候補**（16章の通り、GOAL状態は意図的に保存しない）
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
2. **GPS精度の閾値（良好/精度が低い）**：20mを境界値とすることで承認。実機テスト後に調整する前提であることを明記し、`utils/constants.ts` の `ACCURACY_GOOD_THRESHOLD_METERS` として一元管理する（5.6節）。
3. **EMAスムージング係数（0.2）**：初期値0.2で承認。実機テスト後に調整する前提であることを明記し、`utils/constants.ts` の `SMOOTHING_FACTOR` として一元管理する（5.6節）。
4. **再試行ボタンの限界**：ブラウザ/OSが拒否を記憶し再試行で解決できない場合がある制約を受け入れることで承認。iPhone（Safari）・Android（Chrome）それぞれの設定からの許可の開き方を具体的な手順として8.1節に明記した。
5. **PWAアイコン画像**：仮アイコンで進めることで承認。
6. **「開始」ボタンの扱い**：許可完了後は非表示にする設計で承認。
7. **横向き対応**：「横向きロックはしないが、レイアウトが大きく崩れない程度の対応のみ行う」という解釈で承認。

iPhone / Android の差異（実装リスクとして明記、ユーザー確認は不要だが共有しておく点）：

- iOSは `DeviceOrientationEvent.requestPermission()` が**同一ユーザー操作内での同期呼び出し**を要求するため、他の非同期処理（GPS許可など）と呼び出し順序・タイミングを誤ると許可ダイアログ自体が出ない、または無言で失敗するリスクがある（2章の「開始ボタン押下時の許可要求フロー」で手順を明記済み）。
- Androidは明示的な許可APIが無く、「対応しているが権限设定でセンサーが無効」なケースと「そもそも非対応」なケースを区別できない。本仕様ではタイムアウト（3秒）で一律「非対応」として扱う簡易判定にしている。
- iOS Safariのプライベートブラウズモードや一部の省電力設定で、Geolocation/DeviceOrientationの挙動が不安定になることがあるが、これはMVPの対応範囲外として検出・案内は行わない。

---

## 15. 座標の貼り付け対応（GoalForm拡張・2026-10-25追加承認）

Googleマップ等からコピーした「緯度, 経度」形式の文字列を、緯度欄・経度欄のどちらに貼り付けても自動的に両欄へ振り分ける機能。ユーザー承認済みの追加要件。

> **17章（座標を貼り付けボタン）との役割分担**：本章（15章）は、ユーザーが入力欄に**直接ペースト操作（Ctrl+V・長押し貼り付け等）を行った場合**の挙動を定義する。17章は、ユーザーが**専用ボタンをタップしてクリップボードの内容を自動的に読み取る**場合の挙動を定義する。どちらも「貼り付けられた（または読み取った）文字列を解析して2つの入力欄に振り分ける」という目的は同じであり、**解析処理は`utils/parseCoordinates.ts`の`parseCoordinates`関数を完全に共有する**（判定ロジックの実装・テストは1箇所に集約され、15章・17章のどちらの経路でも同一の結果になる）。両者は「クリップボードへのアクセス方法が異なる2つの入力手段」であり、どちらかがどちらかを置き換えるものではなく、ユーザーは両方を自由に使える。

### 15.1 対応する形式

- `(35.1371196, 138.6607245)`
- `35.1371196, 138.6607245`
- `35.1371196,138.6607245`
- 上記のカッコ・カンマ・スペースが全角（（）／，／全角スペース）に置き換わっていても解釈できる。
- 数値が1つだけの場合は、従来通りその欄にそのまま入力される（自動振り分けは発生しない）。

### 15.2 `parseCoordinates` の解析ルール

`utils/parseCoordinates.ts`（シグネチャは5.5節参照）は、以下の手順で入力文字列を解析する。

**手順1：文字の正規化（全角→半角）**

| 対象 | 変換前 | 変換後 |
|---|---|---|
| 数字 | 全角数字 `０`–`９`（U+FF10–FF19） | 半角数字 `0`–`9` |
| 小数点 | 全角句点的な記号 `．`（U+FF0E） | `.` |
| 負号 | `－`（全角マイナス、U+FF0D）、`−`（マイナス記号、U+2212） | `-` |
| カンマ | `，`（全角カンマ、U+FF0C） | `,` |
| 丸括弧 | `（` `）`（全角、U+FF08/FF09） | `(` `)` |
| スペース | 全角スペース（U+3000） | 半角スペース |

**手順2：区切り文字・括弧の除去**

正規化後の文字列から、丸括弧 `(` `)` 、角括弧 `[` `]`、波括弧 `{` `}`、カンマ `,` を取り除く（空白1文字に置換する）。区切り文字が何であっても後段の数値抽出に影響しないようにするための前処理。

**手順3：数値パターンの抽出**

正規表現 `/-?\d+(?:\.\d+)?/g` を正規化後の文字列全体に適用し、マッチした数値文字列をすべて配列として取得する（符号付き整数・小数に対応。指数表記 `1e5` 等は対象外とする）。

**手順4：検出件数による判定**

| 検出された数値の個数 | 戻り値 | 備考 |
|---|---|---|
| 2個 | `{ kind: 'pair', lat: 1番目の数値, lng: 2番目の数値 }` | 1番目を緯度、2番目を経度とする（Googleマップのコピー形式「緯度, 経度」の順序に合わせる） |
| 1個 | `{ kind: 'single', value: その数値 }` | 単純な数値貼り付けとして扱う |
| 0個、または3個以上 | `{ kind: 'none' }` | 想定外の形式として扱う（15.4節参照） |

### 15.3 GoalFormでのペーストイベントの扱い

- 緯度欄・経度欄の両方に同一の `onPaste` ハンドラ（`(event: React.ClipboardEvent<HTMLInputElement>) => void`）を設定する。どちらの欄にペーストしても同じロジックが動く。
- ハンドラ内の処理：
  1. `event.clipboardData.getData('text')` で貼り付けテキストを取得する。
  2. `parseCoordinates(text)` を呼ぶ。
  3. `kind === 'pair'` の場合：`event.preventDefault()` でブラウザ標準のペースト動作をキャンセルし、緯度欄のstateに `String(result.lat)`、経度欄のstateに `String(result.lng)` を設定する（**貼り付けを行った欄がどちらであっても、常に緯度欄＝緯度・経度欄＝経度に書き込む**）。
  4. `kind === 'single'` または `kind === 'none'` の場合：`event.preventDefault()` を呼ばない。ブラウザの標準のペースト動作に委ね、貼り付けられた文字列がそのままフォーカス中の欄に挿入される（従来の単純な貼り付け・入力動作を維持する）。
- この処理はあくまで入力欄の文字列を書き換えるだけであり、`onSubmit`（目的地設定）は呼ばない。目的地が確定するのは、ユーザーが明示的に「目的地設定」ボタンを押したタイミングのみ（従来通り）。

### 15.4 曖昧なケースの扱い（設計判断）

以下はユーザー要件上で明示されていなかった曖昧なケースについて、spec-planner側で妥当と判断した仕様。developer実装時はこの判断に従う。

1. **数値が3個以上検出された場合**：`kind: 'none'` として「検出不可」と同じ扱いにする。自動振り分けは行わず、ブラウザの標準ペースト動作（貼り付け文字列をそのままフォーカス中の欄に挿入）に委ねる。これにより、どちらの数値を緯度・経度として採用すべきか判断できない曖昧な文字列を誤って解釈するリスクを避ける。
2. **数値が0個の場合（数字を含まない文字列の貼り付け）**：`kind: 'none'` として、同様にブラウザ標準のペースト動作に委ねる。
3. **数値の順序**：2個検出時は常に「1番目＝緯度、2番目＝経度」と解釈する（Googleマップの `緯度, 経度` コピー形式に準拠）。逆順（経度, 緯度）で貼り付けられるケースは区別できないため対応しない。
4. **区切り文字がカンマではなくスペースのみの場合**（例：`35.1371196 138.6607245`）：正規表現による数値抽出は区切り文字の種類に依存しないため、この場合も自動的に2値検出され振り分けられる。要件には明記されていないが、カンマ・スペースいずれの区切りでも同様に動作する方が自然であるため、この挙動を正式な仕様として採用する。
5. **意図しない数値の誤検出リスク**：解析は「数値らしき文字列を2個抽出できるか」だけで判定するため、座標以外の文字列（例：日付や関係のない数字を含む文章）を貼り付けた場合でも偶然2個の数値として誤検出される可能性がある。これは許容する。対象がGoalFormの緯度・経度欄に限定されていること、自動で目的地設定までは行われず最終的に既存の範囲チェック（7章）を通過しないと目的地が確定しないことから、実害は小さいと判断した。
6. **貼り付け後の範囲外の値**：貼り付けによって入力欄に反映された値が緯度-90〜90／経度-180〜180の範囲外であっても、貼り付け時点ではエラー表示を行わない（貼り付けは値の反映のみ）。「目的地設定」ボタン押下時に、既存の7章の入力チェックが通常通り実行され、エラーが表示される。
7. **数値の文字列化**：`parseCoordinates` の戻り値（`number`型）を入力欄のstateに反映する際は `String(result.lat)` のように変換する。GPS座標の値域（整数部3桁以下・小数部は現実的には10桁程度まで）ではJavaScriptの `Number → String` 変換で指数表記や精度の問題が発生しないため、貼り付け元の文字列をそのまま保持する方式ではなく、数値変換を経由する方式を採用する（`parseCoordinates` を純粋関数としてテストしやすくする目的とも合致する）。

---

## 16. 目的地のlocalStorage保存（2026-10-25追加承認）

「目的地設定」を押した緯度・経度をブラウザのlocalStorageに保存し、次回ページを開いたときに自動で復元する機能。ユーザー承認済みの追加要件。サーバー・DBは使わず、あくまで**端末のブラウザ内だけに閉じた保存**であり、0章の「サーバー・DBは使わない」という制約には抵触しない。

### 16.1 保存するデータ構造

- 保存先：`localStorage`、キー名は `DESTINATION_STORAGE_KEY = 'miti-compass:destination:v1'`（5.7節）。末尾の `:v1` は将来データ形式を変更した際に、古い形式のデータを安全に無視できるようにするためのバージョン番号。
- 値：`JSON.stringify({ lat, lng })` の文字列。`lat` / `lng` は `number` 型。
- **`goalReached`（GOAL状態）は保存しない。** 保存データには目的地の緯度・経度以外のフィールドを一切含めない。

### 16.2 保存タイミング

- 保存処理は `app/page.tsx` 側（GoalFormの `onSubmit` コールバックの実装内）で行う。**GoalFormコンポーネント自身はlocalStorageに関与しない**（3.2節の「props駆動の表示専用コンポーネント」という方針を維持するため）。
- `app/page.tsx` の `handleGoalSubmit(destination)`（GoalFormへ`onSubmit`として渡す関数）は、以下の順で処理する：
  1. `setDestination(destination)`
  2. `setGoalReached(false)`（目的地再設定時は必ずリセット。2章の既存ルールと同一）
  3. `saveDestination(destination)`（`utils/destinationStorage.ts`、5.7節）
- 入力エラーで `onSubmit` が呼ばれなかった場合（7章の範囲外・数値エラー時）は保存処理も実行されない（検証OKの場合のみ保存される）。

### 16.3 復元タイミング

- `app/page.tsx` の `destination` state は、**`useState` の遅延初期化（lazy initializer）** `useState<Coordinate | null>(() => loadDestination())` によって初期化する。`useEffect` 内で `loadDestination()` を呼んで `setDestination(...)` するという実装は採用しない。これは本プロジェクトのESLintルール `react-hooks/set-state-in-effect`（`useEffect` 本文内で直接 `setState` を呼ぶことを禁止するルール）に抵触するためであり、遅延初期化方式でも「ページマウント時に1回だけ復元する」という要件は同一に満たされる（むしろ `useEffect` の発火を待たず、`Home` コンポーネント自身の最初のレンダー時点で同期的に復元が完了するため、復元タイミングはより早く、GoalFormがどのタイミングでマウントされても復元済みの値を受け取れる）。
- `destination` stateの初期値が決まるのは `Home` コンポーネント自身の最初の呼び出し時点であり、これはページ内のどの子コンポーネント（GoalForm含む）がマウントされるよりも必ず先に完了する。したがって3.2節で前提としていた「GoalFormは`awaitingDestination`状態到達までマウントされない」という制約は、この実装方式では復元の正しさを保証するための必須条件ではなくなる（GoalFormがどの状態から最初にマウントされても、`initialDestination`には既に復元済みの値が渡っている）。ただし、GoalForm自体を許可フロー完了前に無効化（`disabled`）して表示する設計自体は維持する。
- GoalFormへは `initialDestination={destination}` として渡し、GoalForm側は3.2節で定義した遅延初期化でこれを入力欄の初期値として使う。
- **`goalReached` はこの復元処理で一切操作しない。** 復元後の初期値は常に `false`（デフォルト値のまま）であり、常に `tracking` 状態からスタートする。
  - 補足：復元した目的地の近くに既に端末がある場合、復元直後のGPS取得で距離が20m未満と判定され、通常の`tracking`→`goal`判定ロジックにより即座に`goal`状態へ遷移することがある。これは本機能にとって自然な挙動であり、意図的に防止しない。

### 16.4 localStorage不使用環境でのフォールバック方針

`utils/destinationStorage.ts` の `saveDestination` / `loadDestination`（5.7節）は、以下の方針で防御的に実装する。`any` は使用しない。

- **実行環境チェック**：関数の先頭で `typeof window === 'undefined'` をチェックし、真であれば（SSR中などブラウザ環境でない場合）何もせず `void` / `null` を返す。本アプリの `app/page.tsx` はクライアントコンポーネントであり実際にはSSR中に呼ばれることはないが、ユーティリティ単体としての安全性のため防御する。
- **例外の握りつぶし**：`localStorage.getItem` / `localStorage.setItem` の呼び出し、および `JSON.parse` / `JSON.stringify` の呼び出しはすべて `try...catch` で囲む。プライベートブラウズモードやストレージ無効化設定などで例外（`SecurityError`、`QuotaExceededError`等）が発生しても、`catch` 内で何もせず（あるいは `console.warn` で開発用ログのみ出し）、`saveDestination` は正常終了、`loadDestination` は `null` を返す。**例外を呼び出し元（`app/page.tsx`）に伝播させない。**
- **呼び出し元への影響なし**：`app/page.tsx` は `saveDestination` / `loadDestination` の戻り値だけを見て動作するため、これらが「保存/復元できなかった」という結果を返すだけで、目的地設定・コンパス表示・距離表示といった他の機能には一切影響しない（12章の受け入れ基準12番）。

### 16.5 保存データが不正な形式だった場合の扱い

`loadDestination()` は、以下のいずれかに該当する場合、**「保存なし」と完全に同一に扱い `null` を返す**（エラー表示やログ以上の特別処理はしない）。

- `localStorage.getItem(DESTINATION_STORAGE_KEY)` が `null`（未保存）
- 取得した文字列が `JSON.parse` できない（壊れたJSON）
- `JSON.parse` の結果が `object` でない、または `null`
- `lat` / `lng` のいずれかが `number` 型でない、または `Number.isFinite` が `false`（`NaN` / `Infinity` を含む）
- `lat` が `-90〜90` の範囲外、または `lng` が `-180〜180` の範囲外（7章と同じ範囲チェックをここでも適用する）

型チェックは `unknown` 型とユーザー定義の型ガード関数で行う（`any` は使わない）。例：

```ts
function isStoredDestination(value: unknown): value is StoredDestination {
  if (typeof value !== 'object' || value === null) return false
  const { lat, lng } = value as Record<string, unknown>
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
  )
}
```

壊れた・不正なデータが見つかった場合に、そのキーをlocalStorageから削除する（クリーンアップする）かどうかは実装上の任意とし、**仕様としては必須としない**（`null` を返すことだけが必須の挙動であり、削除してもしなくても動作上の差はない）。

### 16.6 既存設計への影響まとめ

- **2章（状態遷移）**：初期表示時の復元ルールを補足ルールに追加済み（本章参照のリンクを追加）。
- **3.2節（GoalForm）**：`initialDestination` propを追加し、遅延初期化で初期値として使う設計を追加済み。
- **5章（utils設計）**：`5.7 utils/destinationStorage.ts` を新設済み。
- **10章（ファイル構成）**：`utils/destinationStorage.ts` を追加済み。
- **12章（完成条件）**：保存・復元の確認項目（#11）、localStorage不使用環境でも通常動作する確認項目（#12）を追加済み。
- **13章（Phase2候補）**：目的地の永続化はMVPに取り込み済みである一方、**GOAL状態（goalReached）の永続化は依然Phase2候補**として明記済み（意図的にスコープ外とする）。
- **hooksではなくutilsに置いた理由**：`saveDestination` / `loadDestination` はReactのライフサイクルやイベント購読（`useEffect`での継続的なlisten、`useRef`での可変値保持など）を必要としない単純な読み書き関数であり、`useGeolocation` / `useCompass` のような「継続的にブラウザAPIを購読するstateful hook」とは性質が異なる。4章のhooksはイベントリスナーの登録・解除・継続的な状態更新を担うものに限定し、単発の読み書きは5章のutilsに置くという一貫した方針を採用した。

---

## 17. 座標を貼り付けボタン（クリップボード読み取り・2026-10-25追加承認）

GoalFormの緯度・経度入力欄の上に、クリップボードの内容をワンタップで読み取り自動解析するボタンを追加する機能。ユーザー承認済みの追加要件。15章（入力欄への直接ペースト）とは別の入力手段であり、両者は`parseCoordinates`を共有する（15章冒頭の役割分担の説明を参照）。

### 17.1 UI配置・ラベル

- 配置位置：GoalForm内、緯度・経度の入力欄2つの**直前（上）**。
- ボタンのラベル文言（固定文字列、そのまま使用する）：

  ```
  📋 Googleマップの座標を貼り付け
  ```

- ボタンの `disabled` 状態：GoalForm全体の `disabled` prop（権限確認未完了時にtrue）と連動させる。これは既存の緯度・経度入力欄・「目的地設定」ボタンと同じ扱いであり、特別な個別制御は行わない。
- ボタン押下後に表示されるメッセージ（17.4節）は、ボタンの直下・入力欄の直前に表示する専用の表示領域に出す。

### 17.2 `navigator.clipboard.readText()` の制約（型定義・実行環境）

- `navigator.clipboard.readText(): Promise<string>` は標準のWeb APIであり、TypeScriptの `lib.dom.d.ts` に型定義が既に含まれているため、6章のような**型拡張（declaration merging）は不要**。`any` も不要。
- 実行環境・ユーザー操作に関する制約（ユーザー承認済みの他API：iOSの`DeviceOrientationEvent.requestPermission()`と同種の制約として明記する）：
  - **secureContext（HTTPS）が必須**。本番（Vercel）は自動的にHTTPSのため問題ないが、ローカル開発でスマホ実機から確認する場合は `next dev --experimental-https` を使う必要がある（既存の11章の記載と同じ制約）。
  - **ユーザー操作（クリックイベント）の中から呼び出す必要がある**。ボタンの `onClick` ハンドラ内から直接 `await navigator.clipboard.readText()` を呼ぶ形であれば、間に他の `await` を挟んでいないため、主要ブラウザ（Chrome・Safari）の「トランジェント・アクティベーション（直近のユーザー操作から短時間は有効とみなす仕組み）」の範囲内で問題なく動作する。iOSの`DeviceOrientationEvent.requestPermission()`のような「間に一切の非同期処理を挟んではならない」という厳格な制約ではない点が異なる。
  - ブラウザ・OSによっては、呼び出し時にクリップボード読み取りの許可ダイアログが表示される場合がある（Chrome等）。ユーザーが拒否した場合は `readText()` が例外を投げる。
  - クリップボードの内容がテキストでない（画像のみ等）場合や、クリップボードが空の場合も例外や空文字列になり得る。これらはすべて17.3節の失敗分岐でまとめて扱う。

### 17.3 処理フロー

ボタンの `onClick` ハンドラ（`async`）は以下の順で処理する。

1. **APIの存在チェック**：`typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function'` を確認する。`false` の場合は手順4（読み取り失敗）に進む。
2. **読み取り**：`try { const text = await navigator.clipboard.readText() } catch { ... }` の形で呼び出す。例外が発生した場合（許可拒否・非対応・その他のエラー）は手順4に進む。
3. **解析**：読み取りに成功したら `const result = parseCoordinates(text)`（5.5節）を呼び、`result.kind` で分岐する。
   - `kind === 'pair'`：緯度欄のstateに `String(result.lat)`、経度欄のstateに `String(result.lng)` を設定する。表示中のメッセージ（17.4節）があればクリアする。
   - `kind === 'single'` または `kind === 'none'`：**手順5（解析失敗）**に進む。
4. **読み取り失敗時の表示**：メッセージ領域に「入力欄を長押しして貼り付けてください」を表示し、**緯度欄にフォーカスを移動する**（`latInputRef.current?.focus()`）。入力欄の値は変更しない。
5. **解析失敗時の表示**：メッセージ領域に「座標が見つかりません。Googleマップで地点を長押しして座標をコピーしてください」を表示する。フォーカス移動は行わない（クリップボードの読み取り自体は成功しているため、緯度欄への強制フォーカスは不要と判断）。入力欄の値は変更しない。

いずれの分岐でも、`onSubmit`（目的地設定）は呼ばれない。目的地の確定は従来どおりユーザーが「目的地設定」ボタンを押したときのみ行われる。

### 17.4 エラー文言の表示場所

- ボタン用のメッセージは、**7章の入力バリデーションエラー（送信時に表示される赤文字のエラー）とは別の、独立した表示領域**に表示する。理由：
  - 表示されるタイミングが異なる（バリデーションエラーは「目的地設定」押下時のみ、ボタンのメッセージはボタン押下時のみ発生する）。
  - 意味合いが異なる（バリデーションエラーは「入力されている値が不正」であるのに対し、ボタンのメッセージは「クリップボードの読み取り・解析に関する案内」であり、入力欄の現在の値の正しさとは無関係）。
  - 両者を同じ表示領域で共有すると、どちらの操作に対する反応かユーザーが混同しやすい。
- 表示位置：ボタンの直下（入力欄より上）。GoalForm内部に `pasteButtonMessage: string | null` というstateを持ち、17.3節の分岐に応じて設定する。
- メッセージのクリア条件：
  - ボタンを再度押して `pair` の解析に成功したとき（成功時は暗黙的にクリアする＝メッセージ自体を表示しない）。
  - ユーザーが緯度・経度いずれかの入力欄を編集したとき（`onChange`時にクリアする。古いメッセージが入力欄の現在の状態と無関係になるのを防ぐ）。
- スタイル：7章のバリデーションエラー（赤文字）とは視覚的に区別する（例：グレーや青系の案内文字色）。具体的な配色はdeveloper側のデザイン実装に委ねる。

### 17.5 README向けの案内文（Googleマップでの座標コピー手順）

11章のREADMEに、以下の案内文をそのまま転記する。

```
Googleマップで座標をコピーする方法（Android / iPhone 共通）

1. Googleマップ（アプリまたはブラウザ版）を開き、目的地にしたい地点を長押しする
2. 画面下部に表示される地点情報、またはピンのポップアップに表示される
   緯度・経度の数値（例：35.137, 138.660）をタップする
   → 自動的に「緯度, 経度」の形式でクリップボードにコピーされる
3. 街歩きコンパスのページに戻り、「📋 Googleマップの座標を貼り付け」ボタンを押す
   （ボタンが使えない場合は、緯度・経度どちらかの入力欄に直接貼り付けても同じ結果になる）
4. 緯度欄・経度欄に自動で入力されたことを確認し、「目的地設定」ボタンを押す
```

### 17.6 既存設計への影響まとめ

- **3.2節（GoalForm）**：ボタンの追加、プレースホルダー文言の変更を反映済み。
- **5章**：新規のutilsファイルは追加しない（`parseCoordinates` を15章と共有するため）。
- **11章（README）**：Googleマップでの座標コピー手順の案内文を追加する指示を追加済み。
- **12章（完成条件）**：#13〜#15として受け入れ基準を追加済み。
- **15章**：冒頭に17章との役割分担の説明を追加済み。
- **型定義（6章）への影響なし**：`navigator.clipboard.readText()` は標準APIのため型拡張は不要（17.2節）。
