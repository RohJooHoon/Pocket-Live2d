# Flutter + Live2D 인터랙티브 캐릭터 앱 / Android 라이브 월페이퍼 개발 계획서

> 목표: iOS/Android 공통 앱에서 Live2D 캐릭터가 자이로·터치·흔들기·전면 카메라 얼굴 트래킹에 반응하도록 만들고, Android에서는 동일 캐릭터를 실제 Live Wallpaper로도 사용할 수 있게 한다.
>
> 작성일: 2026-10-07

## 1. 프로젝트 한 줄 정의

**"앱 안에서는 사용자를 보고 따라 하는 Live2D 캐릭터, Android에서는 홈 화면에도 함께 있는 인터랙티브 캐릭터."**

## 2. 플랫폼별 제품 범위

| 기능 | iOS 앱 | Android 앱 | Android Wallpaper |
|---|---:|---:|---:|
| Live2D 표시 | O | O | O |
| 자이로/기울기 반응 | O | O | O |
| 터치/드래그 상호작용 | O | O | O |
| 흔들기 반응 | O | O | 선택 |
| Idle / Motion / Expression | O | O | O |
| 전면 카메라 얼굴 트래킹 | O | O | X |
| 사용자의 표정/고개 따라하기 | O | O | X |
| 실제 시스템 홈 배경화면 | X | X | O |

## 3. 권장 아키텍처

```text
                         Flutter
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
 Character UI          Settings/Models       Mode Control
       │                    │                    │
       └────────────────────┬────────────────────┘
                            │
                    Platform Interface
                            │
              ┌─────────────┴─────────────┐
              │                           │
             iOS                       Android
              │                           │
       Live2D Renderer              Live2D Renderer
       Face Tracking               Face Tracking
       Motion/Sensor               Motion/Sensor
                                          │
                                   WallpaperService
```

Flutter는 Shell/UI와 공통 상태/설정을 담당하고, Live2D 렌더링·얼굴 추적·센서·카메라·Wallpaper는 Native 계층에서 처리한다.

## 4. 공통 상태 모델

### OrientationState

```text
x: -1.0 ~ 1.0
y: -1.0 ~ 1.0
z: -1.0 ~ 1.0
```

### FaceTrackingState

```text
headYaw
headPitch
headRoll

eyeBlinkLeft
eyeBlinkRight

eyeLookX
eyeLookY

mouthOpen
mouthForm

browLeft
browRight

trackingConfidence
```

### Live2D 기본 매핑

```text
headYaw        → ParamAngleX
headPitch      → ParamAngleY
headRoll       → ParamAngleZ
eyeLookX       → ParamEyeBallX
eyeLookY       → ParamEyeBallY
eyeBlinkLeft   → ParamEyeLOpen
eyeBlinkRight  → ParamEyeROpen
mouthOpen      → ParamMouthOpenY
mouthForm      → ParamMouthForm
```

## 5. 움직임 품질

센서 값을 Live2D에 직접 넣지 않는다.

```text
Sensor / Face Tracking
  ↓
normalize
  ↓
dead-zone
  ↓
low-pass / interpolation
  ↓
per-part gain
  ↓
Live2D Parameter
```

권장 초기 반응 속도:

```text
Eye  : 0.18
Head : 0.10
Body : 0.04
```

## 6. MVP 범위

### 공통 앱

- [x] Flutter 기반 iOS/Android 앱 Shell
- [ ] iOS/Android 앱 내부 Live2D 캐릭터 표시
- [ ] 기기 기울기 → 눈/머리/몸 반응
- [ ] 터치 위치 바라보기
- [ ] 캐릭터 터치 → Motion/Expression
- [ ] 흔들기 → 반응 Motion
- [x] `따라하기` 버튼
- [ ] 따라하기 ON → 전면 카메라 활성화
- [ ] 얼굴 방향/눈 깜빡임/입 벌림 추적
- [ ] 추적값 → 공통 `FaceTrackingState`
- [x] `FaceTrackingState` → Live2D Parameter
- [ ] 따라하기 OFF → 카메라 즉시 종료

