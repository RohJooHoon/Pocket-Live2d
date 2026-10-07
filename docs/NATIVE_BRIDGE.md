# Native Bridge Contract

Pocket Live2D의 Flutter 계층과 iOS/Android Native 계층 사이의 계약입니다.

## 1. PlatformView

Flutter view type:

```text
pocket_live2d/view
```

Flutter widget:

```dart
Live2DView(modelId: 'haru')
```

### creationParams

| Key | Type | Required | Description |
|---|---|---:|---|
| `modelId` | String | No | 초기 로드할 모델 식별자 |
| `backgroundColor` | int | No | ARGB 색상 |

Android는 `PlatformViewFactory`, iOS는 `FlutterPlatformViewFactory`로 동일한 `viewType`을 등록합니다.

---

## 2. MethodChannel

```text
pocket_live2d/live2d
```

### Methods

#### `initialize`

Native Live2D 런타임을 초기화합니다.

Arguments: 없음

#### `loadModel`

```json
{
  "modelId": "haru"
}
```

#### `playMotion`

```json
{
  "group": "TapBody",
  "index": 0
}
```

`index`는 선택입니다.

#### `setExpression`

```json
{
  "expressionId": "happy"
}
```

#### `setGyroEnabled`

```json
{
  "enabled": true
}
```

자이로 모드 활성화 시 Native에서 센서를 구독하고 Live2D 파라미터에 반영합니다.

#### `setMimicEnabled`

```json
{
  "enabled": true
}
```

앱 모드에서만 사용합니다. 활성화 시 전면 카메라와 얼굴 추적을 시작하고, 비활성화 시 즉시 카메라 세션을 종료합니다.

Android Wallpaper에서는 이 API를 호출해 카메라를 켜지 않습니다.

#### `lookAt`

```json
{
  "x": 0.5,
  "y": -0.2
}
```

범위는 각각 `-1.0 ... 1.0`입니다.

#### `dispose`

센서, 카메라, renderer resource를 해제합니다.

---

## 3. EventChannel — Face Tracking

```text
pocket_live2d/face_tracking
```

Event payload:

```json
{
  "headYaw": 0.0,
  "headPitch": 0.0,
  "headRoll": 0.0,
  "eyeBlinkLeft": 0.0,
  "eyeBlinkRight": 0.0,
  "eyeLookX": 0.0,
  "eyeLookY": 0.0,
  "mouthOpen": 0.0,
  "mouthForm": 0.0,
  "browLeft": 0.0,
  "browRight": 0.0,
  "trackingConfidence": 1.0
}
```

### Normalization

- `eyeBlinkLeft/Right`: `0 = open`, `1 = closed`
- `eyeLookX/Y`: `-1 ... 1`
- `mouthOpen`: `0 ... 1`
- `mouthForm`: `-1 ... 1`
- `trackingConfidence`: `0 ... 1`
- Head rotation은 Live2D 기본 angle 단위와 쉽게 매핑할 수 있도록 degree 계열 값을 우선합니다.

플랫폼별 원본 API 이름을 Flutter 계층으로 노출하지 않습니다.

---

## 4. EventChannel — Orientation

```text
pocket_live2d/orientation
```

```json
{
  "x": 0.0,
  "y": 0.0,
  "z": 0.0
}
```

세 값은 portrait 기준 `-1 ... 1`로 정규화합니다.

Flutter의 `OrientationFilter`는 dead-zone과 smoothing의 reference 구현입니다. 실제 렌더링에서 latency가 문제가 되면 동일 규칙을 Native renderer 내부에 적용하고 Flutter EventChannel은 UI/debug용으로 낮은 빈도로 전달할 수 있습니다.

---

## 5. Input Mode Rule

동시에 하나의 primary input mode만 활성화합니다.

```text
idle
  Gyro OFF
  Mimic OFF

gyro
  Mimic OFF
  Gyro ON

mimic
  Gyro OFF
  Mimic ON
```

Flutter의 `CharacterInteractionCoordinator`가 이 전환 순서를 관리합니다.

---

## 6. Performance Rule

고주파 렌더링 데이터는 최종적으로 Native renderer 안에서 처리하는 방향을 우선합니다.

```text
Sensor / Camera
      ↓
Native Tracking
      ↓
Normalize / Filter
      ↓
Live2D Native Renderer
```

Flutter는 모드 변경, 설정, 모델 관리, UI와 debug state를 담당합니다.

센서 또는 얼굴 데이터를 매 프레임 `Native → Flutter → Native` 왕복시키는 구조는 프로토타입 검증 외에는 피합니다.

---

## 7. Android Wallpaper Reuse

Android 앱과 Wallpaper는 가능한 한 동일한 Native 계층을 공유합니다.

```text
Live2D Model Loader
Parameter Mapper
Motion Controller
Sensor Controller
Renderer
```

Wallpaper 전용 계층은 다음 역할만 추가합니다.

```text
WallpaperService
Visibility Lifecycle
Surface Lifecycle
FPS / Battery Policy
```

카메라 얼굴 추적은 Wallpaper에 포함하지 않습니다.
