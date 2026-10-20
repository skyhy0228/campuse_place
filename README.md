# 교통대 꿀팁 모음

국립한국교통대학교 충주캠퍼스 학생들이 직접 모은 맛집, 숨은 장소, 생활 꿀팁, 자유 정보를 검색하고 열람하는 정적 웹사이트입니다. 랜딩 페이지 없이 첫 화면에서 바로 목록과 검색을 쓸 수 있습니다.

- 배포 주소: https://skyhy0228.github.io/campuse_place/
- 저장소: https://github.com/skyhy0228/campuse_place

## 주요 기능

**찾기**
- 통합 검색: 이름, 위치, 분류, 대표메뉴, 한줄설명, 자세한 설명 (공백으로 나눈 단어는 모두 포함, 한글 입력 중 즉시 반영, **초성 검색** `ㄱㅌㄷ`)
- 분류 필터 (맛집 / 카페 / 교내 시설 / 숨은 장소 / 생활 꿀팁 / 관광지 / 자유 정보), 정렬 (추천수·이름·확인한날)
- 추가 필터: **지금 영업 중**(한국 시간 기준), **교내/교외**, **가격**(표기된 최저가 구간)
- **검색·필터 상태가 주소에 담겨** 같은 화면을 링크로 공유할 수 있음
- 첫 화면의 **추천 많은 곳**, 데이터에서 가장 최근 확인한 항목의 **최근 확인** 배지

**보기**
- 상세 보기: 위치(주소와 부가 설명 분리), 운영시간, 가격대, 대표메뉴, 설명, 사진, 네이버 지도 링크. ESC·닫기 버튼·뒤로 가기로 닫기, `#place=<id>` 주소로 공유
- 맛집·카페 카드는 메뉴·가격 중심, 꿀팁·장소 카드는 설명 중심으로 표시
- 밝은/어두운 화면 (기기 설정을 따르거나 직접 선택), 모바일에서 분류 칩을 한 줄로 넘겨 보기

**내 목록 (로그인)**
- 회원가입 / 로그인 / 비밀번호 찾기(가입할 때 정한 질문에 답하면 새 비밀번호 설정)
- 계정별 즐겨찾기와 **내 목록**(원하는 이름으로 만들어 장소 담기, 목록별로 모아보기, 이름 변경·삭제)
- 데이터 내보내기·가져오기, 계정 삭제
- 로그인하지 않아도 즐겨찾기는 쓸 수 있고, 가입할 때 가져올 수 있음
- ⚠️ 계정은 **각 브라우저의 localStorage에만** 저장됩니다. 서버가 없는 정적 사이트라 기기 간 자동 동기화는 되지 않습니다. 비밀번호와 질문 답변은 솔트를 붙여 PBKDF2-SHA256(21만 회)으로 해시해 저장하므로 원문을 보여줄 수 없고, 그래서 비밀번호 찾기는 "알려주기"가 아니라 **재설정**입니다. 같은 기기를 쓰는 사람이 개발자 도구로 저장소를 열어보는 것까지는 막을 수 없으므로 개인 목록을 구분하는 용도로 쓰세요.

**제보와 접수**
- 장소 상세의 **정보가 달라요**, 푸터의 **새 장소·꿀팁 제보하기**가 내용이 채워진 GitHub 이슈 작성 화면을 엽니다 (GitHub 계정 필요, 내용은 공개).
- 이슈가 열리면 GitHub Actions(`issue-log.yml`)가 저장소 루트의 **`이슈.txt`**에 접수 내용을 자동으로 덧붙여 커밋합니다.

**설치형 웹앱(PWA)**: 홈 화면에 추가할 수 있고, 한 번 열어본 화면은 오프라인에서도 열립니다. 링크 공유 시 제목·설명·이미지 미리보기가 표시됩니다.

## 사용 데이터

기준 데이터는 [`data/recommendations_normalized.xlsx`](data/recommendations_normalized.xlsx)의 `정규화데이터` 시트입니다 (317개 항목, 컬럼 11개, 추천수 합계 439). 여러 학생이 1주차에 제출한 원본을 정규화한 결과이며, 정규화 규칙은 원본 프로젝트의 `이호열_설명서.txt`에 있습니다. **원본 XLSX는 수정하지 않고**, 사이트용 정리는 변환 단계(`scripts/lib/derive.mjs`)에서 합니다.

### 원본을 임의로 보완하지 않습니다
- 빈 셀을 추측으로 채우지 않고, 운영시간·가격·메뉴·주소를 외부에서 가져와 보충하지 않습니다. 값이 없는 항목은 화면에서 숨깁니다.
- 지도 링크는 네이버 지도(`naver.me`, `map.naver.com`)만 사용합니다. 한 칸에 여러 링크가 `|`로 묶여 있으면 하나만 고르고(`naver.me` 우선) 끝에 붙은 잘못된 문자는 제거합니다.

