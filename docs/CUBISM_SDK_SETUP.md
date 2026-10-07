# Cubism Native 5-r.5 설정과 검증

Core는 공식 배포 패키지에서 별도로 설치한다. 저장소에는 Core나 SDK 복사본을 커밋하지 않는다.
공식 다운로드: https://www.live2d.com/en/sdk/download/native/

## SDK 준비

Native **5-r.5** 패키지를 압축 해제한다. 이 어댑터는 해당 Framework의
`LoadFileFunction`/외부 OpenGL shader API와 render target size API를 사용한다.

```bash
python3 tool/prepare_cubism.py /path/to/CubismSdkForNative-5-r.5
bash tool/bootstrap_platforms.sh
```

스크립트는 Core/Framework를 `packages/pocket_live2d_native/cubism/`에 복사하고,
stb PNG decoder와 StandardES shader 소스 헤더를 생성한다.
로컬 Framework 복사본의 OpenGL shader singleton을 thread_local로 바꿔
wallpaper Engine별 GL thread/context의 shader program을 분리한다.
공통 Runtime은 Framework 호출을 mutex로 직렬화한다.
macOS에서는 device/simulator Core 라이브러리로 XCFramework를 만들어
`packages/pocket_live2d_native/ios/Cubism/`에 배치한다.
bootstrap은 공통 C++ 소스를 iOS pod 내부 `Classes/Runtime/`에 복사한다.
모두 gitignore 대상이다. 공통 C++ 코드를 수정하면 bootstrap을 다시 실행한다.

SDK 준비 후 기존 iOS Pods를 쓰고 있었다면:

```bash
cd ios
pod install
cd ..
```

Android는 arm64-v8a/x86_64 Core static library를 요구한다.
iOS는 Release-iphoneos와 Release-iphonesimulator-arm64를 요구하고,
x86_64 simulator 라이브러리가 있으면 universal simulator library를 생성한다.

## 모델 규약

현재 기본 모델은 `mark`이며 manifest는 `assets/live2d/mark/Mark.model3.json`이다.
일반 규약은 `assets/live2d/<id>/<첫 글자를 대문자로 바꾼 id>.model3.json`이다.
manifest에서 참조하는 texture/motion/physics/expression은 동일 모델 폴더 상대 경로로 읽는다.
번들 추가 시 pubspec asset 디렉터리 선언도 추가해야 한다.

Mark 원본에는 HitAreas가 없어 투명도가 0이 아닌 drawable의 경계로 탭을 판정한다.
이는 pixel alpha 기반 hit test가 아니다. 모델이 제공하는 HitAreas가 있으면 그 정의를 사용한다.

## 빌드

```bash
python3 tool/validate_model_assets.py
flutter analyze
flutter test
flutter build apk --debug
# macOS:
flutter build ios --simulator --no-codesign
flutter run
```

SDK가 없으면 어댑터는 컴파일되지만 initialize가 `sdk_unavailable`을 반환한다.
실제 모델 로드/렌더링은 수행하지 않는다.
SDK 일부만 설치되었거나 지원 ABI가 없으면 빌드를 실패시켜 잘못된 설정을 드러낸다.

## 검증 체크리스트

- [ ] SDK 활성 경로 Android/iOS 전체 컴파일과 링크
- [ ] Mark 표시, texture/mask/physics, TapBody/Shake와 happy/surprised
- [ ] drag 종료 후 gyro/idle 복원, mimic 동안 touch override 억제
- [ ] 카메라 권한 거부·허용·시작 중 취소, 얼굴 미검출
- [ ] background 카메라/센서 중지, foreground 입력 모드 복귀
- [ ] 화면 크기/방향 변경, GL context 재생성, 모델 다시 로드
- [ ] Galaxy 시스템 wallpaper 미리보기/설정/홈 전환, 비가시 센서 중지
- [ ] wallpaper 미리보기와 설치된 Engine 동시 실행
- [ ] 장시간 배터리/발열/메모리

현재 SDK 활성 경로와 실기기 검증 결과는 없다.
공개 CI는 SDK 없는 어댑터 빌드, Flutter 테스트, Native 입력 테스트,
모델 파일 참조/헤더/존재 여부만 검증한다.
Core를 공개 CI artifact나 Git에 올리지 않으며,
SDK 포함 CI는 라이선스와 접근 범위를 확인한 private/self-hosted 환경에서 후속 구성한다.
