# Pocket Live2D

휴대폰을 기울이고, 흔들고, 화면을 만지면 반응하는 **Live2D 캐릭터 웹페이지**입니다.
같은 사이트에서 `/haru`, `/mark`처럼 URL 경로로 캐릭터를 고릅니다. 모델 데이터를 Cloudflare R2에 두면 폴더 업로드만으로 새 캐릭터를 추가할 수 있습니다.

- 기울이기·흔들기: 기기 동작 센서 (iPhone은 버튼을 눌러 권한 허용)
- 터치: 드래그하면 시선이 따라오고, 캐릭터를 탭하면 반응 모션
- 얼굴 따라하기: 전면 카메라로 고개·눈·입·눈썹 움직임 반영 (직접 켜고 권한 허용, 영상은 기기 안에서 처리)
- 얼굴 미리보기는 영상 대신 트래킹 포인트만 표시
- UI 숨기기: 캐릭터만 보기, 화면을 10초 길게 누르면 UI 복귀
- 모바일 세로 전용: 가로로 돌리면 세로 안내를 표시하고 조작 차단
- URL 경로별 모델 로딩: R2 또는 같은 출처 `/models/`에서 캐릭터 데이터 읽기
- 첫 방문 때 이용약관·개인정보처리방침 동의
- 캐릭터 렌더링: Live2D Cubism SDK for Web 5-r.5 (저장소에는 포함하지 않음)

> 이전에는 Flutter 앱(Pocket Live2D)이었고, 웹으로 전환했습니다. 앱 코드는 git 기록에 남아 있습니다.
> 서비스 이름은 Pocket Live2D, npm 패키지 이름은 `pocket-live2d`입니다. 화면 이름은 `src/config.ts`에서 관리합니다. Live2D 상표 사용 조건은 [라이선스 문서](docs/LICENSING.md)를 확인하세요.

## 빠른 시작

필요한 것: Node.js 20.19 이상 (22 권장), Python 3.9 이상

```bash
npm install
npm run dev          # http://localhost:5173
```

SDK 없이 실행하면 화면에 "Live2D SDK가 연결되지 않은 빌드예요"가 나옵니다. 정상입니다.
첫 `dev`·`build` 실행은 공식 MediaPipe 얼굴 추적 모델(약 3.8 MB)을 내려받아 SHA-256을 검증하고 `vendor/mediapipe/`에 캐시합니다.
WASM과 모델은 빌드에 포함해 자체 호스팅합니다. 캐시가 없으면 빌드 시 인터넷 연결이 필요합니다.

### 캐릭터가 보이게 하려면 (Cubism SDK for Web)

