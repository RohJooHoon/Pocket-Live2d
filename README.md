# Pocket Live2D

Flutter 기반 iOS/Android Live2D 캐릭터 앱과 Android Live Wallpaper입니다.

- Flutter: 입력 모드, 모델 상태, 모션/표정 버튼, 배경화면 설정 진입
- Native: OpenGL ES Cubism 렌더러, 자이로/터치/흔들기, 얼굴 추적
- Android 얼굴 추적: CameraX + MediaPipe Face Landmarker
- iOS 얼굴 추적: ARKit
- Wallpaper: 공통 C++ 모델/파라미터 런타임 재사용, 카메라 없음

## 현재 상태

공식 테스트 모델 **Mark**와 렌더러 연결 코드를 포함합니다. Cubism Core는 별도로 설치해야 합니다.
SDK가 없는 빌드는 `sdk_unavailable` 상태를 표시하며 캐릭터를 렌더링하지 않습니다.
공개 CI는 SDK 없는 Flutter/Android/iOS 빌드 경로와 입력·모델 무결성 테스트를 검증합니다.
SDK를 넣은 전체 빌드와 실제 iPhone/Galaxy 동작 검증은 아직 필요합니다.

진행 순서와 남은 검증은 [개발 계획](docs/PROJECT_PLAN.md), 설치 방법은
[Cubism SDK 설정](docs/CUBISM_SDK_SETUP.md)을 참고하세요.

## 시작하기

Flutter stable, Android SDK/NDK 또는 macOS Xcode/CocoaPods가 필요합니다.

```bash
bash tool/bootstrap_platforms.sh
python3 tool/validate_model_assets.py
flutter analyze
flutter test
```

캐릭터 렌더링을 활성화하려면 공식 Cubism SDK for Native 5-r.5를 다운로드·압축 해제한 후:

```bash
python3 tool/prepare_cubism.py /path/to/CubismSdkForNative-5-r.5
bash tool/bootstrap_platforms.sh
flutter run
```

iOS는 macOS에서 SDK를 준비해야 합니다. 상세 빌드 명령과 기기 검증 절차는 설치 문서를 참고하세요.

## 테스트 데이터

`assets/live2d/mark/`에 moc3, texture, physics, 6개 모션과 테스트 표정 2개가 있습니다.
모델 출처와 사용 조건은 [모델 README](assets/live2d/mark/README.md)에 기록되어 있습니다.
다른 모델과 민감도를 선택하는 설정 UI는 후속 작업입니다.