### Android 추가

- [ ] `WallpaperService`
- [ ] 앱에서 사용한 Live2D 모델을 실제 홈 화면에 표시
- [ ] Wallpaper에서 자이로/터치/Idle Motion
- [ ] Wallpaper invisible 상태에서 렌더링/센서 최소화
- [ ] 실제 Galaxy 테스트

## 7. 기술 스택

| 영역 | 선택 |
|---|---|
| 공통 앱 | Flutter / Dart |
| iOS Native | Swift |
| Android Native | Kotlin |
| Live2D | Cubism SDK Native 계층 중심 |
| Flutter ↔ Native | Platform Channel 또는 전용 Flutter Plugin |
| Android Wallpaper | `WallpaperService` |
| 센서 | iOS Core Motion / Android Sensor API |
| iOS 얼굴 추적 | ARKit 계열 우선 검토 |
| Android 얼굴 추적 | 전면 RGB 카메라 기반 landmark/blendshape 엔진 검토 |
| 카메라 | iOS AVFoundation / Android CameraX |
| 테스트 | 실제 iPhone + 실제 Galaxy |

## 8. 개발 단계

### Phase A — Flutter + Native Live2D 기반

- [ ] Flutter 프로젝트 생성
- [x] iOS/Android Native bridge 구조 결정
- [x] 공통 `Live2DController` Dart API 설계
- [ ] Android Native Live2D 샘플 실행
- [ ] iOS Native Live2D 샘플 실행
- [ ] Flutter 화면 안에 Native Live2D surface 표시
- [ ] 동일 테스트 모델을 iOS/Android에서 표시
- [ ] Flutter → Native `playMotion()` 호출
- [ ] Flutter → Native `setExpression()` 호출

완료 조건: 동일 Flutter 앱에서 iPhone과 Galaxy 모두 같은 Live2D 캐릭터가 표시되고 Flutter 버튼으로 Motion을 실행할 수 있다.

### Phase B — 자이로/터치/흔들기

- [x] iOS orientation 입력
- [x] Android Rotation Vector 입력
- [x] 플랫폼 값을 공통 `OrientationState`로 정규화
- [x] Eye / Head / Body gain 분리
- [x] dead zone
- [x] smoothing
- [x] 터치 위치 → LookAt
- [ ] HitArea 터치 → Motion
- [x] drag → 시선 추적
- [ ] shake gesture 검출

### Phase C — 따라하기 / Face Tracking

- [x] Flutter에 `따라하기` 버튼 추가
- [ ] 카메라 권한 UX 작성
- [ ] 따라하기 ON/OFF lifecycle
- [ ] iOS 얼굴 방향/눈/입 추출
- [ ] Android 얼굴 landmark/blendshape 엔진 선정
- [ ] Android 얼굴 방향/눈/입 추출
- [x] 공통 `FaceTrackingState` 정의
- [ ] tracking confidence 처리
- [ ] 얼굴 미검출 시 자연스럽게 Idle 복귀
- [x] FaceTracking → Live2D Parameter Mapper
- [ ] smoothing / calibration
- [ ] 저조도/안경/가림 테스트
- [ ] 장시간 카메라 사용 발열 확인

### Phase D — Android Live Wallpaper

- [ ] `WallpaperService`
- [ ] 공통 모델 로더 재사용
- [ ] 공통 Parameter Mapper 재사용
- [ ] Gyro
- [ ] Touch
- [ ] Idle Motion
- [ ] visibility lifecycle
- [ ] FPS 제한
- [ ] 배터리 테스트
- [ ] 앱 → Wallpaper 설정 진입 UX

## 9. 프로젝트 구조 목표

