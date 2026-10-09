# 새 세션 인수인계

작성일: 2026-10-09 (한국 시간). 저장소: `RohJooHoon/Pocket-Live2d`, 작업 브랜치: `main`.
이 문서는 당시 상태를 기록합니다. 작업 전에 최신 `main`과 현재 파일·R2 상태를 확인하세요.

## 현재 상태

- Vue 3 전환 완료. 주요 화면은 `src/App.vue`, 입력·렌더러 연결은 `src/composables/useCharacterStage.ts`.
- 기능 변경 커밋: `6819dab` (`Add quiet playback, direct character taps and zoom guards`). `main`에 푸시 완료.
- 현재까지 요청받은 기능 변경과 himikan 연결은 완료했습니다. 후속 작업은 사용자의 새 요청에 맞춰 진행하세요.

## 반영한 조작 방식

- 하단 버튼: **자동모션 / 기울이기 / 따라하기**. 켜기·끄기 문구 대신 선택 상태를 표시.
- 자동모션은 기본 꺼짐. Idle 모션과 고개·몸 흔들기를 멈추고 호흡·설정된 눈 깜빡임만 유지.
- 자동모션을 켜면 기존 Idle·몸 흔들기 재생. 끄면 평소 자세로 복귀.
- 기울이기·따라하기는 둘 중 하나만 활성화. 자동모션은 별도 토글.
- 반응·표정 버튼 제거. 몸통의 짧은 탭은 반응 모션, 얼굴의 짧은 탭은 표정 순환. 해당 모델 파일이 있어야 작동.
- 드래그로 시선이 따라오는 기능 제거. 긴 누름·드래그·여러 손가락 입력은 탭 반응을 실행하지 않음.
- UI 숨김 시 복구 안내를 4초 표시. 같은 자리를 연속 10초 누르면 UI 복구. Escape로도 복구.
- 더블클릭·더블탭·핀치 확대 방지. 약관 창의 세로 스크롤 유지.

## Cloudflare 연결

```dotenv
VITE_MODEL_BASE_URL=https://pub-108d29ef05ad474597a55db4df55a8bd.r2.dev
R2_BUCKET=pocket-live2d
PAGES_PROJECT=pocket-live2d
CLOUDFLARE_ACCOUNT_ID=17772b57bcc0e685fe3aa60a550cfff0
CHARACTER=mark
```

- 사이트: https://pocket-live2d.pages.dev
- 캐릭터: `/mark`, `/himikan`.
- 현재 공개 R2 주소는 기본 경로만 설정하며, 앱은 `characters/<id>/model/character.json`을 읽습니다.
- 새 캐릭터는 R2 파일만 추가해 연결합니다. 모델 목록을 코드에 추가하거나 Pages를 재배포할 필요가 없습니다.
- API 토큰은 `CLOUDFLARE_API_TOKEN` 환경 바인딩을 확인해 재사용하세요. 값은 출력하거나 채팅·문서에 기록하지 않습니다.
- Pages 배포는 사용자의 로컬 PC에서 진행하기로 했습니다. `docs/LOCAL_DEPLOY.md`와 기존 배포 스크립트를 사용하세요.

## himikan 연결 결과

- 주소: https://pocket-live2d.pages.dev/himikan
- R2 폴더: `characters/himikan/model/`.
- 원래 `Himikan.model3.json`이 한글이 포함된 이전 파일명을 참조했으나, 업로드된 파일명은 영어 이름이었습니다.
- 다음 참조를 실제 업로드된 이름으로 수정했습니다:
  - Moc: `Himikan.moc3`
  - Texture: `Himikan.4096/texture_00.png`
  - DisplayInfo: `Himikan.cdi3.json`
- `character.json`을 R2에 추가했습니다. 이름·ID는 `himikan`, 모델은 `Himikan.model3.json`.
- 업로드된 모델에는 모션·표정 파일이 없습니다. `idleMotion`, `tapMotion`, `shakeMotion`은 빈 문자열이며, 몸통·얼굴 탭 반응은 현재 없습니다.
- 원본 moc3·텍스처·cdi3는 변경하지 않았습니다. 저장소의 로컬 캐릭터 목록에도 추가하지 않았습니다.
- 원본 설정 백업과 업로드한 JSON은 현재 작업 공간의 `.model-uploads/`에 있습니다. Git에서 제외되므로 새 환경에 남아 있다고 가정하지 마세요.

## 검증과 환경

- 코드 변경 시 테스트 119개·타입 검사·SDK 없는 빌드 통과.
- 모바일 UI: 버튼 3개·320px 배치·자동모션 토글·안내 사라짐·10초 복귀·취소·확대 방지·약관 스크롤 확인.
- 공개 Framework 5-r.5와 모의 모델로 얼굴/몸통 분기 및 자동모션·평소 자세 복귀 로직 확인. 이 검사는 실제 Core 렌더링 검사가 아닙니다.
- himikan 연결 후 실제 배포 페이지의 Core·모델·텍스처로 렌더러 준비 완료와 캐릭터 표시 확인. 모델 요청 200, CORS 정상, 페이지 오류 없음.
- 클라우드에는 라이선스가 필요한 Cubism SDK가 준비되어 있지 않습니다. 사용자는 로컬 SDK for Web **5-r.5**로 배포합니다.
- Node.js 24 / Python 3 사용. 필요한 경우 `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`.
- Node 네트워크 검증은 기존 HTTP(S) 프록시를 사용합니다. 필요한 스크립트는 `node:http`의 `setGlobalProxyFromEnv()`를 사용하고 TLS 검증을 유지합니다.
- 클라우드 환경 초기 설정을 다시 해야 하면 `cloud-environment-onboarding:setup` 스킬을 사용하세요. 기존 체크아웃을 사용하고 사용자 파일·비밀 값·네트워크 설정을 보존하세요.
