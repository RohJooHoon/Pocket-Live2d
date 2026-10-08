# R2 모델 저장소와 캐릭터 경로

하나의 Pages 사이트에서 `/mark`, `/다른캐릭터id`로 캐릭터를 선택합니다. `/`는 기본 캐릭터(`CHARACTER`, 기본값 `mark`)입니다. 알 수 없는 경로는 안내 화면을 표시합니다. 캐릭터 ID는 1~64자의 영문·숫자·하이픈·밑줄을 사용합니다.

웹 앱·Cubism Core·셰이더·카메라 런타임은 **Pages**, 캐릭터 모델과 `character.json`은 **R2**에 둡니다. 공개 주소 연결과 최초 배포 이후 새 캐릭터는 R2 폴더만 추가하면 됩니다. 이름·모델 파일 변경도 캐릭터 정보를 업로드하면 반영됩니다(모델 파일 캐시 최대 1시간).

## 1. 버킷과 공개 주소

사용할 버킷: `pocket-live2d`.

Cloudflare R2 → 버킷 → **Settings**에서 다음 중 하나를 설정합니다.

- 개발 확인: **Public Development URL**을 활성화해 `https://pub-….r2.dev` 주소를 받습니다. 요청 제한이 있으므로 서비스 운영에는 사용자 지정 도메인을 권장합니다.
- 운영: **Custom Domains**에 `models.example.com` 같은 도메인을 연결합니다.

`dash.cloudflare.com/.../buckets/...`는 관리 화면이며 다운로드 주소가 아닙니다. `<account>.r2.cloudflarestorage.com`도 인증을 사용하는 S3 API 주소이므로 브라우저용 공개 주소로 쓰지 않습니다.

`.env.example`을 `.env.local`로 복사한 뒤 다음을 지정합니다. 이미 파일이 있으면 기존 설정을 보존하고 필요한 항목만 추가합니다.

```dotenv
R2_BUCKET=pocket-live2d
VITE_MODEL_BASE_URL=https://pub-실제주소.r2.dev
PAGES_PROJECT=pocket-live2d
CHARACTER=mark
```

`VITE_MODEL_BASE_URL`은 브라우저에 공개됩니다. 여기에 토큰·서명 URL을 넣지 마세요. 주소 뒤에 `/characters/mark/model/`을 붙이지 않습니다. 앱이 자동으로 붙입니다. `.env.local` 변경 후에는 개발 서버를 재시작하고 Pages를 다시 빌드합니다.

주소를 비워 두면 기본 모델은 `/model/`, `model:prepare`로 준비한 다른 모델은 `/models/<id>/`에 포함됩니다. 설정하면 모델은 Pages 빌드에서 제외됩니다. 빌드 출력은 두 경우 모두 `dist/mark/`입니다.

## 2. 모델 업로드

본인 PC에서는 `npx wrangler@4 login`으로 로그인합니다. 클라우드에서는 환경 설정에 `CLOUDFLARE_ACCOUNT_ID`와 `CLOUDFLARE_API_TOKEN`을 안전하게 등록합니다. 토큰에는 해당 계정의 R2 객체 쓰기 권한이 필요하고, Pages 배포도 수행한다면 Pages 편집 권한도 필요합니다. 비밀 값은 코드·채팅에 넣지 않습니다.

```bash
# 파일과 목적지 확인. Cloudflare에 쓰지 않습니다.
npm run upload:models -- mark --dry-run

# 기존 버킷으로 Mark 업로드
npm run upload:models -- mark

# 모든 캐릭터 업로드 (또는 --bucket으로 버킷 이름 지정)
npm run upload:models
```

명령은 모델 무결성 검사를 먼저 수행하고, model3.json이 참조하는 파일과 모델 정의만 업로드합니다. Mark는 중복 참조를 제외한 **15개 객체** (모델 14개 + 캐릭터 정보 1개)입니다. SDK·README·관계없는 파일은 업로드하지 않습니다. `character.json`은 모든 모델 파일 뒤에 마지막으로 업로드됩니다. 같은 키의 기존 객체는 교체됩니다. 업로드 도중 실패하면 원인을 해결하고 다시 실행합니다. 이전 캐릭터의 불필요한 객체를 자동 삭제하지는 않습니다.