```text
lib/
├── app/
├── features/
│   ├── character/
│   ├── mimic/
│   └── settings/
├── live2d/
│   ├── live2d_controller.dart
│   ├── live2d_method_channel.dart
│   └── models/
└── main.dart

android/
└── app/src/main/kotlin/.../
    ├── live2d/
    ├── sensor/
    ├── tracking/
    └── wallpaper/

ios/
└── Runner/
    ├── Live2D/
    ├── Tracking/
    └── Sensor/
```

## 10. Flutter ↔ Native API 초안

```dart
abstract interface class Live2DController {
  Future<Live2DCapabilities> initialize();
  Future<void> loadModel(String modelId);
  Future<void> playMotion(String group, {int? index});
  Future<void> setExpression(String expressionId);
  Future<void> setMimicEnabled(bool enabled);
  Future<void> setGyroEnabled(bool enabled);
  Future<void> lookAt(double x, double y);
  Future<void> setParameters(Live2DParameterState state);
  Future<void> calibrate();
  Future<void> setActive(bool active);
  Future<void> dispose();
}
```

Native method channel 후보:

```text
pocket_live2d/live2d

initialize
loadModel
playMotion
setExpression
setMimicEnabled
setGyroEnabled
lookAt
setWallpaper
setParameters
calibrate
setActive
```

## 11. 카메라/프라이버시 원칙

- 얼굴 트래킹은 사용자가 `따라하기`를 직접 켰을 때만 활성화한다.
- 모드 종료 즉시 카메라 세션을 종료한다.
- 얼굴 영상은 기본적으로 저장하지 않는다.
- 추적에 필요한 수치 데이터만 실시간 처리한다.
- Android Wallpaper에서는 카메라를 사용하지 않는다.

## 12. Sprint

### Sprint 0 — 기술 검증

- [ ] 현재 Live2D Cubism SDK의 iOS/Android 지원 방식 확인
- [ ] 배포/수익화 라이선스 확인
- [ ] iOS 얼굴 추적 방식과 지원 기기 범위 검증
- [ ] Android 얼굴 추적 라이브러리 후보 비교
- [x] Flutter PlatformView/Texture/Native Surface 연결 방식 결정
- [ ] Android Wallpaper에서 공통 Live2D 코드 재사용 구조 결정

### Sprint 1 — Cross-platform Live2D

- [ ] Flutter 프로젝트 생성
- [ ] iOS Native Live2D 연결
- [ ] Android Native Live2D 연결
- [ ] 동일 모델 로드
- [ ] Motion API
- [ ] Expression API
- [x] Flutter controller API 정리

### Sprint 2 — Interaction

- [ ] Gyro
- [ ] Eye
- [ ] Head
- [ ] Body
- [x] Touch LookAt
- [ ] HitArea
- [ ] Shake
- [x] smoothing
- [ ] calibration

### Sprint 3 — 따라하기

- [ ] 전면 카메라
- [ ] iOS Face Tracking
- [ ] Android Face Tracking
- [x] FaceTrackingState
- [x] Head mapping
- [x] Blink mapping
- [x] Mouth mapping
- [ ] Expression mapping
- [ ] 얼굴 미검출 처리
- [ ] 카메라 lifecycle
- [ ] 발열/성능 테스트

### Sprint 4 — Android Wallpaper

- [ ] WallpaperService
- [ ] 공통 모델 로더 재사용
- [ ] 공통 Parameter Mapper 재사용
- [ ] Gyro
- [ ] Touch
- [ ] Idle Motion
- [ ] visibility lifecycle
- [ ] FPS 제한
- [ ] 배터리 테스트
- [ ] 앱 → Wallpaper 설정 진입 UX

## 13. MVP Definition of Done

### iPhone

- [ ] 앱 실행 시 Live2D 캐릭터 표시
- [ ] 기울이면 눈/머리/몸 반응
- [ ] 터치/드래그 반응
- [ ] 흔들기 반응
- [ ] `따라하기` ON 시 전면 카메라 활성화
- [ ] 고개 좌우/상하/기울기 추적
- [ ] 눈 깜빡임 추적
- [ ] 입 벌림 추적
- [ ] 따라하기 OFF 시 카메라 종료

