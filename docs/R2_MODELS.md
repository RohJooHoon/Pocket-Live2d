# URL 경로로 캐릭터 띄우기

사이트 코드는 Cloudflare Pages, 모델 파일은 Cloudflare R2에 둡니다.
처음 R2 주소를 설정하고 사이트를 배포한 뒤에는 새 모델 폴더만 업로드하면 됩니다. 코드 수정, 모델 목록 수정, 사이트 재빌드는 필요하지 않습니다.

| 사이트 주소 | 읽는 R2 파일 |
|---|---|
| `/` | R2 설정 시 기본 캐릭터의 `character.json`, 설정이 없으면 함께 빌드한 데모 |
| `/haru` 또는 `/haru/` | `models/haru/character.json` → 같은 폴더의 모델 파일 |
| `/mark` | `models/mark/character.json` → 같은 폴더의 모델 파일 |

폴더 이름은 1~64자의 영문·숫자·`-`·`_`를 사용하고 대소문자를 구분합니다. 한 URL에서 한 캐릭터를 읽습니다.
공개 R2 주소로는 파일 목록을 조회할 수 없으므로 각 폴더의 `character.json`이 정확한 모델 파일명을 알려 줍니다.
없는 캐릭터 주소는 오류를 표시하며 다른 캐릭터로 바꾸지 않습니다.

## 1. R2 버킷 만들기

1. Cloudflare 대시보드 → **R2 object storage**에서 버킷을 만듭니다. 예: `pocket-live2d-models`.
2. 버킷 **Settings → Public Development URL → Enable**로 테스트용 `https://pub-….r2.dev` 주소를 얻습니다.
3. 실제 공개 운영은 **Custom Domains**에서 소유한 도메인(예: `models.example.com`)을 연결합니다. `r2.dev`는 개발용이며 속도 제한이 있습니다.

웹에 공개한 모델 파일은 URL을 아는 사람이 내려받을 수 있습니다. 웹 모델을 숨기거나 추출을 막는 저장 방식은 아닙니다.
Core는 기존대로 SDK가 있는 PC에서 사이트 빌드에 포함합니다. R2에는 모델 데이터만 올립니다.

## 2. 브라우저 읽기 허용 (CORS)

버킷 **Settings → CORS Policy → Add CORS policy**에 넣습니다.
운영 도메인이 다르면 `AllowedOrigins`를 실제 사이트 주소로 바꾸고, 필요한 개발 서버 주소만 추가합니다.

```json
[
  {
    "AllowedOrigins": ["https://pocket-live2d.pages.dev", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "MaxAgeSeconds": 3600
  }
]
```

사이트가 읽는 것은 메타데이터 JSON, moc3, 텍스처, 모션 등입니다. 텍스처도 CORS를 허용해야 WebGL에서 사용할 수 있습니다.
기존에 커스텀 도메인 캐시를 사용했다면 CORS 변경 후 캐시를 갱신합니다.

## 3. 사이트에 R2 주소 설정 (처음 한 번)

프로젝트 루트에 `.env.local`을 만들고 **공개 모델 URL**을 넣습니다.

```dotenv
VITE_MODEL_BASE_URL=https://models.example.com/models/
```

테스트 중에는 실제 버킷의 `https://pub-….r2.dev/models/` 주소를 넣습니다.
`models/` 접두사까지 포함하며, API 토큰·액세스 키·비밀 키는 넣지 않습니다. `VITE_` 값은 브라우저에 공개됩니다.

SDK가 준비된 PC에서 처음 한 번 배포합니다.

```bash
npm ci
npm run typecheck:sdk
npm run deploy -- mark
```

이후 R2에 새 캐릭터를 올릴 때 이 명령을 다시 실행할 필요는 없습니다. R2 주소 자체를 바꾸면 재빌드·재배포가 필요합니다.

## 4. 모델 폴더 준비

Cubism Editor에서 내보낸 **model3.json이 있는 폴더**를 지정합니다.

```bash
npm run model:prepare -- haru /path/to/Haru --name "하루" --credit "캐릭터 권리자 표기"
```

결과는 `.model-uploads/models/haru/`입니다. `model3.json`의 파일 참조를 검사하고 필요한 파일만 복사하며 `character.json`을 만듭니다.
PSD 같은 원화 작업 파일은 복사하지 않습니다. 이 명령은 업로드하거나 사이트 코드를 바꾸지 않습니다.
같은 폴더에 여러 모델 JSON이 있으면 `--model Haru.model3.json`으로 지정합니다.

기본 Mark를 준비하려면:

```bash
npm run model:prepare -- mark characters/mark/model
```

저장소 캐릭터 설정이 있으면 이름·저작권 표기·모션 그룹을 유지합니다. 외부 모델은 내보낸 모션 그룹에서 Idle·TapBody·Shake를 선택하거나 있는 그룹으로 대체합니다.
필요하면 생성된 `character.json`의 데이터만 수정합니다.

