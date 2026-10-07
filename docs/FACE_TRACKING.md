# Mimic / Face Tracking

Pocket Live2D의 `따라하기(Mimic)` 모드는 전면 카메라에서 얼굴 움직임을 추적한 뒤 공통 `FaceTrackingState` 형태로 정규화합니다.

## 공통 출력

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

Flutter와 Live2D renderer는 플랫폼별 원본 API를 직접 알지 않습니다.

## iOS

현재 구현은 ARKit `ARFaceTrackingConfiguration`과 `ARFaceAnchor.blendShapes`를 사용합니다.

매핑:

```text
head transform        -> headYaw / headPitch / headRoll
eyeBlinkLeft/Right    -> eyeBlinkLeft/Right
eyeLook*              -> eyeLookX/Y
jawOpen               -> mouthOpen
mouthSmile - frown    -> mouthForm
browOuterUp/innerUp   -> browLeft/Right
```

`setMimicEnabled(true)` 호출 시 ARKit face session을 시작하고, `false` 시 즉시 중단합니다.

이벤트는 최대 약 30 Hz로 Flutter EventChannel에 전달하며 같은 값을 Native renderer에도 전달합니다.

### 권한

호스트 앱에는 `NSCameraUsageDescription`이 필요합니다. `tool/bootstrap_platforms.sh`가 플랫폼 생성 후 자동으로 추가합니다.

ARKit face tracking이 지원되지 않는 기기에서는 `face_tracking_unavailable` 오류를 반환합니다.

## Android

Android는 CameraX 전면 카메라의 RGBA 프레임을 MediaPipe Face Landmarker LIVE_STREAM 모드로 처리한다.
blendshapes와 facial transformation matrix를 공통 얼굴 상태로 정규화한다.
Gradle이 공식 Face Landmarker task 모델을 내려받아 Native asset에 포함한다.

행/픽셀 stride를 반영해 프레임을 읽고 session token으로 종료된 세션의 결과를 차단한다.
카메라 binding 완료 후 setMimicEnabled(true)에 성공을 응답한다.
권한 대기/시작 중 OFF 또는 background 전환은 pending 요청을 취소한다.
Android 7.0(API 24) 미만에서는 face_tracking_unavailable을 반환한다.

두 플랫폼 모두 실기기 정확도·가림·저조도·장시간 발열 검증이 아직 필요하다.

## Privacy

- Mimic 모드를 사용자가 직접 켠 동안에만 전면 카메라를 사용합니다.
- Mimic 모드 종료 즉시 카메라/추적 세션을 중단합니다.
- 얼굴 영상은 기본적으로 저장하지 않습니다.
- 앱 내부 캐릭터 애니메이션을 위한 수치 데이터만 실시간 처리하는 것을 기본 정책으로 합니다.
- Android Live Wallpaper에서는 카메라를 사용하지 않습니다.
