# Pocket Live2D

Flutter 기반의 iOS/Android 인터랙티브 Live2D 캐릭터 앱입니다.

- iOS / Android 앱: Live2D 캐릭터, 자이로, 터치, 흔들기, 전면 카메라 얼굴 따라하기
- Android 추가 기능: 동일 캐릭터를 실제 Live Wallpaper로 사용
- Flutter: 제품 UI와 공통 상태/설정
- Native: Live2D 렌더링, 얼굴 추적, 플랫폼 센서/카메라, Android WallpaperService

## 현재 상태

프로젝트 부트스트랩 단계입니다.

1. Flutter 공통 앱 골격
2. Flutter ↔ Native Live2D bridge 계약
3. iOS/Android Native Live2D surface 연결
4. Gyro / Touch / Shake
5. Face Tracking (`따라하기`)
6. Android Live Wallpaper

상세 계획은 [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md)를 참고합니다.

## 개발 원칙

- Live2D 렌더링을 Flutter 위젯으로 재구현하지 않고 플랫폼 Native renderer를 사용합니다.
- 플랫폼별 센서/얼굴 추적 결과는 공통 상태 모델로 정규화합니다.
- Android Wallpaper에서는 카메라를 사용하지 않습니다.
- Cubism Core 바이너리는 저장소에 커밋하지 않습니다. 공식 Live2D SDK 배포 패키지를 사용합니다.

## 시작하기

Flutter SDK가 설치된 개발 환경에서 플랫폼 폴더를 생성합니다.

```bash
./tool/bootstrap_platforms.sh
flutter pub get
flutter test
```

> Native Live2D SDK 연결 전까지는 Flutter shell과 bridge 계약만 동작합니다.