### Android 앱

- [ ] iPhone과 동일한 핵심 앱 상호작용
- [ ] 얼굴 추적 품질이 MVP 허용 범위 내에서 안정적
- [ ] 기기별 카메라 차이에 대한 fallback 처리

### Android Wallpaper

- [ ] 실제 홈 화면에 Live2D 표시
- [ ] 기울기 반응
- [ ] 터치 반응
- [ ] Idle Motion
- [ ] 앱에서 설정한 캐릭터/민감도 사용
- [ ] 카메라는 사용하지 않음
- [ ] 화면에 보이지 않을 때 렌더링/센서 최소화

## 14. 제품 정의

> **Interactive Live2D Character App**
>
> iOS와 Android에서는 캐릭터를 만지고, 기울이고, 흔들고, 자신의 표정을 따라 하게 할 수 있다. Android에서는 같은 캐릭터를 홈 화면의 Live Wallpaper로도 데려갈 수 있다.

핵심 차별화:

```text
Presence
   =
Gyro
 + Touch
 + Shake
 + Face Mimic
 + Motion
 + Character State

Android
   +
Live Wallpaper
```

## 15. 참고

- Live2D Cubism SDK: https://www.live2d.com/en/sdk/
- Cubism SDK Manual: https://docs.live2d.com/en/cubism-sdk-manual/top/
- Android Live Wallpaper sample: https://github.com/Live2D/CubismAndroidLiveWallpaper

Cubism Core 바이너리는 공식 SDK 배포 패키지 기준으로 관리하며 저장소에는 커밋하지 않는다.


## 16. 진행 현황 — 2026-10-07

체크된 항목은 코드 구현 기준이다. 실기기 완료 조건(13절)은 실제 모델과
센서 검증 전까지 체크하지 않는다. Flutter host 프로젝트는 bootstrap으로 생성한다.
`따라하기` UI는 표시하되 비활성화되어 있으며 카메라 기능은 아직 구현하지 않았다.
FaceTracking parameter mapper도 현재는 공통 데이터 변환만 구현했다.

### 이번 구현

- [x] path dependency 기반 Android/iOS native plugin 자동 등록
- [x] MethodChannel/EventChannel 및 capability 응답
- [x] Android View / iOS UIView 진단 surface
- [x] Android rotation quaternion / iOS deviceMotion 입력
- [x] baseline calibration 및 -1..1 정규화
- [x] 터치/드래그 입력과 기울기 입력 우선순위
- [x] dead zone, 부위별 보간, 30Hz 입력 업데이트
- [x] foreground/stream cancel/dispose 센서 수명 관리
- [x] native 실패 시 UI 토글 상태 보존
- [x] 느린 native 응답에 대한 최신값 병합
- [x] 기존 앱/host 파일을 보존하는 bootstrap
- [x] Flutter/JVM/Shell 회귀 테스트 및 GitHub Actions 구성

### 다음 순서

1. [ ] Cubism 공식 SDK/Core 설치 및 테스트 모델 확보; 사용/배포 권한 확인
2. [ ] Android/iOS 실제 renderer와 model loader 연결 — Phase A 완료 조건 충족
3. [ ] Motion/Expression/HitArea와 shake 검출 추가
4. [ ] 실제 iPhone/Galaxy에서 축 방향, 재보정, background 복귀 검증
5. [ ] iOS 얼굴 추적 지원 범위와 Android 엔진 선정 후 따라하기 구현
6. [ ] Wallpaper용 native 공통 mapper/loader와 WallpaperService 구현
7. [ ] 실제 배터리·발열·추적 품질 검증

구현 계약과 연결 지점: [`NATIVE_BRIDGE.md`](NATIVE_BRIDGE.md).
검증 결과와 실행 방법은 README의 현재 상태 및 검증 절을 확인한다.