객체 키는 아래 구조를 그대로 유지합니다. 대시보드에서 수동 업로드해도 폴더 구조가 같아야 합니다.

```text
characters/mark/model/character.json
characters/mark/model/Mark.model3.json
characters/mark/model/Mark.moc3
characters/mark/model/Mark.2048/texture_00.png
characters/mark/model/motions/...
characters/mark/model/expressions/...
```

## 3. CORS

R2 버킷의 Settings → **CORS policy**에서 Pages 사이트와 필요한 개발 주소의 GET·HEAD 요청을 허용합니다. 대시보드는 S3 형식의 배열을 받습니다. 아래 주소를 실제 Pages 프로젝트·도메인으로 바꿉니다.

```json
[
  {
    "AllowedOrigins": ["https://pocket-live2d.pages.dev", "http://localhost:5173", "http://127.0.0.1:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

CLI에서는 대시보드와 **다른 JSON 형식**을 사용합니다. `deploy/cloudflare/r2-cors.example.json`의 `allowed.origins`를 실제 주소로 수정한 별도 파일을 준비하고 적용합니다. 기존 정책이 있다면 필요한 origin을 보존해서 병합하세요. 이 명령은 전체 버킷 CORS 정책을 교체합니다.

```bash
npx wrangler@4 r2 bucket cors set pocket-live2d --file /path/to/r2-cors.json
```

사용자 지정 Pages 도메인이나 배포 미리보기 주소로 테스트할 때는 해당 origin도 추가해야 합니다. URL 경로(`/mark`)는 origin에 넣지 않습니다. 웹 앱은 이미지에 `crossOrigin=anonymous`를 사용합니다. CORS가 빠지면 모델 JSON 요청이나 WebGL 텍스처 업로드가 실패합니다.

## 4. 공개 파일 검증과 Pages 배포

내 PC에서 최신 코드 받기부터 SDK·로그인·배포까지의 순서는 [로컬 배포 가이드](LOCAL_DEPLOY.md)에 있습니다.

```bash
npm run verify:models -- --origin https://pocket-live2d.pages.dev
```

모든 모델 객체의 공개 접근, CORS, Content-Type, 로컬 원본과 SHA-256 일치를 확인합니다. 주소가 틀렸거나 R2가 비어 있거나 CORS가 빠지면 실패합니다.

SDK는 별도로 [공식 Web SDK 준비 절차](CUBISM_SDK_SETUP.md)를 따릅니다.

```bash
npm run typecheck:sdk
npm run deploy -- --dry-run
npm run deploy -- --project pocket-live2d
```

실제 배포 명령은 SDK, R2 모델 검증, 모델이 제외된 빌드를 확인한 뒤 `dist/mark/`를 하나의 Pages 프로젝트에 업로드합니다. `CHARACTER`로 기본 캐릭터를 바꾸면 출력은 `dist/<id>/`가 됩니다. `--dry-run`은 SDK 없이도 배포 계획과 R2 빌드를 확인하지만, 실제 R2 접근·SDK 렌더링을 검증하지 않습니다.

기존 `/models/` 접두사를 포함한 주소도 지원합니다. 이 경우 업로드 키는 `models/<id>/`이며 추가 `model/` 하위 폴더를 사용하지 않습니다.

최종 주소는 `https://pocket-live2d.pages.dev/mark`입니다. 다른 프로젝트를 사용하면 `PAGES_PROJECT` 또는 `--project <name>`으로 지정합니다. Pages의 기본 SPA fallback을 사용하므로 `404.html`을 추가하지 마세요. `/mark`와 `/mark/` 모두 같은 캐릭터를 표시하며, 앱·Core·셰이더 주소는 사이트 루트 기준이어서 새로고침해도 경로가 깨지지 않습니다.

실제 표시·모션은 SDK를 넣은 사이트에서 확인하고, 기울기·흔들기는 HTTPS와 실기기에서 확인합니다. 로컬 R2 모의 서버나 SDK 없는 테스트 통과는 실제 R2 업로드·캐릭터 렌더링 완료를 의미하지 않습니다.
