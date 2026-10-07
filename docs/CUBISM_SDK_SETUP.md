# Cubism SDK local setup

Pocket Live2D는 Live2D Cubism SDK/Core 바이너리를 저장소에 포함하지 않습니다.

## 원칙

- Cubism SDK는 Live2D 공식 배포 패키지에서 직접 받습니다.
- `Core` 바이너리와 공식 SDK 전체 복사본은 Git에 커밋하지 않습니다.
- 앱 코드와 SDK 경계를 `PocketLive2dRenderer` 계층으로 분리합니다.
- Android/iOS가 동일한 `modelId`, motion, expression, parameter 명세를 사용하도록 유지합니다.

## 로컬 배치 위치

기본 로컬 위치는 아래로 통일합니다.

```text
third_party/live2d/
└── cubism-sdk/
    ├── Core/
    ├── Framework/
    └── Samples/          # 필요할 때만
```

`.gitignore`에서 `third_party/live2d/` 전체가 제외되어 있으므로 SDK 바이너리가 실수로 올라가지 않습니다.

## 목표 Native 구조

```text
Flutter
  ↓ MethodChannel / PlatformView
PocketLive2dNativePlugin
  ↓
PocketLive2dRenderer
  ├─ loadModel(modelId)
  ├─ playMotion(group, index)
  ├─ setExpression(id)
  ├─ lookAt(x, y)
  ├─ applyOrientation(x, y, z)
  ├─ applyParameters(parameterMap)
  └─ dispose()
  ↓
Cubism SDK / Core
```

센서와 카메라 추적 코드는 Cubism SDK를 직접 알지 않습니다. 정규화된 상태만 renderer에 전달합니다.

## 모델 파일 규약

초기 MVP에서는 앱에 포함된 모델 한 개부터 시작합니다.

```text
assets/live2d/<model-id>/
├── <model>.model3.json
├── <model>.moc3
├── textures/
├── motions/
├── expressions/
└── physics3.json
```

`modelId = haru`라면 플랫폼 renderer는 `assets/live2d/haru/`를 찾도록 구현합니다.

## 다음 구현 순서

1. 공식 Cubism SDK를 로컬 `third_party/live2d/cubism-sdk/`에 배치
2. Android에서 Core/Framework 링크
3. Android PlatformView에 실제 Cubism renderer 연결
4. 테스트 모델 표시
5. iOS에서 동일 모델 표시
6. `OrientationController` 값을 `ParamAngleX/Y/Z`, `ParamEyeBallX/Y`, `ParamBodyAngleX`에 적용
7. Motion / Expression / LookAt 연결

## CI 정책

공식 SDK/Core가 저장소에 없기 때문에 기본 공개 CI는 Flutter/Native bridge 컴파일까지만 검증합니다.

Cubism 바이너리까지 포함한 빌드 검증은 추후 다음 중 하나로 분리합니다.

- GitHub Actions encrypted artifact/secret 기반 SDK 주입
- private release asset 기반 다운로드
- self-hosted runner의 로컬 SDK 캐시

라이선스 조건을 확인하기 전에는 Cubism SDK 파일을 GitHub Actions artifact나 공개 저장소로 업로드하지 않습니다.

## 입력 프로토타입의 현재 연결

현재 `PocketLive2dPlatformView`는 입력 진단용이다. 채널의 `renderer` capability는 false이며
모델/Motion/Expression 요청에 renderer_unavailable을 반환한다.
`Live2DSession`은 30Hz로 공통 Dart mapper/보간 결과를 전달한다. 실제 renderer 연결 시
센서→mapper→renderer 경로를 native로 이동해 Wallpaper와 재사용한다.
