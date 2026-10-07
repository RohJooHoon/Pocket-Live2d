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

## 기기에서 실행하기 (빠른 요약)

> 처음이라면 **[실기기 실행·테스트 가이드](docs/DEVICE_TESTING.md)**를 보세요.
> 준비물 설치, Galaxy/iPhone 설정, 기능별 테스트 방법과 정상 동작 기준, 문제 해결까지 순서대로 정리되어 있습니다.

필요한 것: Flutter stable 3.27 이상, Python 3.9 이상

- Android: Android Studio, SDK Tools의 NDK와 CMake 3.22.1
- iOS: macOS, Xcode, CocoaPods

1. [Cubism SDK for Native 5-r.5](https://www.live2d.com/download/cubism-sdk/download-native/)를 받아 압축을 풉니다.
2. SDK를 준비하고 플랫폼 폴더를 만듭니다. iPhone도 테스트하려면 Mac에서 실행하세요.

   ```bash
   python3 tool/prepare_cubism.py ~/Downloads/CubismSdkForNative-5-r.5
   bash tool/bootstrap_platforms.sh            # Windows/Linux는: bash tool/bootstrap_platforms.sh android
   ```

3. 휴대폰을 USB로 연결하고 실행합니다.

   ```bash
   flutter devices                # 기기 ID 확인
   flutter run -d <기기ID>         # 성능·배터리 테스트는 --release 추가
   ```

4. 화면 아래 상태가 **"Mark-kun 준비 완료"**면 성공입니다.
   **"Live2D SDK 연결이 필요합니다."**가 보이면 2단계를 다시 확인하세요.

| 기기 | 처음 한 번 할 일 | 자세히 |
|---|---|---|
| Galaxy | 개발자 옵션 → USB 디버깅 켜기 | [가이드 3장](docs/DEVICE_TESTING.md#3-galaxyandroid에서-실행) |
| iPhone | Xcode에서 `ios/Runner.xcworkspace` 서명(Team) 설정, iPhone 개발자 모드 켜기 | [가이드 4장](docs/DEVICE_TESTING.md#4-iphone에서-실행) |

기능별로 무엇을 해 보고 무엇이 보이면 정상인지는 [가이드 6장](docs/DEVICE_TESTING.md#6-기능별-테스트)에 있습니다.
테스트 결과는 [결과 기록표](docs/DEVICE_TESTING.md#10-결과-기록표)에 남기면 됩니다.

## 개발용 검사

```bash
bash tool/bootstrap_platforms.sh
python3 tool/validate_model_assets.py
flutter analyze
flutter test
```

## 테스트 데이터

`assets/live2d/mark/`에 moc3, texture, physics, 6개 모션과 테스트 표정 2개가 있습니다.
모델 출처와 사용 조건은 [모델 README](assets/live2d/mark/README.md)에 기록되어 있습니다.
다른 모델과 민감도를 선택하는 설정 UI는 후속 작업입니다.
