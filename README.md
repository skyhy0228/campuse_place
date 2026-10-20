# 교통대 꿀팁 모음

국립한국교통대학교 충주캠퍼스 학생들이 직접 모은 맛집, 숨은 장소, 생활 꿀팁, 자유 정보를 검색하고 열람하는 정적 웹사이트입니다. 랜딩 페이지 없이 첫 화면에서 바로 목록과 검색을 쓸 수 있습니다.

- 배포 주소: https://skyhy0228.github.io/campuse_place/
- 저장소: https://github.com/skyhy0228/campuse_place

## 주요 기능

- 통합 검색: 이름, 위치, 분류, 대표메뉴, 한줄설명, 자세한 설명을 한 번에 검색 (공백으로 나눈 단어는 모두 포함된 항목만 표시, 한글 입력 중에도 즉시 반영)
- 분류 필터: 맛집 / 카페 / 교내 시설 / 숨은 장소 / 생활 꿀팁 / 관광지 / 자유 정보 (항목 수 표시)
- 정렬: 추천수 높은 순, 이름순, 확인한날 최신순 (날짜가 없거나 해석할 수 없는 항목은 뒤로)
- 지도 보기: 주소를 확인한 190곳을 카카오맵에 핀으로 표시 (분류별 색, 핀이 많으면 숫자로 묶음, 같은 좌표의 장소는 한 핀에서 목록으로 선택). 검색·분류·즐겨찾기 필터가 지도에도 그대로 적용됩니다.
- 즐겨찾기: 브라우저 `localStorage`에 저장, 즐겨찾기만 보기
- 상세 보기: 위치, 운영시간, 가격대, 대표메뉴, 설명, 사진, 네이버 지도 링크. ESC·닫기 버튼·뒤로 가기로 닫기, 주소 해시(`#place=<id>`)로 특정 항목 링크 공유
- 공유: Web Share API를 지원하면 공유 시트, 아니면 링크 복사
- 데이터 로딩 실패, 검색 결과 없음, 이미지 로딩 실패 상태 처리
- 모바일(390px)·태블릿·데스크톱 대응, 키보드 탐색과 스크린 리더 라벨 지원

## 사용 데이터

기준 데이터는 [`data/recommendations_normalized.xlsx`](data/recommendations_normalized.xlsx)의 `정규화데이터` 시트입니다. 여러 학생이 1주차에 제출한 원본을 정규화한 결과이며, 정규화 규칙은 원본 프로젝트의 `이호열_설명서.txt`에 정리되어 있습니다.

- 현재 317개 항목, 컬럼 11개 (이름, 위치, 지도, 분류, 확인한날, 운영시간, 가격대, 대표메뉴, 한줄설명, 자세한 설명, 추천수)
- 추천수 합계 439

### 원본을 임의로 보완하지 않습니다