### 변환 때 하는 정리 (모두 `npm run data` 출력에 건수가 보고됨)
| 정리 | 내용 |
|---|---|
| 이름 | `3_생활꿀팁_동아리 신청` → `동아리 신청` 처럼 폴더명 접두어 제거, 밑줄은 공백으로. 항목 ID와 즐겨찾기는 **원본 이름 기준**이라 영향이 없음 |
| 한줄설명 | `~에 관한 생활 정보`, `~ 이용에 참고할 수 있는 장소 정보`, `식사 메뉴를 제공하는 식당` 같은 자동 문구는 숨기고, 원본 자세한 설명의 첫 문장으로 대신함(날짜·제목 표시·너무 짧은 조각은 제외). 없으면 비움 |
| 대표메뉴 | 다른 메뉴에 포함되는 조각(`플레이트` ⊂ `밍거스 플레이트`)과 중복 제거 |
| 확인한날 | `26-10-06` → `2026-10-06`. 연월만 있으면 그대로 표시하고 정렬에는 해당 월 1일을 씀. 날짜가 없으면 정렬에서 뒤로 |
| 위치 | `주소 \| 부가 설명`을 주소와 설명으로 분리, `없음`은 비움 |
| 교내/교외 | 위치 문자열만으로 판단(대학로 50·교내·건물 이름 → 교내, 그 외 주소 → 교외). 근거가 없으면 분류하지 않음 |
| 가격 구간 | 표기된 금액 중 최저가 기준 (`무료`, 1만원 미만, 1~2만원, 2만원 이상) |
| 운영시간 | **요일과 시간이 모두 명확한 경우만** 해석해 '지금 영업 중'에 사용(브레이크타임·휴무 요일 포함). 애매하면(요일 없음, `확인 필요`, `영업안하는 날도있음` 등) 판단하지 않음 |

## 기술 스택

React 18, TypeScript, Vite 5, 일반 CSS, Lucide React, SheetJS(`xlsx`, 변환 스크립트 전용), sharp(이미지·아이콘 생성 스크립트 전용), Playwright(`playwright-core`)와 axe-core(테스트), GitHub Actions + GitHub Pages

## 설치와 실행

Node.js 20 이상을 권장합니다 (18에서도 동작 확인).

```powershell
npm install
npm run dev          # 개발 서버 (http://localhost:5173/campuse_place/)
npm run build        # 데이터 변환 → 타입 검사 → 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기 (http://localhost:4173/campuse_place/)
npm run typecheck    # 타입 검사만
```

## 테스트

```powershell
npm run test:unit    # 데이터 정리 규칙, 운영시간 해석, 이슈 기록 스크립트
npm run build
npm run test:e2e     # 브라우저 테스트(Chrome): 검색·필터·상세·계정·접근성(axe)·PWA
npm test             # 위 세 가지를 차례로
```

- 브라우저 테스트는 `dist`를 Vite preview로 띄워 설치된 Chrome으로 접속합니다. 다른 Chrome 경로는 `E2E_CHROME_PATH`, 포트는 `E2E_PORT`로 바꿉니다.
- 접근성 테스트는 axe-core(WCAG 2.1 A/AA + 모범 사례, 색 대비 포함)를 밝은/어두운 화면의 주요 화면에 실행합니다.
- GitHub Actions는 `main`에 push할 때마다 테스트를 통과해야 배포합니다.

## 데이터 변환

브라우저가 XLSX를 직접 읽지 않고, 빌드 전에 JSON으로 변환합니다.

```powershell
npm run data               # data/recommendations_normalized.xlsx → public/data/places.json
node scripts/convert-data.mjs --verbose   # 해석하지 못한 운영시간·날짜 목록까지 출력
```

`npm run build`의 `prebuild`에서 자동 실행됩니다. 변환 스크립트는 시트·컬럼과 행 수(XLSX = JSON)를 검증하고 정리 건수를 보고합니다.

데이터를 갱신하려면: ① 새 XLSX로 교체(시트 이름 `정규화데이터`, 컬럼 이름 유지) ② `npm run data` ③ 변경된 `public/data/places.json` 커밋·push.

## 이미지 갱신

사진은 `public/images/places/`에 웹용(최대 폭 960px, WebP)으로 들어 있고, 연결 정보는 `data/place-images.json`에 있습니다.

```powershell
npm run images                      # 기본 원본 폴더에서 다시 연결·변환
npm run images -- "D:\photos"       # 다른 폴더를 지정할 수도 있음
npm run data                        # places.json에 반영 (npm run data:all 은 두 단계를 한 번에)
```

