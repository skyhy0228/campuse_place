# 교통대 꿀팁 모음

국립한국교통대학교 충주캠퍼스 학생들이 직접 모은 맛집, 숨은 장소, 생활 꿀팁, 자유 정보를 검색하고 열람하는 웹사이트입니다. 랜딩 페이지 없이 첫 화면에서 바로 목록과 검색을 쓸 수 있습니다.

화면은 GitHub Pages(정적 사이트)에서 제공합니다. 회원·즐겨찾기 동기화·후기·제보는 **Supabase**를 백엔드로 씁니다. Supabase 키가 없으면 이 기능들은 이전처럼 브라우저 안에서만 동작합니다 (localStorage 계정, GitHub 이슈 제보).

- 배포 주소: https://skyhy0228.github.io/campuse_place/
- 저장소: https://github.com/skyhy0228/campuse_place

## 팀원 작업 통합

같은 수업 원본에서 출발한 팀원 세 명의 프로젝트를 이 저장소에 합쳤습니다. 장소 목록은 우리 `places.json`(원본 XLSX)을 기준으로 두고, 팀원 데이터는 **같은 장소에 필드로 덧붙였습니다.** 팀원 코드는 vanilla JS라 React/TS로 다시 구현했습니다.

| 팀원 프로젝트 | 가져온 것 | 위치 |
|---|---|---|
| [ut-campus-tips](https://github.com/Bellhyuk05/ut-campus-tips) (교통대 꿀팁 지도) | OSM 캠퍼스 지도(SVG), 건물 37개, 층별 안내, 강의실 검색, 학생 추천 동선 4개, 버스 정류장 | `src/components/CampusMap.tsx`, `src/lib/campus.ts`, `public/campus/campus.svg` |
| [knut-campus-guide](https://github.com/liuzhiyuan011215-cmyk/knut-campus-guide) (KNUT 캠퍼스 가이드) | 중국어(유학생) 모드: 장소 이름·주소·메뉴·영업시간·비고 번역 173곳, 유학생 생활 꿀팁 5개, 유학생 추천 표시 | `src/lib/i18n.tsx`, `place.zh` / `place.intl` |
| [gyotong-yeojido](https://github.com/yufe9/gyotong-yeojido) (교통여지도) | 디자인(Liquid Glass·삿포로 테마), 음식 종류 분류와 AI 예시 사진, 구역·별점·혼밥·휴무일·거리, **네이버 리뷰 키워드와 건수**, 정리된 설명, Supabase 커뮤니티 기능의 구조 | `src/styles.css`, `scripts/lib/food.mjs`, `public/images/food/`, `supabase/schema.sql` |

- 팀원 원본은 `data/teams/`에 그대로 보관합니다. 다시 가져오려면 세 저장소를 한 폴더에 clone한 뒤 `npm run teams -- <폴더>`를 실행합니다. 팀원 코드는 실행하지 않고 데이터 파일만 텍스트로 읽습니다.
- 연결 규칙(`scripts/lib/teams.mjs`):
  - 정규화한 이름(공백·괄호·지점 표기·학교 이름 제거)이 같은 장소끼리 연결합니다.
  - 주소는 같은 건물의 다른 가게를 잘못 잇는 경우가 있어 연결에 쓰지 않습니다.
  - 이름이 다른 같은 장소는 `data/team-aliases.json`에 등록합니다.
  - 연결하지 못한 항목은 변환 보고서에만 나오고 목록에 추가하지 않습니다 (중복 방지).
- 가져오지 않은 것:
  - 자취방 시세(민간 매물을 다시 게시하는 문제)
  - 카카오맵(이 프로젝트는 네이버 지도)
  - 네이버 플레이스 사진(knut)
  - 학번+이름 로그인(교통여지도). 비밀번호가 없어 다른 사람이 대신 들어갈 수 있기 때문입니다.
- 교통여지도의 설명과 리뷰 키워드는 네이버 리뷰를 바탕으로 정리된 내용이라, 화면에 "네이버 플레이스 리뷰 키워드 (교통여지도 정리)"라고 출처를 붙입니다.

## 주요 기능

**찾기**
- 통합 검색: 이름, 위치, 분류, 대표메뉴, 설명, 음식 종류, 리뷰 키워드, **중국어 번역**까지 검색합니다.
  - 공백으로 나눈 단어는 모두 포함해야 결과에 나옵니다.
  - **초성 검색**(`ㄱㅌㄷ`)을 지원합니다.
- 분류 칩(맛집 / 카페 / 교내 시설 / 숨은 장소 / 생활 꿀팁 / 유학생 꿀팁 / 관광지 / 자유 정보)
- **음식 종류 칩**(짬뽕·짜장, 국밥·찌개, 부리또·바비큐 …)과 **구역**(교통대 앞 / 시내 / 교외)
- 정렬: 추천수·별점·이름·확인한날
- 추가 필터: **지금 영업 중**(한국 시간 기준), **유학생 추천**, **교내/교외**, **가격**(표기된 최저가 구간)
- **강의실 찾기**: `테크노관 213`, `E5-213`을 입력하면 건물과 층, 그 층의 학과를 알려 줍니다. 학과 이름으로도 찾을 수 있습니다.
- 검색·필터·화면 상태가 주소(`?q=…&food=…&view=campus`)에 담겨 링크로 공유할 수 있습니다.

**보기**
- 홈: 사진 분류 타일, 추천 많은 곳 캐러셀, 카드 목록
- 상세: 대표 사진, 별점·거리·추천 수, 탭(소개 / 메뉴 / 정보 / 후기)
  - 소개: 한줄설명, 자세한 설명, 네이버 리뷰 키워드, 교통여지도 정리
  - 정보: 위치(부가 설명 분리), 운영시간, 휴무일, 혼밥, 작은 지도
  - `#place=<id>` 주소로 공유할 수 있고, ESC·뒤로 가기로 닫습니다.
- 사진: 실제 사진이 없는 맛집·카페는 음식 종류별 **AI 예시 사진**을 보여주고 "AI 생성 예시 사진" 안내를 붙입니다.
- **네이버 지도**: 주소로 위치가 특정된 곳에 분류 색 핀을 꽂습니다. 같은 건물은 숫자 핀 하나로 묶습니다. 지도 키가 없으면 숨겨집니다.
- **캠퍼스 지도**: 키 없이 항상 동작합니다.
  - 건물 라벨(확대 정도에 따라 숨김), 장소 핀, 버스 정류장
  - 건물을 누르면 층별 안내가 열립니다.
  - 학생 추천 동선을 고르면 경로와 경유지를 그립니다.
- **한국어 / 中文** 전환:
  - 장소 이름은 중국어로 보여주고 한국어 원래 이름을 함께 보여줍니다.
  - "한국어 이름 복사" 버튼이 있습니다.
  - 번역이 없는 곳은 한국어로 보여주고 "暂无中文"이라고 표시합니다.
- 반응형 레이아웃:
  - 휴대폰(640px 미만): 하단 탭바(홈·지도·캠퍼스·즐겨찾기·내 정보), 카드 2열
  - 태블릿: 카드 3열
  - PC(1024px 이상): 왼쪽 유리 사이드바 + 오른쪽 내용, 상세는 오른쪽 패널
- 밝은/어두운 화면: 기기 설정을 따르거나 직접 고릅니다.

**회원 (Supabase 연결 시)**
- 이메일 + 비밀번호 가입(메일 인증), 로그인, 비밀번호 재설정 메일, 닉네임 변경, 탈퇴
- 즐겨찾기와 **내 목록**이 계정에 저장되어 기기 사이에 동기화됩니다. 로그인 전 즐겨찾기는 가입할 때 가져올 수 있습니다.
- **별점과 한줄 후기**:
  - 장소의 기본 별점(교통여지도)을 한 표로 치고, 평가한 사람이 3명 이상이면 회원 별점과 합칩니다.
  - 금칙어를 차단하고, 서로 다른 3명이 신고하면 자동으로 숨깁니다.
- **제보**(새 장소 / 정보가 달라요):
  - 사진은 3장까지 보낼 수 있습니다. 브라우저에서 긴 변 1600px의 webp로 다시 그리므로 촬영 위치 같은 EXIF 정보가 남지 않습니다.
  - 내 위치를 넣을 수 있습니다.
  - 이메일·전화번호는 막고, 1분에 한 번만 보낼 수 있습니다.
- **관리자 화면**(`?view=admin`, 운영자만):
  - 제보 대기 / 승인 / 거절. '수정 후 승인'을 할 수 있고, 거절하면 사진도 지웁니다.
  - 후기 숨기기·지우기(신고 많은 순), 회원 글쓰기 정지
- 승인된 새 장소는 목록·지도에 "회원 제보" 배지를 달고 나타납니다. '정보가 달라요' 제보는 운영자가 확인한 뒤 원본 XLSX를 고쳐 반영합니다.

**Supabase 없이 (키가 없을 때)**
- 계정은 이 브라우저의 localStorage에만 저장됩니다.
  - 비밀번호와 질문 답변은 PBKDF2-SHA256(21만 회)으로 해시합니다.
  - 비밀번호 찾기는 질문에 답해서 새 비밀번호를 정하는 방식입니다.
- 제보는 GitHub 이슈 작성 화면으로 열리고, `issue-log.yml`이 `이슈.txt`에 기록합니다.

**설치형 웹앱(PWA)**: 홈 화면에 추가할 수 있고, 한 번 열어본 화면은 오프라인에서도 열립니다.

## 사용 데이터

기준 데이터는 [`data/recommendations_normalized.xlsx`](data/recommendations_normalized.xlsx)의 `정규화데이터` 시트입니다.
- 317개 항목, 컬럼 11개, 추천수 합계 439
- 여러 학생이 1주차에 제출한 원본을 정규화한 결과입니다.

**원본 XLSX는 수정하지 않고**, 사이트용 정리는 변환 단계(`scripts/lib/derive.mjs`)에서 합니다. 여기에 knut 유학생 꿀팁 5개가 더해져 사이트에는 322곳이 보입니다.

### 원본을 임의로 보완하지 않습니다
- 빈 셀을 추측으로 채우지 않습니다. 값이 없는 항목은 화면에서 숨깁니다.
- 팀원 데이터(구역, 별점, 리뷰 키워드, 번역 등)는 원본 칸을 덮어쓰지 않고 별도 필드로 보여줍니다.
- 지도 링크는 네이버 지도(`naver.me`, `map.naver.com`)만 사용합니다.

### 변환 때 하는 정리 (모두 `npm run data` 출력에 건수가 보고됨)
| 정리 | 내용 |
|---|---|
| 이름 | `3_생활꿀팁_동아리 신청` → `동아리 신청` 처럼 폴더명 접두어 제거. 항목 ID와 즐겨찾기는 **원본 이름 기준**이라 영향이 없음 |
| 한줄설명 | 자동 생성 문구는 숨기고 원본 자세한 설명의 첫 문장으로 대신함 |
| 대표메뉴 | 다른 메뉴에 포함되는 조각과 중복 제거 |
| 확인한날 | `26-10-06` → `2026-10-06`. 날짜가 없으면 정렬에서 뒤로 |
| 위치 | `주소 \| 부가 설명`을 주소와 설명으로 분리 |
| 교내/교외 | 위치 문자열만으로 판단. 근거가 없으면 분류하지 않음 |
| 가격 구간 | 표기된 금액 중 최저가 기준 |
| 지도 좌표 | `data/place-coordinates.json`에서 가져옴. 학교 대표 주소(대학로 50)로만 변환된 곳은 핀을 만들지 않음. 우리 좌표가 없으면 교통여지도 좌표로 보충 |
| 운영시간 | 요일과 시간이 모두 명확한 경우만 해석해 '지금 영업 중'에 사용 |
| 팀원 데이터 | 교통여지도 94곳, knut 173곳, 캠퍼스 지도 위치 148곳 연결. 리뷰 키워드는 설명 문장의 `"키워드"(N건)` 형식에서 꺼냄 |
| 음식 종류 | 교통여지도 규칙(이름·메뉴 낱말)으로 맛집·카페를 20종류로 분류하고 예시 사진을 고름 |
| 캠퍼스 좌표 | 건물 코드가 있으면 건물 위치, 아니면 위도·경도를 ut 지도와 같은 식으로 투영 |

## 기술 스택

- 화면: React 18, TypeScript, Vite 5, 일반 CSS, Lucide React, Pretendard(가변 글꼴, 저장소에서 함께 배포)
- 지도: 네이버 지도 JavaScript API v3, Leaflet 1.9(캠퍼스 지도)
- 백엔드: Supabase(Auth·Postgres·RLS·Storage, `@supabase/supabase-js`)
- 스크립트: SheetJS(`xlsx`, 변환 스크립트 전용), sharp(이미지 스크립트 전용)
- 테스트: Playwright(`playwright-core`), axe-core
- 배포: GitHub Actions + GitHub Pages

## 설치와 실행

Node.js 22 이상이 필요합니다. 단위 테스트가 TypeScript 파일을 바로 불러오기 때문입니다.

```powershell
npm install
npm run dev          # 개발 서버 (http://localhost:5173/campuse_place/)
npm run build        # 데이터 변환 → 타입 검사 → 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기 (http://localhost:4173/campuse_place/)
npm run typecheck    # 타입 검사만
```

로컬 설정은 `.env.local`에 씁니다 (커밋하지 않음).

```dotenv
VITE_NAVER_MAP_CLIENT_ID=      # 네이버 지도 Client ID (없으면 지도 숨김)
VITE_SUPABASE_URL=             # https://<프로젝트>.supabase.co (없으면 Supabase 기능 끔)
VITE_SUPABASE_PUBLISHABLE_KEY= # sb_publishable_… (공개용 키)
```

### 네이버 지도 키

지도는 [네이버 클라우드 플랫폼](https://console.ncloud.com) Maps의 **Client ID**가 있어야 표시됩니다.

1. 콘솔 → Maps → Application 등록에서 **Dynamic Map**을 선택합니다.
2. Web 서비스 URL에 다음 주소를 등록합니다.
   - `https://skyhy0228.github.io`
   - 개발용 `http://localhost:5173`, `http://localhost:4173`
3. 배포: 저장소 Settings → Secrets and variables → Actions → **Variables**에 `VITE_NAVER_MAP_CLIENT_ID`를 등록합니다.

### Supabase 설정 (처음 한 번)

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. **SQL Editor → New query**에 [`supabase/schema.sql`](supabase/schema.sql)을 **전부** 붙여 넣고 Run합니다. 다시 실행해도 안전합니다. 만들어지는 것은 다음과 같습니다.
   - 테이블: 프로필, 즐겨찾기, 후기, 신고, 제보, 금칙어
   - RLS 정책, 서버 함수, 사진 보관함 `place-photos`
3. 사이트에서 운영자로 쓸 계정을 가입합니다. 그런 다음 SQL Editor에서 아래를 **내 이메일로 바꿔** 한 번 실행합니다. 이메일은 저장소 파일에 쓰지 않습니다.
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = '내이메일@example.com'
   on conflict do nothing;
   ```
4. **Authentication → URL Configuration**에 주소를 등록합니다.
   - Site URL: `https://skyhy0228.github.io/campuse_place/`
   - Redirect URLs: 위 주소, `http://localhost:5173/campuse_place/`, `http://localhost:4173/campuse_place/`
   - 인증 메일과 비밀번호 재설정 메일의 링크가 이 주소로 돌아옵니다.
5. **Project Settings → API Keys**에서 Project URL과 **publishable** 키를 복사합니다.
   - 로컬: `.env.local`에 넣습니다.
   - 배포: GitHub Actions **Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`로 등록합니다.

**보안 안내**
- publishable 키와 URL은 브라우저에 공개되는 값이고, 보호는 RLS와 서버 함수가 합니다.
- **`secret` / `service_role` 키는 어디에도 넣지 마세요.**
- Supabase 기본 메일 발송은 시간당 몇 통으로 제한됩니다. 회원이 많아지면 Authentication → SMTP 설정에서 메일 서버를 연결하세요.

## 테스트

```powershell
npm run test:unit    # 데이터 정리 규칙, 팀원 데이터 연결·리뷰 키워드·음식 분류·캠퍼스 투영, 강의실 검색
npm run build:e2e    # 테스트용 빌드: dist(가짜 지도 키) + dist-cloud(가짜 Supabase 주소)
npm run test:e2e     # 브라우저 테스트(Chrome)
npm test             # 위 세 가지를 차례로
```

브라우저 테스트가 확인하는 것:
- 검색, 필터, 상세, 네이버 지도, 로컬 계정, 접근성(axe), PWA
- 팀원 기능: 중국어 모드, 캠퍼스 지도, 강의실 검색, 리뷰 키워드
- Supabase 흐름

참고:
- 네이버 지도 스크립트와 Supabase 서버는 가짜로 바꿔 끼워, 실제 키·네트워크 없이 화면 동작과 보내는 요청을 확인합니다 (`tests/e2e/helpers.mjs`, `tests/e2e/cloud.test.mjs`). 그래서 **실제 Supabase의 RLS·함수는 자동 테스트하지 않습니다.** 프로젝트를 만든 뒤 가입 → 후기 → 제보 → 관리자 승인을 한 번 직접 확인하세요.
- 접근성 테스트는 axe-core(WCAG 2.1 A/AA + 모범 사례, 색 대비 포함)를 실행합니다. 대상은 밝은/어두운 화면의 목록·상세·중국어 화면·캠퍼스 지도·계정 화면입니다.
- GitHub Actions는 `main`에 push할 때마다 테스트를 통과해야 배포합니다.

## 데이터 변환

```powershell
npm run data                               # XLSX + data/teams/*.json → public/data/places.json, campus.json
node scripts/convert-data.mjs --verbose    # 해석하지 못한 운영시간·날짜, 연결하지 못한 ut 항목까지 출력
npm run teams -- <팀원 저장소 clone 폴더>   # 팀원 데이터·캠퍼스 지도·음식 사진 다시 가져오기
```

`npm run build`의 `prebuild`에서 자동 실행됩니다.

## 이미지

- 장소 실제 사진:
  - `public/images/places/`(WebP, 최대 폭 960px)에 있고, 연결 정보는 `data/place-images.json`에 있습니다.
  - `npm run images`로 다시 만들고 `npm run data`로 반영합니다.
- 음식 예시 사진:
  - `public/images/food/`(교통여지도 팀원이 Gemini로 생성)에 있습니다. 출처는 `public/images/food/CREDITS.md`에 있습니다.
  - 실제 가게 메뉴 사진이 아닙니다.

## 이슈 접수 (`이슈.txt`)

Supabase를 연결하지 않았을 때 제보는 GitHub 이슈로 받습니다.
1. `.github/ISSUE_TEMPLATE/` 양식이 열립니다.
2. 이슈가 열리면 `issue-log.yml`이 `이슈.txt`에 기록합니다.

## GitHub Pages 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 단위·브라우저 테스트를 돌린 뒤 빌드해 Pages에 배포합니다.

- 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
- Vite `base`는 `/campuse_place/`입니다. 다른 경로에 배포할 때는 다음을 바꿉니다.
  - `VITE_BASE` 환경 변수
  - `src/config.ts`의 `SITE_URL`
  - `index.html`의 OG 주소
  - Supabase Redirect URL
- 서비스 워커(`public/sw.js`): 페이지와 데이터는 네트워크 우선, 빌드 파일·이미지는 저장본 우선입니다.

## 라이선스와 출처

- 캠퍼스 지도 데이터: © OpenStreetMap contributors (ODbL). 화면과 지도 오른쪽 아래에 표시하며, 지우지 않습니다.
- 층별 안내: 국립한국교통대학교 홈페이지 캠퍼스지도(ut 팀원 정리, 2026-10-20 확인)
- 글꼴: Pretendard (SIL OFL 1.1)
- 지도 라이브러리: Leaflet (BSD-2-Clause)
- 음식 예시 사진: 교통여지도 팀원 Gemini 생성 (`public/images/food/CREDITS.md`)

## 폴더 구조

```text
campuse_place/
├─ .github/workflows/        deploy.yml(테스트 → 빌드 → 배포), issue-log.yml
├─ data/
│  ├─ recommendations_normalized.xlsx   기준 데이터 (원본 보존)
│  ├─ teams/                            팀원 원본 데이터 (gyotong, knut, campus, floors)
│  ├─ team-aliases.json                 팀원 데이터 이름 별칭
│  ├─ place-images.json, place-coordinates.json, image-aliases.json
├─ public/
│  ├─ data/places.json, data/campus.json   변환 결과
│  ├─ campus/campus.svg                    캠퍼스 지도 그림 (OSM)
│  ├─ images/places/, images/food/         실제 사진, AI 음식 예시 사진
│  └─ manifest.webmanifest, sw.js
├─ scripts/
│  ├─ convert-data.mjs                     XLSX + 팀원 데이터 → JSON
│  ├─ lib/derive.mjs, lib/teams.mjs, lib/food.mjs
│  ├─ import-teams.mjs, build-e2e-cloud.mjs, sync-images.mjs, make-assets.mjs, log-issue.mjs
├─ supabase/schema.sql                     Supabase 테이블·RLS·함수·보관함
├─ src/
│  ├─ App.tsx, main.tsx, styles.css, types.ts
│  ├─ components/  레이아웃(Controls, HomeTiles, TabBar, SideList, LangToggle), 장소(PlaceCard, PlaceDialog, PopularStrip),
│  │               지도(PlaceMap, PlaceMiniMap, CampusMap, RoomFinder), 회원(CloudAuthDialog, AuthDialog, AccountDialog,
│  │               CollectionPicker, Reviews, SubmitDialog, AdminPage)
│  └─ lib/         places, i18n, campus·campusData, supabase·remote·submissionPlace, session·auth·userData,
│                  naverMap·useNaverMap, cover, photo, hours, choseong, urlState, theme, report, useGlassSheen
└─ tests/
   ├─ unit/        derive, teams, campus, log-issue
   └─ e2e/         site, map, auth, a11y, pwa, teams, cloud (+ helpers)
```
