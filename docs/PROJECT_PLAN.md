# Pocket Live2D 개발 계획과 진행 상태

목표: iPhone/Android 앱에서 자이로·터치·흔들기·얼굴 따라하기에 반응하는 Live2D 캐릭터를 제공하고,
Android 홈 화면에서는 같은 모델을 Live Wallpaper로 사용한다.

갱신: 2026-10-07. 체크된 항목은 **소스 구현 또는 데이터 준비**를 뜻한다.
SDK 포함 빌드·실기기 검증은 별도 체크하며, 코드가 있다는 이유로 MVP 완료로 판단하지 않는다.

## 1. 기반 안정화

- [x] Flutter 앱, 로컬 Native plugin, MethodChannel/EventChannel/PlatformView
- [x] 터치 LookAt PR #5 main 반영
- [x] 모드 전환 직렬화, 실패 시 이전 모드 복구
- [x] 카메라 권한/시작 대기 취소 및 시작 실패 응답
- [x] Android 이미지 row/pixel stride 처리와 이전 세션 콜백 차단
- [x] 백그라운드 카메라·센서·렌더링 중지 및 foreground 모드 복귀 코드
- [x] 플랫폼 생성 시 Android/iOS 카메라 권한 설명 자동 구성
- [x] Flutter 테스트, Native 입력 필터 테스트, 모델 무결성 검사 CI
- [ ] 실제 기기에서 권한 거부·허용·취소·회전·복귀 반복 검증

## 2. 테스트 모델과 Cubism 렌더링

- [x] 공식 Mark 샘플 moc3/texture/physics/motion 데이터 포함 및 출처 기록
- [x] Mark에 TapBody/Shake 모션 그룹과 happy/surprised 테스트 표정 추가
- [x] 공통 C++ 모델 로더, 파라미터 매퍼, 모션/표정/physics 처리
- [x] Android GLSurfaceView/JNI와 iOS GLKView/Objective-C++ 연결
- [x] 공식 Native 5-r.5 SDK 로컬 준비 스크립트
- [x] SDK 부재를 명시하는 오류/상태 UI
- [ ] 공식 Core 설치 후 SDK 활성 경로 Android/iOS 컴파일 검증
- [ ] iPhone/Galaxy에서 동일 Mark 표시, texture/mask/physics 확인
- [ ] GL context 재생성·모델 재로드·자원 해제 검증

Core는 저장소에 없으므로 지금 공개 CI의 빌드 성공만으로 실제 렌더링이 검증되지 않는다.
설치 절차: [CUBISM_SDK_SETUP.md](CUBISM_SDK_SETUP.md).

## 3. 상호작용과 따라하기

- [x] iOS Core Motion / Android Rotation Vector 정규화·dead zone·필터
- [x] 눈/머리/몸 gain 및 dt 기반 보간
- [x] 드래그 LookAt, 터치 해제 시 기본 입력 복원
- [x] 탭 좌표 전달과 HitArea 판정; Mark는 drawable 경계 fallback 사용
- [x] 흔들기 감지, cooldown, Shake 모션 호출
- [x] 따라하기 모드 선택과 전면 카메라 활성/종료
- [x] iOS ARKit, Android MediaPipe 얼굴 상태 추출
- [x] 공통 FaceTrackingState → Live2D 파라미터
- [x] 얼굴 미검출/confidence 필터와 기본 상태 복귀 코드
- [ ] 실기기 얼굴 방향·눈 깜빡임·입 벌림·저조도·가림 테스트
- [ ] 모션과 face/physics 동시 적용 순서의 시각 품질 검증
- [ ] 센서 calibration 및 사용자가 조절하는 민감도 설정 UI

## 4. Android Live Wallpaper

- [x] 시스템 WallpaperService/manifest/설정 진입
- [x] 공통 모델 로더와 파라미터 런타임 재사용
- [x] 자이로·터치·Idle Motion
- [x] visibility/surface lifecycle, invisible 센서/프레임 중지
- [x] visible 약 30 FPS 프레임 요청
- [x] 앱과 분리된 wallpaper 프로세스, Engine별 shader 분리 코드, 카메라 코드 없음
- [ ] Galaxy 실제 홈/잠금 화면·미리보기·중복 Engine 검증
- [ ] 모델/민감도 설정의 기존 wallpaper Engine 간 동기화 개선
- [ ] 배터리·장시간 발열·메모리 측정

현재 번들 모델은 Mark 하나이며, 동적으로 모델을 내려받거나 선택하는 UI는 제공하지 않는다.

## 5. 완료 기준과 다음 실행 순서

1. 공식 SDK/Core를 준비하고 Android/iOS 전체 빌드 오류를 해결한다.
2. Mark 렌더링과 motion/expression/physics를 실기기에서 확인한다.
3. 입력 모드, 권한 취소, foreground 복귀, 얼굴 미검출을 반복 검증한다.
4. Galaxy에서 wallpaper 설정·화면 전환·Engine 재생성을 검증한다.
5. 모델/민감도 설정과 calibration을 구현한 뒤 성능/배터리 결과를 기록한다.
6. 샘플 모델을 제품 배포에 쓸 경우 해당 모델과 Cubism 배포 조건을 확인한다.

MVP 완료는 iPhone/Galaxy 실제 표시와 상호작용, 카메라 즉시 종료, wallpaper 비가시 중지,
장시간 안정성 결과가 모두 확인된 시점이다.

## 구조

- `lib/live2d/`: Controller, bridge, 입력 모드, Flutter 상태 모델
- `packages/pocket_live2d_native/common/`: 공통 Cubism 런타임과 입력 보간
- `packages/pocket_live2d_native/android/`: Kotlin/JNI, CameraX/MediaPipe, wallpaper
- `packages/pocket_live2d_native/ios/`: Swift/Objective-C++, ARKit/Core Motion
- `assets/live2d/mark/`: 공식 테스트 모델과 테스트 표정
- `tool/`: 호스트 구성, SDK 준비, 모델 검사

[Native bridge 계약](NATIVE_BRIDGE.md) · [얼굴 추적](FACE_TRACKING.md) · [실기기 실행·테스트](DEVICE_TESTING.md)
