# Native bridge 및 입력 계약

## 구현 범위

`packages/pocket_live2d_native`는 앱의 path dependency인 Flutter plugin이다.
Flutter의 GeneratedPluginRegistrant가 Kotlin/Swift 구현을 등록하므로
생성된 MainActivity/AppDelegate를 직접 수정하지 않는다.

현재 native surface는 **입력 진단 화면**이다. Live2D 모델을 렌더링하지 않는다.
`initialize`가 성공해도 `renderer: false`이며 `loadModel`, `playMotion`,
`setExpression`은 `renderer_unavailable` 오류를 반환한다.
카메라 권한을 요청하거나 카메라 세션을 시작하는 코드는 없다.

## 채널

| 종류 | 이름 | 내용 |
|---|---|---|
| MethodChannel | `pocket_live2d/live2d` | 제어 명령 |
| EventChannel | `pocket_live2d/orientation` | 정규화 기울기 |
| EventChannel | `pocket_live2d/face_tracking` | 향후 얼굴 추적용; 현재 이벤트 없음 |
| PlatformView | `pocket_live2d/surface` | 입력 진단용 Android View / UIView |

| 명령 | 인자 | 결과 |
|---|---|---|
| `initialize` | 없음 | `nativeSurface`, `gyro`, `renderer`, `mimic`, `wallpaper` bool map |
| `setGyroEnabled` | `enabled: bool` | 센서 지원 여부 검사 후 활성화 |
| `setActive` | `active: bool` | foreground 입력/파라미터 업데이트 허용 |
| `calibrate` | 없음 | 다음 유효 센서 샘플을 새 중립 자세로 설정 |
| `setParameters` | Cubism parameter ID → finite double map | 진단 화면에 값 전달 |
| `lookAt` | `x`, `y`: finite double | 직접 시선 입력; 앱은 보간된 `setParameters` 경로 사용 |
| `setMimicEnabled` | `enabled: bool` | false는 안전한 종료, true는 `mimic_unavailable` |
| `loadModel`, `playMotion`, `setExpression` | 기존 Dart API 인자 | `renderer_unavailable` |
| `setWallpaper` | 없음 | `wallpaper_unavailable` |
| `dispose` | 없음 | 센서 종료, 입력 값 초기화; 반복 호출 가능 |

초기화 전 제어 명령은 `not_initialized`, 잘못된 인자는 `invalid_arguments`,
센서 없는 기기의 활성화 요청은 `sensor_unavailable`을 반환한다.

## 센서 좌표와 수명

- 앱은 portraitUp을 사용한다. landscape 좌표 재매핑은 후속 작업이다.
- Android: GAME_ROTATION_VECTOR 우선, ROTATION_VECTOR fallback.
- iOS: Core Motion deviceMotion, xArbitraryZVertical reference frame.
- quaternion은 `w,x,y,z` 순서로 통일한다.
- 시작/복귀/보정 후 첫 샘플을 baseline으로 저장하고 `inverse(baseline) * current`를 계산한다.
- 상대 quaternion을 짧은 회전의 axis-angle로 변환한다. q와 -q는 같은 자세로 취급한다.
- 상대 Y축 회전 → x, X축 회전 → y, Z축 회전 → z. 45°를 1로 정규화하고 -1..1로 제한한다.
- 기기 간 좌우/상하 체감 방향 및 센서 drift는 실제 iPhone/Galaxy 검증이 필요하다.
- 활성화 + foreground + Dart listener가 모두 있을 때만 센서를 구독한다.
- 백그라운드, stream cancel, activity detach, engine detach, dispose에서 중지한다.

## 공통 앱 파이프라인

`Live2DSession`이 orientation stream과 30Hz 입력 업데이트를 소유한다.
정규화 값 → 연속 dead zone(0.04) → 머리/눈/몸 매핑 → 시간 보정 low-pass →
`setParameters` 순서로 처리한다. 보간 계수는 60Hz에서 눈 0.18, 머리 0.10, 몸 0.04다.

터치 좌표는 좌하단 (-1,-1), 우상단 (1,1)로 정규화한다.
드래그 중에는 터치가 기울기보다 우선하며, 손을 떼면 최신 기울기/중립값으로 보간한다.
HitArea 판정과 탭 Motion 실행은 모델 로더 연결 이후 구현한다.

동시에 진행 중인 `setParameters` 호출은 최대 1개다. 느린 응답 동안의 입력은
최신값 하나로 합친다. dispose는 진행 중인 명령/전송 종료와 stream 취소 후 native를 해제한다.
기울기 토글은 native 호출 성공 후에만 UI에 반영한다.

Android Wallpaper는 Flutter isolate가 없으므로 현재 Dart mapper를 직접 쓸 수 없다.
Phase D 시작 전에 native 공통 mapping 구현과 Dart 계약의 일치 테스트를 추가해야 한다.

## 다음 연결 지점

1. 공식 Cubism SDK/Core를 개발 환경에 별도로 설치한다. Core는 git에 넣지 않는다.
2. 앱용 Android OpenGL / iOS Metal renderer 및 모델 resource loader를 구현한다.
3. `DiagnosticSurface`를 renderer surface로 교체하고 `setParameters`를 renderer에 적용한다.
4. model3.json과 Motion/Expression/HitArea 메타데이터를 검증한다.
5. 실제 모델 표시 및 API 실행 확인 후에만 `renderer: true`를 반환한다.
6. Face Tracking/Wallpaper 역시 실구현이 연결되기 전에는 capability를 false로 유지한다.

## 검증

- Flutter: wire contract, stream cancel, dead zone, frame-rate 독립 보간, lifecycle,
  느린 native 응답, 실패한 토글 UI, 위젯 해제 회귀 테스트.
- Android JVM: quaternion baseline/재보정, heading wrap, q/-q 동치, 비정상 샘플.
- Shell: bootstrap이 lib/pubspec 및 기존 native host 수정을 보존하는지 검사.
- GitHub Actions: Flutter 3.35.7에서 analyze/test, Android debug APK/JVM test,
  iOS simulator debug build. 실제 센서 동작과 발열은 이 빌드 검사만으로 검증되지 않는다.

## 공식 근거

- [Flutter Android Platform Views](https://docs.flutter.dev/platform-integration/android/platform-views)
- [Flutter iOS Platform Views](https://docs.flutter.dev/platform-integration/ios/platform-views)
- [Android SensorManager](https://developer.android.com/reference/android/hardware/SensorManager)
- [Apple Core Motion device motion](https://developer.apple.com/documentation/coremotion/cmmotionmanager/startdevicemotionupdates(using:to:withhandler:))
