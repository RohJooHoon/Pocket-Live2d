# Pocket Live2D

Flutter 기반의 iOS/Android 인터랙티브 Live2D 캐릭터 앱입니다.

- iOS / Android 앱: Live2D 캐릭터, 자이로, 터치, 흔들기, 전면 카메라 얼굴 따라하기
- Android 추가 기능: 동일 캐릭터를 실제 Live Wallpaper로 사용
- Flutter: 제품 UI와 공통 상태/설정
- Native: Live2D 렌더링, 얼굴 추적, 플랫폼 센서/카메라, Android WallpaperService

## 현재 상태

네이티브 bridge와 기울기/터치 입력을 구현한 단계입니다.
Android/iOS의 native 진단 surface에서 입력에 따라 점이 움직입니다.
**실제 Live2D 캐릭터, Motion/Expression, 얼굴 추적, Wallpaper는 아직 구현되지 않았습니다.**

- Android/iOS plugin 자동 등록 및 native capability 확인
- Rotation Vector / Core Motion, 기준 자세 보정
- 터치·드래그 우선 시선, dead zone 및 눈/머리/몸 보간
- background/dispose에서 입력 중지, 느린 native 전송의 최신값 병합
- Flutter·Android JVM·Shell 테스트 및 양쪽 플랫폼 빌드 CI

상세 계획: [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).
입력/채널 계약과 SDK 연결 지점: [`docs/NATIVE_BRIDGE.md`](docs/NATIVE_BRIDGE.md).

## 개발 원칙

- Live2D 렌더링을 Flutter 위젯으로 재구현하지 않고 플랫폼 Native renderer를 사용합니다.
- 플랫폼별 센서/얼굴 추적 결과는 공통 상태 모델로 정규화합니다.
- Android Wallpaper에서는 카메라를 사용하지 않습니다.
- Cubism Core 바이너리는 저장소에 커밋하지 않습니다. 공식 Live2D SDK 배포 패키지를 사용합니다.

## 시작하기

Flutter SDK가 설치된 환경에서 실행합니다. CI 기준 버전은 Flutter 3.35.7입니다.
Android는 JDK 17/Android SDK, iOS는 macOS/Xcode/CocoaPods가 필요합니다.

```bash
bash tool/bootstrap_platforms.sh
flutter run
```

bootstrap은 임시 프로젝트에서 android/ios host만 복사하며 lib/test/pubspec과 기존
native host를 덮어쓰지 않습니다. 네이티브 구현은 packages/pocket_live2d_native에 있습니다.
현재 화면은 입력 테스트이므로 센서 없는 시뮬레이터에서는 터치 테스트만 가능합니다.

## 검증

```bash
flutter analyze --fatal-infos
flutter test
bash tool/test_bootstrap.sh
flutter build apk --debug
./android/gradlew -p android :pocket_live2d_native:testDebugUnitTest
# macOS
flutter build ios --simulator --debug
```

로컬 작업 환경에는 Flutter/Xcode가 없어 Shell 보존 검사와 diff 검사를 실행했습니다.
Flutter 분석·테스트 및 플랫폼 빌드 결과는 PR의 GitHub Actions에서 확인합니다.
실제 iPhone/Galaxy 센서 방향과 리소스 사용 검증은 남아 있습니다.

