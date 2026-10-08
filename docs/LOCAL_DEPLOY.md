# 내 PC에서 Cloudflare Pages 배포하기

이 저장소의 최신 `main`을 받아 **내 PC에 준비한 Cubism SDK**로 빌드하고, 기존 Pages 프로젝트 `pocket-live2d`에 직접 업로드합니다. 결과 주소는 `https://pocket-live2d.pages.dev/mark`입니다.

모델과 `character.json` 15개는 이미 R2 버킷 `pocket-live2d`에 업로드되어 있습니다. 처음 Pages를 배포하기 위해 모델을 다시 업로드할 필요는 없습니다.

## 1. 최신 코드와 의존성 받기

Node.js **24 LTS**와 Python **3.9 이상**을 설치합니다. 처음 받을 때:

```bash
git clone https://github.com/RohJooHoon/Pocket-Live2d.git
cd Pocket-Live2d
npm ci
npm run deploy:setup
```

이미 저장소가 있으면 기존 파일을 보존한 상태에서 `git switch main`, `git pull --ff-only`로 갱신하고 `npm ci`, `npm run deploy:setup`을 실행합니다. 로컬 변경 때문에 전환·갱신이 거부되면 그 변경을 먼저 보존합니다.

`deploy:setup`은 `.env.example`에서 `.env.local`을 생성합니다. 기존 `.env.local`은 덮어쓰지 않으므로 아래 설정과 비교해 수정하세요.

```dotenv
VITE_MODEL_BASE_URL=https://pub-108d29ef05ad474597a55db4df55a8bd.r2.dev
R2_BUCKET=pocket-live2d
PAGES_PROJECT=pocket-live2d
CLOUDFLARE_ACCOUNT_ID=17772b57bcc0e685fe3aa60a550cfff0
CHARACTER=mark
```

이 값들은 공개 주소와 계정 식별자입니다. 로컬 배포 인증은 다음의 브라우저 로그인을 사용하므로 `.env.local`에 API 토큰을 넣을 필요는 없습니다. `VITE_MODEL_BASE_URL` 뒤에 `/models/`나 캐릭터 경로를 추가하지 않습니다. 현재 R2 파일은 `characters/mark/model/` 구조입니다. 기존 터미널에 같은 이름의 환경 변수가 있으면 `.env.local`보다 우선하므로 이전 R2 주소를 사용하지 않는지도 확인합니다.

## 2. 공식 Web SDK 준비

[Live2D 공식 다운로드](https://www.live2d.com/download/cubism-sdk/download-web/)에서 **Cubism SDK for Web 5-r.5**를 받아 라이선스에 동의하고 압축을 풉니다. 압축을 푼 SDK 루트에는 `Core`, `Framework`, `Samples` 폴더가 있어야 합니다.

프로젝트 루트에서 **실제 압축 해제 경로**를 지정합니다. 경로에 공백이 있어도 따옴표로 감싸면 됩니다.

macOS / Linux:

```bash
python3 tool/prepare_cubism_web.py "$HOME/Downloads/CubismSdkForWeb-5-r.5"
```

Windows PowerShell:

```powershell
py -3 tool/prepare_cubism_web.py "$env:USERPROFILE\Downloads\CubismSdkForWeb-5-r.5"
```

Windows에서 `py`가 없고 `python`으로 Python 3을 실행하고 있다면 `python tool/prepare_cubism_web.py "실제 SDK 경로"`를 사용합니다. Native SDK는 사용할 수 없습니다. 필요한 파일만 무시된 `vendor/cubism/`에 복사되며 SDK를 Git에 넣지 않습니다.

## 3. Cloudflare 로그인과 검사

```bash
npm run deploy:login
npm run deploy:check
npm run deploy:dry-run
```

- `deploy:login`: 브라우저가 열리면 버킷과 Pages 프로젝트를 만든 Cloudflare 계정으로 로그인하고 권한을 허용합니다. 로그인은 SDK 준비와 별개로 실행할 수 있습니다.
- `deploy:check`: SDK 렌더러 타입 검사와 R2 객체 15개의 공개 접근·CORS·Content-Type·SHA-256 검사를 수행합니다.
- `deploy:dry-run`: 실제 빌드와 배포 대상·명령만 확인합니다. Cloudflare에 업로드하지 않습니다. SDK 없이도 실행되므로 실제 배포 준비 완료를 뜻하지는 않습니다.

클라우드 환경에서 등록한 토큰은 본인 PC에 자동으로 전달되지 않습니다. PC에서는 이 로그인 명령을 쓰면 됩니다. 터미널에 이전 `CLOUDFLARE_API_TOKEN`이 남아 있으면 Wrangler가 그 토큰을 우선하므로 올바른 인증을 사용하고 있는지 확인합니다.

## 4. 실제 Pages 배포

```bash
npm run deploy:pages
```

이 명령은 프로젝트 이름을 **`pocket-live2d`로 지정**합니다. SDK 확인 → SDK 타입 검사 → 빌드 → Core 포함과 모델 제외 확인 → R2 공개 파일 검사 → Pages 업로드를 수행합니다. 오류가 있으면 업로드 전에 멈춥니다. 기존 같은 이름의 프로젝트의 프로덕션 배포가 갱신됩니다.

빌드 결과는 기본적으로 `dist/mark/`입니다. 직접 폴더를 업로드할 필요 없이 명령이 처리합니다. 완료 메시지가 나온 뒤 `https://pocket-live2d.pages.dev/mark`와 `/mark/`를 새로고침해서 캐릭터 표시를 확인합니다. SDK 안내 문구가 없어야 하며, 실제 렌더링·카메라·휴대폰 센서는 배포한 사이트에서 직접 확인해야 합니다.

R2에는 모델을, Pages에는 웹 앱·Core·셰이더·카메라 파일을 올립니다. 이 단계에서 R2 모델을 교체하거나 삭제하지 않습니다. 이후 코드 변경은 최신 코드를 받아 `npm ci` 후 `npm run deploy:pages`로 재배포합니다. R2만 새 모델 폴더로 추가할 때는 [R2 가이드](R2_SETUP.md)를 따릅니다.

다른 Pages 프로젝트에 올리는 경우에는 일반 명령 `npm run deploy -- --project <이름>`을 사용하고 R2 CORS에도 그 사이트 origin을 추가합니다.