```json
{
  "id": "haru",
  "name": "하루",
  "model": "Haru.model3.json",
  "idleMotion": "Idle",
  "tapMotion": "TapBody",
  "shakeMotion": "TapBody",
  "credit": "캐릭터 권리자 표기"
}
```

기술적으로 필수인 항목은 `model`입니다. 이름은 폴더 이름, 모션 그룹은 Idle·TapBody·Shake가 기본값입니다. 모션이 없으면 빈 문자열을 사용할 수 있습니다.
저작권 표기는 모델 사용 조건에 맞춰 넣습니다. 모델 파일명은 같은 폴더의 `.model3.json` 파일명이어야 합니다.

## 5. R2에 업로드

대시보드에서 버킷의 `models/haru/` 경로를 만들고 준비 폴더의 파일을 **하위 폴더 구조를 유지해서** 올립니다.
최종 객체 키는 `models/haru/character.json`, `models/haru/Haru.model3.json`, `models/haru/textures/…`처럼 되어야 합니다.
`.model-uploads` 자체를 버킷에 올리거나 `models/models/haru/`로 중복 중첩하지 않습니다.

파일이 많으면 Cloudflare의 [rclone 업로드 안내](https://developers.cloudflare.com/r2/examples/rclone/)를 따라 R2 연결을 설정한 뒤 다음처럼 준비 폴더를 복사할 수 있습니다.

```bash
rclone copy .model-uploads/models/haru r2:pocket-live2d-models/models/haru
```

처음에는 데이터 파일들을 모두 올리고 **`character.json`을 마지막으로 올리는 것**이 좋습니다. 업로드 도중 방문자가 미완성 모델을 읽는 일을 줄입니다.
완료 후 `https://pocket-live2d.pages.dev/haru`를 열면 됩니다.
새 캐릭터 `miku`도 같은 방법으로 `models/miku/`만 추가하면 `/miku`에서 열립니다.

같은 파일명으로 기존 모델을 업데이트하고 커스텀 캐시를 사용한다면 해당 R2 객체의 캐시를 갱신합니다. 새 버전 폴더 이름을 쓰는 방법도 있습니다.

## 6. R2 없이 로컬 테스트

`VITE_MODEL_BASE_URL`을 비우고 모델 준비 명령을 실행한 뒤 `npm run dev` 또는 `npm run dev:https`를 실행합니다.
준비 폴더가 `/models/`로 복사되므로 `/haru`를 같은 PC에서 확인할 수 있습니다.
루트 `/`와 기본 캐릭터 별칭 `/mark`는 R2 설정이 없으면 함께 빌드한 데모를 사용합니다.

Pages에 모델을 함께 넣는 방식도 가능하지만 새 파일 추가 때 사이트 전체 배포 결과물을 다시 업로드해야 합니다. 모델만 독립적으로 추가하려면 R2를 사용합니다.
Pages는 최상위 `404.html`이 없으면 SPA 방식으로 경로를 앱에 연결합니다. JS·CSS·Core·셰이더·카메라 파일은 사이트 루트의 절대 경로를 사용합니다.

## 7. 확인 항목

- `/haru`, `/haru/`를 직접 열고 새로고침해도 같은 모델이 표시되는지
- 새 폴더를 R2에 추가한 직후 재배포 없이 새 URL이 열리는지
- 잘못된 경로·없는 캐릭터·잘못된 JSON·CORS 오류가 안내로 표시되는지
- 다른 출처의 텍스처가 WebGL에서 정상 표시되는지
- 캐릭터 경로에서도 카메라·약관·정보·UI 숨기기·8초 복귀가 정상 동작하는지
- 운영 도메인의 CORS와 R2 공개 설정, 모델 사용 권한·표기가 맞는지

현재 구조는 한 사이트가 경로별로 여러 모델을 불러옵니다. 기존의 독립된 단일 모델 사이트와 달라졌으므로 Live2D 확장성 애플리케이션 분류·공개 허가 검토는 [라이선스 문서](LICENSING.md)에 남겨 둡니다.

## 공식 안내

- [R2 공개 버킷](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [R2 업로드](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [Pages SPA 경로 처리](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## 이 저장소의 업로드·검증 명령

[실제 버킷 설정과 업로드 가이드](R2_SETUP.md)에 따라 `R2_BUCKET=pocket-live2d`를 지정하고 `npm run upload:models -- mark`로 직접 업로드할 수 있습니다. `npm run verify:models -- --origin https://pocket-live2d.pages.dev`는 모든 객체의 공개 접근·CORS·Content-Type·SHA-256을 검사합니다.

`VITE_MODEL_BASE_URL`에 접두사 없이 공개 버킷 주소만 넣으면 `characters/<id>/model/` 구조를 사용합니다. 기존처럼 `/models/` 접두사를 넣으면 위 문서의 `models/<id>/` 구조를 사용합니다. 두 방식 모두 `character.json`을 모델과 같은 폴더에 둡니다. R2를 설정한 빌드는 로컬 모델을 Pages에 포함하지 않으며, 웹 앱·SDK·카메라 파일은 기존대로 포함합니다.
