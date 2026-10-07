# MotionMate

휴대폰을 기울이고, 흔들고, 화면을 만지면 반응하는 **Live2D 캐릭터 웹페이지**입니다.
캐릭터 하나가 사이트 하나가 되며, 도메인마다 다른 캐릭터를 올리고 QR 코드로 접속하는 용도를 기준으로 만들었습니다.

- 기울이기·흔들기: 기기 동작 센서 (iPhone은 버튼을 눌러 권한 허용)
- 터치: 드래그하면 시선이 따라오고, 캐릭터를 탭하면 반응 모션
- 첫 방문 때 이용약관·개인정보처리방침 동의
- 캐릭터 렌더링: Live2D Cubism SDK for Web 5-r.5 (저장소에는 포함하지 않음)

> 이전에는 Flutter 앱(Pocket Live2D)이었고, 웹으로 전환했습니다. 앱 코드는 git 기록에 남아 있습니다.
> MotionMate는 작업 이름입니다. 같은 이름을 쓰는 앱이 있어 공개 전에 이름을 확정해야 합니다. 이름은 `src/config.ts` 한 곳에서 바꿉니다.

## 빠른 시작

필요한 것: Node.js 20.19 이상 (22 권장), Python 3.9 이상

```bash
npm install
npm run dev          # http://localhost:5173
```

SDK 없이 실행하면 화면에 "Live2D SDK가 연결되지 않은 빌드예요"가 나옵니다. 정상입니다.

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

### 인터넷에 올리기 (Cloudflare Pages)

SDK가 준비된 PC에서 빌드해 Cloudflare Pages에 직접 업로드합니다. 주소는 `https://<프로젝트>.pages.dev`로 바로 https입니다.

```bash
npx wrangler login         # 처음 한 번 (Node.js 22 이상 필요)
npm run deploy -- mark     # 빌드 → Core 포함 확인 → 업로드
```

Cloudflare의 GitHub 연동 자동 빌드는 쓰지 않습니다. Cloudflare 서버에는 SDK가 없고, SDK를 저장소에 넣을 수도 없기 때문입니다.
커스텀 도메인 연결과 QR 코드는 [웹 테스트·배포 가이드 7장](docs/WEB_TESTING.md#7-배포와-qr-코드-cloudflare-pages)을 보세요.

## 캐릭터 사이트 만들기

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
| `npm run typecheck` | 타입 검사 (SDK 없이 가능) |
| `npm run typecheck:sdk` | SDK 렌더러까지 타입 검사 (SDK를 준비한 뒤) |
| `npm run build` | 캐릭터 사이트 빌드 (`CHARACTER`로 캐릭터 선택, 기본 mark) |
| `npm run validate:models` | 모델 파일 참조와 파일 형식 검사 |

## 구조

```text
src/
├── main.ts                 화면 연결 (동의, 버튼, 터치, 기울이기)
├── config.ts               서비스 이름, 약관 동의 버전
├── input/                  기울기 보정·필터, 흔들기, 탭 판정, 센서 권한
├── legal/                  약관 동의 저장, 약관 문서 표시
└── live2d/
    ├── renderer.ts         페이지가 쓰는 렌더러 인터페이스
    ├── unavailable.ts      SDK 없는 빌드용 (안내 문구만 표시)
    └── cubism/             SDK가 있을 때만 쓰는 Cubism 렌더러
legal/                      이용약관, 개인정보처리방침 (페이지가 그대로 표시)
characters/<id>/            캐릭터 설정과 모델
tool/                       SDK 준비, 정적 파일 준비, 모델 검사
```

SDK가 없을 때도 페이지가 멈추지 않도록, Cubism Framework는 Core가 로드된 것을 확인한 뒤에만 별도 파일로 불러옵니다.

## 이용약관·라이선스

- [이용약관](legal/terms_of_service.md): Live2D Cubism Core와 캐릭터 데이터 보호 조항 포함
- [개인정보처리방침](legal/privacy_policy.md): 센서·터치 값은 기기 안에서만 처리, 카메라 미사용
- [라이선스와 공개 준비](docs/LICENSING.md): Live2D 약관 판단, 공개 전 체크리스트, 박람회·외주·유료화 검토

`Mark`는 Live2D 공식 샘플 모델이며 사용 조건은 [모델 README](characters/mark/model/README.md)에 있습니다.