- 빈 셀을 추측으로 채우지 않고, 운영시간·가격·메뉴·주소를 외부에서 가져와 보충하지 않습니다. 값이 없는 항목은 화면에서 숨깁니다.
- 위치가 `없음`인 항목(생활 꿀팁 등)은 위치를 표시하지 않습니다.
- 지도 링크는 네이버 지도(`naver.me`, `map.naver.com`) 주소만 사용합니다. 한 칸에 여러 링크가 `|`로 묶여 있으면 하나만 고르고(`naver.me` 우선), 링크 끝에 붙은 `\`, `(` 같은 잘못된 문자는 제거합니다.
- 확인한날은 완전한 날짜(`YYYY-MM-DD`)만 정렬에 사용합니다. `2026-10`처럼 연월만 있으면 그대로 표시하고 해당 월의 1일로 정렬합니다. `26-10-06`처럼 연도가 두 자리인 값은 해석하지 않고 원본 그대로 표시하며 정렬에서는 뒤로 보냅니다.
- 항목 이름과 내용은 원본 그대로입니다 (예: `3_생활꿀팁_동아리 신청`처럼 원본 이름에 폴더명이 섞인 항목도 수정하지 않았습니다).

## 기술 스택

React 18, TypeScript, Vite 5, 일반 CSS, Lucide React, 카카오맵 JavaScript SDK, SheetJS(`xlsx`, 변환 스크립트 전용), sharp(이미지 리사이즈, 로컬 스크립트 전용), GitHub Actions + GitHub Pages

## 설치와 실행

Node.js 20 이상을 권장합니다 (18에서도 동작 확인).

```powershell
npm install
npm run dev        # 개발 서버 (http://localhost:5173/campuse_place/)
npm run build      # 데이터 변환 → 타입 검사 → 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기 (http://localhost:4173/campuse_place/)
npm run typecheck  # 타입 검사만
```

## 데이터 변환

브라우저가 XLSX를 직접 읽지 않고, 빌드 전에 JSON으로 변환합니다.

```powershell
npm run data       # data/recommendations_normalized.xlsx → public/data/places.json
```

`npm run build`의 `prebuild`에서 자동 실행되므로 XLSX만 교체하고 빌드해도 반영됩니다. 변환 스크립트는 시트와 컬럼을 확인하고, XLSX 행 수와 JSON 항목 수가 같은지 검증합니다. 재실행해도 결과가 같습니다.

데이터를 갱신하려면:

1. 새 XLSX를 `data/recommendations_normalized.xlsx`로 교체 (시트 이름 `정규화데이터`, 컬럼 이름 유지)
2. `npm run data`
3. 변경된 `public/data/places.json`을 커밋하고 push

## 지도(카카오맵) 설정

`.env.example`을 `.env.local`로 복사해 키를 채웁니다 (`.env.local`은 커밋되지 않습니다).

| 변수 | 용도 |
|---|---|
| `KAKAO_REST_KEY` | 주소 → 좌표 변환 스크립트 전용 비밀 값. 사이트에는 포함되지 않음 |
| `VITE_KAKAO_MAP_JS_KEY` | 지도 표시용 JavaScript 키. 이 값이 없으면 지도 보기 버튼이 숨겨짐 |

- 카카오 개발자 콘솔에서 **카카오맵 사용 설정을 ON**으로 하고, JavaScript SDK 도메인에 `http://localhost:5173`, `https://skyhy0228.github.io`를 등록해야 합니다.
- GitHub Pages 배포에는 저장소 Settings → Secrets and variables → Actions → **Variables**에 `VITE_KAKAO_MAP_JS_KEY`를 추가합니다.

```powershell
npm run geocode   # 주소 → 좌표 변환 (data/place-coordinates.json). 이미 변환된 항목은 건너뜀
npm run data      # places.json 에 좌표 반영
```

- 건물 이름·층수만 있거나 설명문인 위치(48곳)는 주소가 아니므로 변환하지 않고, 사유는 `data/place-coordinates-unresolved.json`에 기록합니다. 좌표를 추측해서 넣지 않습니다.

## 이미지 갱신

사진은 `public/images/places/`에 웹용(최대 폭 960px, WebP)으로 들어 있고, 연결 정보는 `data/place-images.json`에 있습니다.

```powershell
npm run images                      # 기본 원본 폴더에서 다시 연결·변환
npm run images -- "D:\photos"       # 다른 폴더를 지정할 수도 있음
npm run data                        # places.json에 반영
npm run data:all                    # 위 두 단계를 한 번에
```

- 파일 이름이 `<장소 이름>_<번호>.jpg` 형식이고, 장소 이름이 XLSX의 `이름`과 (공백·기호·대소문자를 무시하고) 정확히 같을 때만 연결합니다. 불확실하면 연결하지 않습니다.
- 장소당 최대 2장, 같은 사진은 한 번만 사용합니다.
- 원본 이미지는 수정하지 않고 리사이즈한 복사본만 만듭니다.
- 이 스크립트는 로컬의 원본 프로젝트 경로(`F:\vibecoding\campus-place-recommender-draft`)를 기본값으로 쓰기 때문에 GitHub Actions에서는 실행되지 않습니다. 생성된 이미지는 저장소에 커밋되어 있습니다.

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 `npm ci` → `npm run build` → Pages 배포를 수행합니다.

- 저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
- Vite `base`가 `/campuse_place/`로 설정되어 있고, 데이터·이미지는 모두 `import.meta.env.BASE_URL` 기준으로 불러옵니다. 다른 경로에 배포할 때는 `VITE_BASE` 환경 변수로 바꿉니다.
- 화면이 하나뿐이고 상세 보기는 주소 해시를 사용하므로 새로고침해도 404가 나지 않습니다.

## 폴더 구조

```text
campuse_place/
├─ .github/workflows/deploy.yml   Pages 배포 워크플로
├─ data/
│  ├─ recommendations_normalized.xlsx   기준 데이터 (원본 보존)
│  ├─ place-images.json                 장소 이름 → 이미지 경로
│  ├─ place-coordinates.json            장소 이름 → 좌표 (카카오 주소 검색 결과)
│  └─ place-coordinates-unresolved.json 좌표를 만들지 않은 항목과 사유
├─ public/
│  ├─ data/places.json                  변환 결과 (사이트가 불러옴)
│  ├─ images/places/                    웹용 사진
│  └─ favicon.svg
├─ scripts/
│  ├─ convert-data.mjs                  XLSX → JSON
│  ├─ sync-images.mjs                   사진 연결·리사이즈
│  ├─ geocode.mjs, load-env.mjs         주소 → 좌표 변환
│  └─ place-id.mjs                      이름 기반 항목 ID
└─ src/
   ├─ App.tsx, main.tsx, styles.css, types.ts
   ├─ components/                       PlaceCard, PlaceDialog, PlaceImage, PlaceMap
   └─ lib/                              places(검색·정렬·분류), favorites, kakao(SDK 로더)
```
