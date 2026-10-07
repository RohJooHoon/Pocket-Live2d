# Cubism SDK for Web 설정

이 저장소에는 Live2D Cubism SDK를 넣지 않습니다. 각자 공식 사이트에서 받아 로컬에만 준비합니다.

## 1. 받기

- 다운로드: https://www.live2d.com/download/cubism-sdk/download-web/
- **Cubism SDK for Web 5-r.5**를 받습니다. 라이선스 동의 후 받을 수 있습니다.
- **Native SDK(CubismSdkForNative)는 웹에서 쓰지 않습니다.** 준비 스크립트에 Native SDK를 넣으면 안내 문구와 함께 거부합니다.

## 2. 어디에 두나

압축을 푼 폴더는 어디에 둬도 됩니다. 예: `~/Downloads/CubismSdkForWeb-5-r.5`

폴더 안에 `Core/`, `Framework/`, `Samples/`가 바로 보여야 합니다.

저장소 폴더 안에 풀어도 `CubismSdkForWeb-*/`는 git에 올라가지 않도록 막혀 있습니다.

## 3. 준비 스크립트 실행

```bash
python3 tool/prepare_cubism_web.py ~/Downloads/CubismSdkForWeb-5-r.5
```

스크립트가 필요한 파일만 `vendor/cubism/`에 복사합니다.

| 원본 | 복사 위치 | 용도 |
|---|---|---|
| `Core/live2dcubismcore.min.js` | `vendor/cubism/Core/` | 브라우저에서 모델을 읽는 엔진. 빌드 결과물에 포함됨 |
| `Core/live2dcubismcore.d.ts` | `vendor/cubism/Core/` | 타입 정의 |
| `Framework/src/` | `vendor/cubism/Framework/src/` | 모델 로딩, 모션, 물리, 렌더링 |
| `Framework/Shaders/WebGL/` | `vendor/cubism/Framework/Shaders/` | 실행 중에 내려받는 셰이더. 빌드 결과물에 포함됨 |
| `Framework/tsconfig.json` | `vendor/cubism/Framework/` | Framework를 공식 샘플과 같은 설정(ES6 클래스 필드)으로 컴파일하기 위해 필요 |

`vendor/`는 `.gitignore` 대상입니다. **커밋하거나 공개 저장소·공개 CI에 올리면 안 됩니다** (Core 약관 6.2).

## 4. 확인

```bash
npm run typecheck:sdk   # SDK 렌더러까지 타입 검사
npm run dev             # 캐릭터가 보이면 성공
```

SDK가 준비되면 `npm run dev`와 `npm run build`가 자동으로 다음을 처리합니다.
- Core 스크립트를 페이지에 넣습니다.
- 셰이더를 함께 배포합니다.

SDK가 없으면 같은 명령이 "Live2D SDK가 연결되지 않은 빌드예요" 안내만 보여 주는 페이지를 만듭니다.

## 동작 방식

```text
index.html  ── <script> cubism/live2dcubismcore.min.js   (SDK가 있을 때만 들어감)
   └─ main.ts ── @cubism-adapter
                  ├─ SDK 없음 → live2d/unavailable.ts     (안내 문구)
                  └─ SDK 있음 → live2d/cubism/adapter.ts
                                 └─ Core 확인 후 cubismRenderer.ts를 별도 파일로 불러옴
```

- Cubism Framework는 불러오는 순간 Core를 참조합니다. 그래서 Core가 실제로 로드된 것을 확인한 뒤에만 Framework를 불러옵니다.
- 그 덕분에 Core 파일이 빠지거나 로드에 실패해도 페이지는 멈추지 않고 안내 문구를 보여 줍니다.
- 모델 파일(moc3)은 Core의 무결성 검사를 거친 뒤에 읽습니다.

## SDK 버전을 바꿀 때

이 프로젝트는 5-r.5 Framework API에 맞춰 작성했습니다. 예를 들어 업데이트 스케줄러, 실행 중 셰이더 로딩, 오프스크린 매니저가 5-r.5 기준입니다.

다른 버전을 쓰려면 다음 순서로 확인합니다.
1. `npm run typecheck:sdk`로 API 차이를 확인합니다.
2. [웹 테스트 가이드](WEB_TESTING.md)의 표시 항목을 다시 검증합니다.
