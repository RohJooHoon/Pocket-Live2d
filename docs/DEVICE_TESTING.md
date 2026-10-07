# 실기기 실행·테스트 가이드

Galaxy(Android)와 iPhone에 앱을 설치하고, 기능별로 **무엇을 해 보고 무엇이 보이면 정상인지** 확인하는 방법을 정리한 문서입니다.
처음 해 보는 사람도 위에서부터 순서대로 따라 하면 됩니다.

- [0. 전체 흐름](#0-전체-흐름)
- [1. 준비물](#1-준비물)
- [2. 처음 한 번 하는 준비](#2-처음-한-번-하는-준비)
- [3. Galaxy(Android)에서 실행](#3-galaxyandroid에서-실행)
- [4. iPhone에서 실행](#4-iphone에서-실행)
- [5. 앱 화면 이해하기](#5-앱-화면-이해하기)
- [6. 기능별 테스트](#6-기능별-테스트)
- [7. SDK 없이 먼저 해 볼 수 있는 것](#7-sdk-없이-먼저-해-볼-수-있는-것)
- [8. 문제 해결](#8-문제-해결)
- [9. 문제를 공유할 때](#9-문제를-공유할-때)
- [10. 결과 기록표](#10-결과-기록표)

---

## 0. 전체 흐름

```text
준비물 설치 → Cubism SDK 준비 → 플랫폼 폴더 생성 → 기기 연결 → flutter run → 기능별 테스트
   (1장)          (2-2)            (2-3)          (3장/4장)              (6장)
```

| 기능 | Galaxy | iPhone | 에뮬레이터 / 시뮬레이터 |
|---|:---:|:---:|:---:|
| 캐릭터 표시, 모션, 표정, 터치 | O | O | 화면 확인 정도만 |
| 자이로, 흔들기 | O | O | X (센서 없음) |
| 따라하기(얼굴 추적) | O | O (지원 기종만) | X |
| 홈 화면 배경화면 | O | X (iOS 미지원) | - |

센서와 카메라를 쓰는 기능은 **실기기에서만** 제대로 테스트할 수 있습니다.

---

## 1. 준비물

### 공통

- **Flutter stable 3.27 이상** (최신 stable 권장)
  - 설치 확인: `flutter --version`, `flutter doctor`
- **Python 3.9 이상**: `python3 --version`
- **Git**
- **Cubism SDK for Native 5-r.5**
  - 다운로드: https://www.live2d.com/download/cubism-sdk/download-native/
  - 라이선스 동의 후 받습니다. 파일명이 `CubismSdkForNative-5-r.5`인지 꼭 확인하세요. 다른 버전은 준비 스크립트가 거부합니다.

### Android (Windows / macOS / Linux 모두 가능)

- **Android Studio**
- Android Studio → `Settings` → `Languages & Frameworks` → `Android SDK` → **SDK Tools** 탭에서 아래 항목을 체크하고 설치합니다.
  - Android SDK Command-line Tools
  - **NDK (Side by side)**
  - **CMake 3.22.1**
- 라이선스 동의: `flutter doctor --android-licenses` (전부 `y`)
- 테스트 기기: Galaxy, **Android 7.0 이상, 64비트(arm64)**
- 데이터 전송이 되는 USB 케이블 (충전 전용 케이블은 안 됩니다)
- 첫 빌드 때 인터넷이 필요합니다. 얼굴 추적 모델(`face_landmarker.task`)을 자동으로 내려받습니다.
- Windows에서는 `.sh` 스크립트를 **Git Bash** 또는 **WSL**에서 실행합니다.

### iOS (macOS 필수)

- **Xcode** (App Store). 처음 실행할 때 추가 컴포넌트 설치를 완료합니다.
- **CocoaPods**: `brew install cocoapods` 또는 `sudo gem install cocoapods`
- **Apple ID**: 무료 계정도 가능합니다. 무료 계정으로 설치한 앱은 7일 후 다시 설치해야 합니다.
- 테스트 기기: iPhone과 케이블
  - 따라하기(얼굴 추적)는 Face ID 지원 기종(iPhone X 이후)이나 A12 칩 이상 + iOS 14 이상 기종에서만 됩니다.

---

## 2. 처음 한 번 하는 준비

### 2-1. 코드 받기

```bash
git clone https://github.com/RohJooHoon/Pocket-Live2d.git
cd Pocket-Live2d
```

이미 받아 둔 경우에는 최신으로 맞춥니다.

```bash
git checkout main
git pull
```

### 2-2. Cubism SDK 준비

1. 받은 zip 파일의 압축을 풉니다. 풀린 폴더 안에 `Core`, `Framework`, `Samples` 폴더가 바로 보여야 합니다.
2. 그 폴더 경로를 넣어 실행합니다.

```bash
python3 tool/prepare_cubism.py ~/Downloads/CubismSdkForNative-5-r.5
```

아래 메시지가 나오면 성공입니다.

```text
SDK staged. Re-run bootstrap and pod install. Core remains excluded from Git.
```

- **iPhone도 테스트하려면 이 명령을 Mac에서 실행하세요.** iOS용 라이브러리(XCFramework)는 Mac에서만 만들어집니다.
- 복사된 SDK 파일은 `.gitignore` 대상이라 커밋되지 않습니다. 저장소에 올리면 안 됩니다.

| 실패 메시지 | 원인 | 해결 |
|---|---|---|
| `Missing SDK file: ...` | 경로가 틀렸거나 압축이 덜 풀림 | `Core`, `Framework`, `Samples`가 보이는 폴더 경로를 넣기 |
| `This adapter requires the Cubism Native 5-r.5 Framework API.` | SDK 버전이 다름 | 5-r.5 패키지 받기 |
| `Unsupported Framework shader singleton; use Native 5-r.5.` | SDK 버전이 다름 | 5-r.5 패키지 받기 |
| `Missing iOS Core library: ...` | 패키지에 iOS 라이브러리가 없음 | 패키지를 다시 받아 압축 풀기 |

### 2-3. 플랫폼 폴더 생성

```bash
# Mac: Android + iOS 둘 다
bash tool/bootstrap_platforms.sh

# Windows / Linux: Android만
bash tool/bootstrap_platforms.sh android
```

이 스크립트가 하는 일은 다음과 같습니다.

1. `flutter create`로 `android/`, `ios/` 앱 프로젝트를 생성합니다.
2. 카메라 권한 안내 문구를 넣습니다.
3. 공통 C++ 렌더러를 iOS 플러그인 안으로 복사합니다.
4. `flutter pub get`을 실행합니다.

주의할 점:

- **순서가 중요합니다.** SDK 준비(2-2)를 먼저 하고 bootstrap(2-3)을 실행해야 합니다.
  - SDK를 나중에 넣었다면 bootstrap을 다시 실행하고, iOS는 `cd ios && pod install && cd ..`까지 해 주세요.
- 공통 C++ 코드(`packages/pocket_live2d_native/common/`)를 수정했을 때도 bootstrap을 다시 실행합니다.
- 생성된 `android/`, `ios/` 폴더는 CI가 매번 새로 만들기 때문에 커밋하지 않습니다.

### 2-4. 기본 검사 (선택)

```bash
python3 tool/validate_model_assets.py   # 모델 파일 검사
flutter analyze                         # 코드 정적 분석
flutter test                            # 단위 테스트
```

---

## 3. Galaxy(Android)에서 실행

### 3-1. 휴대폰 설정 (처음 한 번)

1. `설정` → `휴대전화 정보` → `소프트웨어 정보` → **빌드번호**를 7번 연속으로 탭합니다. "개발자 모드를 켰습니다"가 뜨면 됩니다.
2. `설정` → `개발자 옵션` → **USB 디버깅**을 켭니다.
3. USB로 컴퓨터에 연결하면 휴대폰에 "USB 디버깅을 허용하시겠습니까?"가 뜹니다. "이 컴퓨터에서 항상 허용"을 체크하고 **허용**을 누릅니다.

### 3-2. 실행

```bash
flutter devices              # 목록에 SM-xxxx 같은 Galaxy가 보이는지 확인
flutter run -d <기기ID>      # 연결된 기기가 하나면 -d 생략 가능
```

- 첫 빌드는 Gradle, NDK, 얼굴 추적 모델을 내려받느라 몇 분 이상 걸릴 수 있습니다.
- 실행 중 터미널 단축키는 다음과 같습니다.
  - `r`: 핫 리로드 (Dart 코드만 반영)
  - `R`: 앱 재시작
  - `q`: 종료
- Kotlin/C++ 코드를 고쳤다면 `q`로 종료하고 `flutter run`을 다시 실행해야 반영됩니다.
- **성능·배터리·배경화면 장시간 테스트는 release 빌드로** 하세요. debug 빌드는 느립니다.

```bash
flutter run --release
```

APK 파일로 설치하려면 다음과 같이 합니다.

```bash
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

### 3-3. 로그 보기

```bash
flutter logs
```

더 자세한 Native 로그가 필요하면:

```bash
# macOS / Linux / Git Bash
adb logcat | grep -i -E "pocket|cubism|mediapipe|AndroidRuntime"

# Windows PowerShell
adb logcat | Select-String -Pattern "pocket|cubism|mediapipe|AndroidRuntime"
```

---

## 4. iPhone에서 실행

Mac에서만 가능합니다.

### 4-1. 서명 설정 (처음 한 번)

1. Xcode 프로젝트를 엽니다. `.xcodeproj`가 아니라 **`.xcworkspace`**를 열어야 합니다.
   ```bash
   open ios/Runner.xcworkspace
   ```
2. 왼쪽에서 `Runner` 프로젝트 → `TARGETS`의 `Runner` → **Signing & Capabilities** 탭으로 갑니다.
3. **Automatically manage signing**을 체크하고, **Team**에서 내 Apple ID를 선택합니다.
   - Apple ID가 목록에 없으면 `Xcode` → `Settings` → `Accounts`에서 추가합니다.
4. "Failed to register bundle identifier" 오류가 나면 **Bundle Identifier**를 겹치지 않는 값으로 바꿉니다.
   - 예: `com.<내이름>.pocketLive2d`

### 4-2. iPhone 설정 (처음 한 번)

1. 케이블로 연결하면 iPhone에 "이 컴퓨터를 신뢰하시겠습니까?"가 뜹니다. **신뢰**를 누릅니다.
2. iOS 16 이상이면 `설정` → `개인정보 보호 및 보안` → **개발자 모드**를 켜고 재시동합니다.
   - 이 메뉴는 Xcode에 한 번 연결한 뒤에 나타납니다.
3. 무료 Apple ID로 처음 설치한 뒤 앱이 열리지 않으면, `설정` → `일반` → `VPN 및 기기 관리` → 개발자 앱 → **신뢰**를 누릅니다.

### 4-3. 실행

```bash
cd ios && pod install && cd ..   # SDK를 넣은 뒤 처음, 또는 SDK를 바꾼 뒤
flutter devices                  # iPhone이 보이는지 확인
flutter run -d <iPhone ID>
```

- **debug 빌드는 케이블(또는 Xcode) 연결이 끊긴 뒤 홈 화면에서 다시 실행할 수 없습니다.** iOS 정책입니다.
  - 케이블 없이 들고 다니며 테스트하려면 `flutter run --release`로 설치하세요.
- 시뮬레이터에서도 실행할 수 있지만(`open -a Simulator` 후 `flutter run`), 캐릭터 표시만 확인할 수 있습니다.
  - 시뮬레이터에서 자이로·따라하기를 누르면 실패 메시지가 뜨는 것이 정상입니다. 센서와 카메라가 없기 때문입니다.

### 4-4. 로그 보기

- 터미널: `flutter logs`
- Xcode: `Window` → `Devices and Simulators` → 기기 선택 → **Open Console**
- 앱이 바로 꺼지는 경우에는 Xcode에서 `Runner`를 직접 실행(▶)하면 원인이 가장 자세히 나옵니다.

---

## 5. 앱 화면 이해하기

```text
┌────────────────────────────────────┐
│ Pocket Live2D                   ⓘ │  ⓘ: 샘플 모델 라이선스 문구
├────────────────────────────────────┤
│                                    │
│          (캐릭터 표시 영역)          │  터치 / 드래그 / 탭
│                                    │
├────────────────────────────────────┤
│            상태 메시지               │
│   [ 기본 | 자이로 | 따라하기 ]        │  입력 모드 (한 번에 하나)
│   [반응] [표정] [배경화면]  ⟳        │  배경화면은 Android만
└────────────────────────────────────┘
```

| 버튼 | 하는 일 |
|---|---|
| 기본 | 센서·카메라 없이 터치에만 반응 |
| 자이로 | 휴대폰 기울기에 반응 |
| 따라하기 | 전면 카메라로 내 얼굴을 따라 함 |
| 반응 | TapBody 모션 재생 |
| 표정 | happy 표정 적용 (눈이 살짝 가늘어지고 눈썹이 올라감) |
| 배경화면 | Android 라이브 배경화면 설정 화면 열기 |
| ⟳ | 캐릭터 다시 불러오기 |

반응·표정·배경화면 버튼과 화면 터치는 상태가 **"Mark-kun 준비 완료"**가 된 뒤에만 동작합니다.

### 상태 메시지 읽는 법

| 메시지 | 의미 | 할 일 |
|---|---|---|
| 캐릭터를 준비하고 있어요. | 앱 시작 직후 | 잠시 기다리기 |
| 캐릭터를 불러오고 있어요. | 모델 로딩 중 | 잠시 기다리기 |
| **Mark-kun 준비 완료** | 정상 | 테스트 시작 |
| Live2D SDK 연결이 필요합니다. | SDK 없이 빌드됨 | 2-2, 2-3을 다시 하고 앱 다시 빌드 ([8장](#8-문제-해결) 참고) |
| 캐릭터 오류: … | 모델 로드나 렌더링 실패 | 메시지와 로그 공유 |
| 작업 실패: … | 버튼 동작 실패 (권한 거부 등) | 메시지 내용 확인 |
| 입력이 중단됐어요: … | 실행 중 센서·카메라 오류 → 자동으로 '기본' 모드로 돌아감 | 메시지와 로그 공유 |
| iOS 또는 Android 앱에서 실행해 주세요. | PC·웹에서 실행됨 | 휴대폰에서 실행 |

---

## 6. 기능별 테스트

각 항목은 **어떻게 해 보는지 → 정상이면 어떻게 보이는지** 순서입니다. 항목 번호(A-1 등)는 [결과 기록표](#10-결과-기록표)와 문제 공유에 사용합니다.

### A. 캐릭터 표시

| # | 어떻게 | 정상이면 |
|---|---|---|
| A-1 | 앱 실행 | 몇 초 안에 Mark가 보이고, 상태가 "Mark-kun 준비 완료" |
| A-2 | 아무것도 안 하고 1분 두기 | Idle 모션이 자동으로 이어서 재생됨 (가만히 멈춰 있지 않음) |
| A-3 | 캐릭터를 자세히 보기 | 검은 사각형, 깨진 텍스처, 빠진 부분이 없음. 움직일 때 머리카락·옷이 자연스럽게 흔들림(physics) |
| A-4 | 휴대폰을 가로·세로로 돌리기 | 잠깐 다시 그려지더라도 깨지지 않고 정상 표시 |
| A-5 | ⟳ 버튼 | 다시 불러온 뒤 정상 표시 |

### B. 버튼

| # | 어떻게 | 정상이면 |
|---|---|---|
| B-1 | [반응] | 반응 모션 1회 재생 후 Idle로 돌아감 |
| B-2 | [표정] | 눈이 살짝 가늘어지고 눈썹이 올라감 (변화가 작으니 자세히 볼 것) |

### C. 터치 (기본·자이로 모드)

| # | 어떻게 | 정상이면 |
|---|---|---|
| C-1 | 화면을 누른 채 천천히 드래그 | 눈과 머리가 손가락 방향을 따라봄 |
| C-2 | 손가락 떼기 | 정면(자이로 모드면 기울기 방향)으로 부드럽게 돌아옴 |
| C-3 | 캐릭터 몸 위를 짧게 탭 (0.5초 안에, 거의 움직이지 않고) | 반응 모션 재생 |
| C-4 | 캐릭터와 먼 빈 공간 탭 | 반응 없음이 정상 (Mark는 파츠 경계 사각형으로 판정해서 몸 바로 근처는 반응할 수 있음) |
| C-5 | 따라하기 모드에서 드래그 | 터치는 무시되는 것이 정상 |

### D. 자이로

| # | 어떻게 | 정상이면 |
|---|---|---|
| D-1 | 휴대폰을 편하게 든 상태에서 [자이로] | 누른 순간의 자세가 "정면 기준"이 됨 |
| D-2 | 좌우로 기울이기 | 머리·몸이 기울기 방향으로 움직임 |
| D-3 | 위아래로 기울이기 | 고개를 들거나 숙임 |
| D-4 | 아주 조금 흔들리게 들고 있기 | 작은 떨림에는 반응하지 않고 조용함 |
| D-5 | 자이로 모드에서 드래그 후 손 떼기 | 드래그 중에는 터치가 우선, 손을 떼면 다시 기울기를 따라감 |
| D-6 | [기본]으로 바꾼 뒤 기울이기 | 반응 없음 |

### E. 흔들기

| # | 어떻게 | 정상이면 |
|---|---|---|
| E-1 | 휴대폰을 짧고 세게 흔들기 | Shake 모션 재생 (모드와 관계없이 동작) |
| E-2 | 계속 흔들기 | 약 1초에 한 번 이하로만 재생 |
| E-3 | 걷거나 책상에 내려놓기 | 실수로 재생되지 않음 |

### F. 따라하기 (얼굴 추적)

| # | 어떻게 | 정상이면 |
|---|---|---|
| F-1 | [따라하기]를 처음 누르기 | 카메라 권한 팝업이 뜸 |
| F-2 | 권한 허용 | 상태바에 **초록 점**(카메라 사용 표시)이 켜짐 |
| F-3 | 화면을 정면으로 보고 고개를 좌우·상하로 움직이고 갸웃하기 | 캐릭터 머리가 같은 방향으로 따라함 |
| F-4 | 눈 감기 / 한쪽 눈 감기 | 캐릭터도 눈을 감음 |
| F-5 | 입 크게 벌리기 / 웃기 | 입이 벌어지고, 웃으면 입 모양이 바뀜 |
| F-6 | 손으로 얼굴 가리기 또는 화면 밖으로 나가기 | 잠시 뒤 정면 기본 자세로 부드럽게 돌아옴 (튀거나 멈추지 않음) |
| F-7 | [기본] 누르기 | **초록 점이 바로 꺼짐** (카메라 즉시 종료) |
| F-8 | 어두운 곳, 안경, 모자, 마스크 | 추적 품질 기록 (완벽하지 않아도 됨, 이상 동작만 기록) |
| F-9 | 10~15분 켜 두기 | 발열·끊김 정도 기록 |

**권한을 거부하면** 플랫폼마다 결과가 다릅니다.

- **Android**
  - 결과: "작업 실패: Camera permission is required for Mimic mode"가 뜨고, 모드는 이전 그대로 유지됩니다.
  - 다시 허용: `설정` → `애플리케이션` → `pocket_live2d` → `권한` → `카메라` → **앱 사용 중에만 허용**
- **iPhone**
  - 결과: "입력이 중단됐어요: …"가 뜨고 '기본' 모드로 돌아갑니다.
  - 다시 허용: `설정` 앱에서 이 앱을 찾아 → **카메라** 켜기
- **지원하지 않는 iPhone**: "작업 실패: ARKit face tracking is not supported on this device"가 뜨는 것이 정상입니다.

### G. 백그라운드 / 복귀

| # | 어떻게 | 정상이면 |
|---|---|---|
| G-1 | 자이로 모드에서 홈으로 나갔다가 앱으로 돌아오기 | 자이로 모드가 유지되고, 돌아온 순간의 자세가 새 기준이 됨 |
| G-2 | 따라하기 모드에서 홈으로 나가기 | 초록 점이 꺼짐 (백그라운드에서 카메라 사용 안 함) |
| G-3 | G-2 상태에서 앱으로 돌아오기 | 따라하기가 자동으로 다시 켜짐 (초록 점 다시 켜짐) |
| G-4 | 최근 앱 화면으로 앱 전환을 10번 반복 | 앱이 꺼지지 않고 캐릭터가 정상 표시 |
| G-5 | 화면 끄고 켜기 | 정상 복귀 |

### H. 홈 화면 배경화면 (Galaxy만)

SDK가 들어간 빌드에서만 동작합니다.

| # | 어떻게 | 정상이면 |
|---|---|---|
| H-1 | 앱에서 [배경화면] | 시스템 라이브 배경화면 미리보기가 열리고 Mark가 보임 |
| H-2 | 미리보기에서 기울이기·드래그 | 기울기와 손가락에 반응 |
| H-3 | **배경화면 설정**(적용) → 홈 화면 선택 | 홈 화면 배경에 Mark가 표시됨 |
| H-4 | 홈에서 휴대폰 기울이기 | 기울기에 반응 |
| H-5 | 홈의 빈 곳을 드래그 / 캐릭터를 짧게 탭 | 시선이 따라옴 / 반응 모션 |
| H-6 | 다른 앱을 열었다가 홈으로 돌아오기, 화면 끄고 켜기 | 다시 정상 표시 |
| H-7 | 배경화면을 쓰는 동안 계속 | **초록 점이 절대 뜨지 않아야 함** (배경화면은 카메라를 쓰지 않음) |
| H-8 | 몇 시간 사용 후 `설정` → `배터리` 사용량 확인 | 배터리 소모량 기록 |

- 배경화면 해제: `설정` → `배경화면 및 스타일`에서 다른 배경화면을 선택합니다.
- 잠금화면 적용은 기기나 One UI 버전에 따라 지원되지 않을 수 있습니다. 지원 여부를 기록해 주세요.

### I. 장시간 / 성능

| # | 어떻게 | 정상이면 |
|---|---|---|
| I-1 | release 빌드로 30분 이상 사용 (모드 바꿔 가며) | 앱 꺼짐 없음, 눈에 띄는 끊김 없음 |
| I-2 | 따라하기 30분 | 발열 정도 기록 (손으로 느낌 / 배터리 온도) |

---

## 7. SDK 없이 먼저 해 볼 수 있는 것

SDK를 받기 전 빌드에서도 앱이 실행되도록 만들어져 있습니다. 이때 정상 상태는 다음과 같습니다.

- 상태: **"Live2D SDK 연결이 필요합니다."**
- 캐릭터 영역이 비어 있음
- 반응·표정·배경화면 버튼이 비활성

이 상태에서도 아래 항목은 확인할 수 있습니다. 캐릭터는 움직이지 않습니다.

- 자이로·따라하기 모드 전환
- 카메라 권한 팝업 (F-1)
- 따라하기 ON/OFF 때 초록 점 켜짐·꺼짐 (F-2, F-7)
- 백그라운드에서 카메라 꺼짐 (G-2)

---

## 8. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `flutter devices`에 기기가 안 보임 | 데이터 케이블인지, USB 디버깅이 켜져 있는지, 휴대폰의 허용 팝업을 눌렀는지 확인. `adb devices`로도 확인. iPhone은 "신뢰"와 개발자 모드 확인 |
| `NDK not configured` / `CMake '3.22.1' was not found` | Android Studio SDK Tools에서 NDK와 CMake 3.22.1 설치 ([1장](#android-windows--macos--linux-모두-가능)) |
| `Cubism Core is missing for arm64-v8a` | SDK가 일부만 복사됨 → 2-2 다시 실행 |
| 빌드 중 `face_landmarker.task` 다운로드 실패 | 인터넷·회사 프록시 확인 후 다시 빌드 |
| Android에서 계속 "Live2D SDK 연결이 필요합니다." | `packages/pocket_live2d_native/cubism/Core/include/Live2DCubismCore.h`가 있는지 확인 → `flutter clean` 후 다시 `flutter run` |
| iPhone에서 계속 "Live2D SDK 연결이 필요합니다." | SDK를 **Mac에서** 준비했는지, `packages/pocket_live2d_native/ios/Cubism/Live2DCubismCore.xcframework`가 있는지 확인 → bootstrap 다시 실행 → `cd ios && pod install && cd ..` → `flutter clean` → `flutter run` |
| `pod install` 오류 | `cd ios && pod repo update && pod install && cd ..` |
| iPhone 앱이 홈 화면에서 실행하면 바로 꺼짐 | debug 빌드라서 그럴 수 있음 → `flutter run --release`로 다시 설치 |
| 앱이 실행 직후 꺼짐 | 로그 확인 ([3-3](#3-3-로그-보기), [4-4](#4-4-로그-보기)) 후 [9장](#9-문제를-공유할-때) 형식으로 공유 |

---

## 9. 문제를 공유할 때

아래 형식으로 남겨 주면 원인을 빨리 찾을 수 있습니다.

```text
- 기기 / OS: 예) Galaxy S23 / Android 14 (One UI 6.1), iPhone 15 / iOS 18.2
- 빌드: debug 또는 release
- 커밋: git rev-parse --short HEAD 결과
- 테스트 항목: 예) F-6
- 한 일: 
- 기대한 결과: 
- 실제 결과: (상태 메시지는 그대로 복사)
- 로그: flutter logs 또는 adb logcat / Xcode Console 일부
- 스크린샷 / 화면 녹화: (있으면)
```

---

## 10. 결과 기록표

테스트하면서 `O`(정상) / `X`(문제) / `-`(해당 없음)과 메모를 적어 둡니다. 이 표를 복사해서 이슈나 PR 코멘트에 붙여 넣어도 됩니다.

```text
기기 1: Galaxy ________ / Android __ (One UI __)    빌드: debug / release   커밋: _______
기기 2: iPhone ________ / iOS __                     빌드: debug / release   커밋: _______
```

| # | 항목 | Galaxy | iPhone | 메모 |
|---|---|:---:|:---:|---|
| A-1 | 실행 후 캐릭터 표시 | | | |
| A-2 | Idle 모션 자동 재생 | | | |
| A-3 | 텍스처·마스크·physics | | | |
| A-4 | 화면 회전 | | | |
| A-5 | 다시 불러오기 | | | |
| B-1 | 반응 버튼 | | | |
| B-2 | 표정 버튼 | | | |
| C-1 | 드래그 시선 | | | |
| C-2 | 손 떼면 복귀 | | | |
| C-3 | 몸 탭 → 반응 | | | |
| C-4 | 빈 공간 탭 무반응 | | | |
| C-5 | 따라하기 중 터치 무시 | | | |
| D-1~D-6 | 자이로 | | | |
| E-1~E-3 | 흔들기 | | | |
| F-1 | 카메라 권한 팝업 | | | |
| F-2 | 초록 점 켜짐 | | | |
| F-3 | 고개 방향 | | | |
| F-4 | 눈 깜빡임 | | | |
| F-5 | 입 벌림·웃음 | | | |
| F-6 | 얼굴 사라짐 → 기본 자세 | | | |
| F-7 | 끄면 초록 점 즉시 꺼짐 | | | |
| F-8 | 저조도·안경·가림 | | | |
| F-9 | 15분 발열 | | | |
| 권한 거부 | 거부 시 메시지·모드 | | | |
| G-1~G-5 | 백그라운드·복귀 | | | |
| H-1~H-8 | 배경화면 | | - | |
| I-1~I-2 | 장시간·성능 | | | |