1. [Cubism SDK for Web](https://www.live2d.com/download/cubism-sdk/download-web/)을 받아 압축을 풉니다. **Native SDK가 아니라 Web SDK**여야 합니다.
2. 압축을 푼 폴더 경로를 넣어 준비 스크립트를 실행합니다.
   ```bash
   python3 tool/prepare_cubism_web.py ~/Downloads/CubismSdkForWeb-5-r.5
   ```
   필요한 파일만 `vendor/cubism/`에 복사됩니다. 이 폴더는 git에 올라가지 않습니다.
3. `npm run dev`를 다시 실행하면 캐릭터가 보입니다.

자세한 내용: [Cubism SDK 설정](docs/CUBISM_SDK_SETUP.md)

### 휴대폰으로 테스트하기

기울이기 센서는 `https` 주소에서만 동작합니다. 같은 Wi-Fi의 휴대폰으로 테스트할 때는 다음을 실행합니다.

```bash
npm run dev:https    # https://<PC의 IP>:5173 (자체 서명 인증서 경고는 '계속'을 누르면 됨)
```

기기별 테스트 방법, 박람회 태블릿 설정, 배포와 QR 코드는 [웹 테스트·배포 가이드](docs/WEB_TESTING.md)에 있습니다.

### 얼굴 따라하기

캐릭터가 표시된 뒤 **얼굴 따라하기 켜기**를 누르고 카메라 접근을 허용합니다.
작은 미리보기에는 얼굴 트래킹 포인트만 표시하고 실제 카메라 영상은 화면에 표시하지 않습니다.
얼굴이 감지되면 첫 자세를 정면으로 보정하며, 고개 방향·눈 깜빡임·입 벌리기·눈썹을 반영합니다.
미소·시선은 모델에 해당 파라미터가 있는 범위에서 반영됩니다. Mark에는 입 모양(`ParamMouthForm`)이 없어 미소 모양은 바뀌지 않습니다.

기울이기와 얼굴 따라하기는 동시에 켤 수 없습니다. 따라하기를 켜면 기울이기가 꺼지고, 기울이기를 켜면 따라하기와 카메라가 종료됩니다. 한 기능을 꺼도 이전 기능이 자동으로 다시 켜지지는 않습니다.
드래그 시선은 고개·시선보다 우선합니다.
기능을 끄거나 다른 탭으로 이동하거나 모바일을 가로로 돌리면 카메라 촬영도 종료됩니다. 다시 사용하려면 직접 켜야 합니다.
웹 카메라에는 HTTPS 또는 localhost가 필요합니다. 모바일 HTTP IP 주소에서는 켜지지 않습니다.

추론은 Worker에서 최대 15 fps로 수행하고 한 프레임씩 처리합니다. 카메라 영상·얼굴 값은 저장·전송하지 않습니다.
MediaPipe의 성능·사용 지표는 Google의 [개인정보 안내](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice)를 따릅니다.
실제 iPhone·Android의 추적 감도와 프레임 속도는 실기기 확인이 필요합니다.

### 캐릭터만 보기

상단 **UI 숨기기**를 누르면 제목·정보·조작 버튼·상태 메시지·얼굴 포인트 창을 모두 숨깁니다.
캐릭터 재생·터치·켜 둔 얼굴 따라하기는 계속 작동합니다. 화면의 같은 자리를 **10초 동안 계속 누르면** UI가 다시 나타납니다.
손을 떼거나 16px를 넘게 이동하거나 다른 손가락을 대면 복귀 타이머가 취소됩니다. 탭 이탈·화면 회전·포인터 캡처 손실도 타이머를 취소합니다.
PC에서는 **Escape**로도 UI를 다시 표시할 수 있습니다. 모바일 가로의 세로 안내는 유지하며, 숨김 상태는 새로고침 후 유지하지 않습니다.

### 내 PC에서 Cloudflare Pages 배포하기

Node.js 24 LTS와 Python 3.9 이상을 준비하고, 최신 코드와 공식 **Cubism SDK for Web 5-r.5**를 로컬에 준비합니다. 처음 설정부터 실행할 명령과 Windows/macOS SDK 경로 예시는 [로컬 배포 가이드](docs/LOCAL_DEPLOY.md)에 있습니다.

```bash
npm ci
npm run deploy:setup       # .env.local 생성; 기존 파일 보존
# 공식 Web SDK를 받아 tool/prepare_cubism_web.py로 준비
npm run deploy:login       # 브라우저에서 Cloudflare 로그인
npm run deploy:check       # SDK 타입 + 실제 R2 파일 검사
npm run deploy:dry-run     # 빌드와 배포 계획 확인
npm run deploy:pages       # pocket-live2d 프로젝트에 실제 업로드
```

배포 주소는 `https://pocket-live2d.pages.dev/mark`입니다. 모델은 이미 R2의 `pocket-live2d` 버킷에 업로드되어 있으므로 로컬에서 다시 업로드할 필요는 없습니다. `deploy:setup`의 기본 공개 주소는 `https://pub-108d29ef05ad474597a55db4df55a8bd.r2.dev`입니다.

GitHub에는 SDK를 포함하지 않으므로 SDK가 준비된 PC에서 직접 업로드합니다. 사용자 지정 도메인과 R2 CORS는 [R2 설정 가이드](docs/R2_SETUP.md)를 보세요.

## R2에 모델만 추가하기

처음 `.env.local`에 `VITE_MODEL_BASE_URL=https://모델-저장소-공개주소/models/`를 설정하고 사이트를 배포합니다.
이후 새 캐릭터는 모델 폴더와 `character.json`을 R2의 `models/<이름>/`에 올리면 `/<이름>`에서 읽습니다. 코드나 모델 목록을 수정하거나 사이트를 다시 빌드할 필요는 없습니다.
R2 버킷 공개 설정과 CORS가 필요하며, 모델의 `.moc3`·텍스처·모션 등 참조 파일도 함께 올립니다. API 키는 사이트에 넣지 않습니다.

```bash
npm run model:prepare -- haru /path/to/Haru --name "하루"
```

`.model-uploads/models/haru/`가 만들어집니다. 모델 JSON의 참조 파일만 복사하고 이름·모델 파일·모션 그룹을 담은 `character.json`을 생성합니다.
기본 `/`는 사이트에 함께 넣은 데모를 유지하고, 경로가 지정되면 해당 폴더를 읽습니다. 상세 설정과 업로드 방법: [R2 모델 저장과 URL 연결](docs/R2_MODELS.md).

## 기본 캐릭터를 사이트와 함께 빌드하기

캐릭터마다 `characters/<id>/` 폴더를 만듭니다.

```text
characters/
└── mark/
    ├── character.json        # 이름, 모델 파일, 모션 그룹, 저작권 표기
    └── model/                # Cubism Editor에서 내보낸 모델 (model3.json, moc3, 텍스처, 모션 등)
```

`character.json` 예시:

```json
{
  "id": "mark",
  "name": "Mark-kun",
  "model": "Mark.model3.json",
  "idleMotion": "Idle",
  "tapMotion": "TapBody",
  "shakeMotion": "Shake",
  "credit": "캐릭터 권리자 표기 (필요한 경우)"
}
```

모델의 model3.json에 `idleMotion`, `tapMotion`, `shakeMotion` 이름의 모션 그룹이 있어야 합니다(테스트가 확인합니다).

캐릭터별로 빌드하면 `dist/<id>/`에 그대로 올릴 수 있는 정적 사이트가 만들어집니다.

```bash
CHARACTER=mark npm run build            # macOS / Linux / Git Bash
$env:CHARACTER="mark"; npm run build    # Windows PowerShell
```

## 개발용 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` / `npm run dev:https` | 개발 서버 (http / 휴대폰 테스트용 https) |
| `npm test` | 단위 테스트 (기울기 필터, 흔들기, 탭, 약관, 캐릭터 설정) |
| `npm run typecheck` | 타입 검사, `.vue` 포함 (SDK 없이 가능) |
| `npm run typecheck:sdk` | SDK 렌더러까지 타입 검사 (SDK를 준비한 뒤) |
| `npm run build` | 캐릭터 사이트 빌드 (`CHARACTER`로 캐릭터 선택, 기본 mark) |
| `npm run validate:models` | 모델 파일 참조와 파일 형식 검사 |
| `npm run model:prepare -- <이름> <모델폴더>` | R2 업로드용 참조 파일과 character.json 준비 |

## 구조

```text
src/
├── main.ts                 Vue 앱 시작
├── App.vue                 화면 구성 (동의, 정보, 문서, 세로 화면 안내)
├── components/             화면 조각 (상단 바, 조작 버튼, 얼굴 포인트, 대화상자)
├── composables/            화면 상태 (캐릭터·입력 제어, 상태 문구, 가로 화면 감지)
├── config.ts               서비스 이름, 약관 동의 버전
├── input/                  기울기 보정·필터, 흔들기, 탭 판정, 센서 권한, 얼굴 추적
├── legal/                  약관 동의 저장, 약관 문서 해석
└── live2d/
    ├── renderer.ts         페이지가 쓰는 렌더러 인터페이스
    ├── unavailable.ts      SDK 없는 빌드용 (안내 문구만 표시)
    └── cubism/             SDK가 있을 때만 쓰는 Cubism 렌더러
legal/                      이용약관, 개인정보처리방침 (페이지가 그대로 표시)
characters/<id>/            캐릭터 설정과 모델
tool/                       SDK 준비, 정적 파일 준비, 모델 검사
```

화면은 Vue 3(Composition API, `<script setup>`)로 만들었습니다. `input/`, `live2d/`, `legal/`의 기능 코드는 Vue에 의존하지 않는 TypeScript라 단위 테스트를 그대로 씁니다. 렌더러·센서·카메라 같은 객체는 반응형으로 감싸지 않고, 화면에 보이는 값만 Vue 상태로 둡니다.

SDK가 없을 때도 페이지가 멈추지 않도록, Cubism Framework는 Core가 로드된 것을 확인한 뒤에만 별도 파일로 불러옵니다.

## 이용약관·라이선스

- [이용약관](legal/terms_of_service.md): Live2D Cubism Core와 캐릭터 데이터 보호 조항 포함
- [개인정보처리방침](legal/privacy_policy.md): 센서·터치·카메라 영상은 기기 안에서만 처리, MediaPipe 지표 처리 안내
- [라이선스와 공개 준비](docs/LICENSING.md): Live2D 약관 판단, 공개 전 체크리스트, 박람회·외주·유료화 검토

`Mark`는 Live2D 공식 샘플 모델이며 사용 조건은 [모델 README](characters/mark/model/README.md)에 있습니다.

### R2 업로드 자동화

모델을 별도 R2 버킷에 올리고 공개 파일·CORS·무결성을 검증하는 명령을 추가했습니다.

```bash
npm run upload:models -- mark --dry-run
npm run upload:models -- mark
npm run verify:models -- --origin https://pocket-live2d.pages.dev
npm run deploy -- --project pocket-live2d --dry-run
```

버킷 이름·공개 주소·권한 설정은 [R2 업로드 가이드](docs/R2_SETUP.md)에 있습니다. 기존 경로 선택·카메라·UI 기능을 그대로 사용하며, 공개 버킷 주소만 지정하는 `characters/<id>/model/` 구조와 `/models/` 접두사를 지정하는 기존 구조를 모두 지원합니다.