- 파일 이름이 `<장소 이름>_<번호>.jpg`(번호가 없으면 1번)이고 장소 이름이 XLSX의 `이름`과 (공백·기호·대소문자를 무시하고) 같을 때 연결합니다. 장소당 최대 2장, 같은 사진은 한 번만 씁니다.
- 이름이 달라도 같은 장소임을 **원본 txt의 지도 링크·주소로 확인한 것**은 `data/image-aliases.json`에 `"사진 이름": "XLSX 이름"`으로 등록합니다 (예: `"쇼쿠스시": "쇼쿠스시 충주호암점"`).
- 원본 이미지는 수정하지 않고 리사이즈한 복사본만 만듭니다. 이 스크립트는 로컬의 원본 프로젝트 경로(`F:\vibecoding\campus-place-recommender-draft`)를 기본값으로 쓰므로 Actions에서는 실행되지 않고, 생성된 이미지는 저장소에 커밋되어 있습니다.

## 아이콘·공유 이미지

`npm run assets`가 PWA 아이콘과 링크 공유 이미지(`public/og.png`)를 만듭니다. 디자인을 바꿀 때만 실행하세요.

## 이슈 접수 (`이슈.txt`)

1. 사용자가 사이트에서 제보 버튼을 누르면 `.github/ISSUE_TEMPLATE/`의 양식(`report.yml`, `new-place.yml`)이 열립니다. 장소 이름은 미리 채워집니다.
2. 이슈가 열리면 `.github/workflows/issue-log.yml`이 `scripts/log-issue.mjs`로 번호·제목·작성자·라벨·링크·본문을 `이슈.txt`에 덧붙이고 `main`에 커밋합니다. 같은 번호는 중복 기록하지 않고, 제목·본문은 환경 변수로만 전달해 스크립트 주입을 막습니다.
3. 양식의 라벨(`제보`, `새 장소`)은 저장소에 같은 이름의 라벨을 만들어 두면 자동으로 붙습니다 (없어도 기록은 됩니다).

## GitHub Pages 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 단위·브라우저 테스트를 돌린 뒤 빌드해 Pages에 배포합니다.

- 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
- Vite `base`는 `/campuse_place/`이고, 데이터·이미지는 모두 `import.meta.env.BASE_URL` 기준으로 불러옵니다. 다른 경로에 배포할 때는 `VITE_BASE` 환경 변수와 `src/config.ts`의 `SITE_URL`, `index.html`의 OG 주소를 바꿉니다.
- 화면이 하나뿐이고 상세 보기는 주소 해시, 필터는 쿼리 문자열을 쓰므로 새로고침해도 404가 나지 않습니다.
- 서비스 워커(`public/sw.js`): 페이지와 `places.json`은 네트워크 우선, 빌드 파일·이미지는 저장본 우선이라 새 배포가 바로 반영됩니다.

## 폴더 구조

```text
campuse_place/
├─ .github/
│  ├─ workflows/deploy.yml        테스트 → 빌드 → Pages 배포
│  ├─ workflows/issue-log.yml     이슈 → 이슈.txt 자동 기록
│  └─ ISSUE_TEMPLATE/             제보 양식
├─ data/
│  ├─ recommendations_normalized.xlsx   기준 데이터 (원본 보존)
│  ├─ place-images.json                 장소 이름 → 이미지 경로
│  └─ image-aliases.json                확인된 사진 이름 별칭
├─ public/
│  ├─ data/places.json                  변환 결과 (사이트가 불러옴)
│  ├─ images/places/, icons/, og.png    사진·아이콘·공유 이미지
│  └─ manifest.webmanifest, sw.js       설치형 웹앱
├─ scripts/
│  ├─ convert-data.mjs                  XLSX → JSON (정리 보고 출력)
│  ├─ lib/derive.mjs                    정리·해석 규칙(이름, 요약, 메뉴, 날짜, 교내/교외, 가격, 운영시간)
│  ├─ sync-images.mjs, make-assets.mjs, log-issue.mjs, place-id.mjs
├─ src/
│  ├─ App.tsx, main.tsx, styles.css, types.ts, config.ts
│  ├─ components/   PlaceCard, PlaceDialog, PopularStrip, AuthDialog, AccountDialog, CollectionPicker, ThemeToggle, Modal, PlaceImage
│  └─ lib/          places(검색·필터·정렬), hours, choseong, urlState, auth, userData, session, theme, report
└─ tests/
   ├─ unit/         derive, log-issue
   └─ e2e/          site, auth, a11y, pwa (+ helpers)
```
