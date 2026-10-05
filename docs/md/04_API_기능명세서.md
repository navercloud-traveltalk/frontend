# 여행말 API 기능명세서

> NAVER Cloud Platform 우선 · 외부 최소 · 최소 구성으로 구동

| 문서 버전 | v0.3 (통합본 — 01 아키텍처 · 02 ERD · 03 데이터 테이블 설계서 v0.5 · 05 프론트 기능명세서와 정합) |
|---|---|
| 대상 | 프론트엔드(React)가 호출하는 백엔드 REST API 전체 (프론트 계약: src/api/types.ts) |
| 기준 문서 | 데이터 구조·공통 결정(C-01~C-20)은 03 데이터 테이블 설계서 v0.5가 기준. 이 문서의 경로 표기는 `/api` 접두를 뺀 WAS 기준 |
| 원칙 | ① NCP 서비스로 먼저 해결 ② 없는 것만 외부에서 최소로(난이도 낮은 것) ③ 1주 안에 시연 가능한 최소 구성 |
| 작성자 | jono03 |

**읽는 순서**

- 한눈에: 1장(요약) → 2장(구성도) → 3장(NCP 매핑표)
- 구현: 5장(엔드포인트) → 6장(처리 파이프라인) → 7장(데이터) → 9장(구현 순서)

# 1. 요약

## 1.1 목적

프론트엔드가 mock으로 돌리던 21개 API를 실제 서버로 바꾸기 위한 명세다. 서버는 사진 분석, AI 인터뷰(질문 음성 생성 → 답변 음성 인식), 챕터 작성, 책 엮기, 문체 변경을 처리한다. 가능한 모든 AI·저장·좌표 변환 기능은 NAVER Cloud Platform(NCP) 서비스를 쓰고, NCP에 없는 부분만 오픈소스 라이브러리나 외부 API로 최소한만 채운다.

## 1.2 한 줄 구성

팀 구상도 기준: 사용자 → Public Load Balancer(HTTPS) → Nginx(프론트 화면 제공 + API 전달) → WAS(백엔드: 여행 관리 · AI 연동 · 이야기 생성 · 작업 실행) → Cloud DB for MySQL. WAS는 NAT Gateway를 거쳐 VPC 밖의 NCP 관리형 서비스(CLOVA Studio / Speech Recognition / Voice / OCR, Maps 역지오코딩, Object Storage)를 호출하고, 브라우저는 서명 URL로 Object Storage에 사진을 직접 올린다.

## 1.3 외부에서 가져오는 것 (최소)

| 항목 | 이유 | 난이도 | 필수 여부 |
|---|---|---|---|
| ffmpeg (오픈소스, 서버에 설치) | CLOVA Speech Recognition은 mp3·aac·ac3·ogg·flac·wav만 받는다. 브라우저 녹음(webm/opus, mp4)을 wav 16kHz로 변환해야 한다. | 낮음 (패키지 설치 + 명령 1줄) | 필수 |
| EXIF 파서 라이브러리 (예: Pillow) | 사진의 촬영 시각·GPS 좌표를 읽어 장면을 묶는다. NCP 서비스가 아닌 순수 코드 작업. | 낮음 | 필수 |
| 네이버 검색 API(지역) — Naver Developers | NCP Maps에는 장소명(POI) 검색이 없다. 경기전 같은 장소 이름을 얻으려는 경우에만 사용. 같은 네이버 계정, 키 1개. | 낮음 | 선택 (없으면 주소·간판 글자로 대체) |
| PDF 변환 라이브러리 (예: WeasyPrint) | PDF 내보내기용. 프론트는 현재 시연용이므로 MVP 제외. | 중간 | MVP 제외 |

외부 “서비스(API)”는 선택 항목 1개뿐이다. 나머지는 서버에 설치하는 오픈소스이며 별도 계정·과금이 없다.

# 2. 아키텍처

팀이 만든 아키텍처 구상도(3티어 + Load Balancer + NAT Gateway)를 기준으로 하고, 이 API 명세가 요구하는 보완 사항만 덧붙였다.

## 2.1 구성도

상세 그림은 01 아키텍처 구상도. 요약:

```
사용자(모바일 웹) ──HTTPS──▶ Public Load Balancer (HTTPS 종료)
                                  │ HTTP
                                  ▼
                1티어 Web (Private): Nginx — 프론트 화면 제공, /api → WAS 전달
                                  │ /api
                                  ▼
                2티어 App (Private): WAS — 여행 관리 · AI 연동 · 이야기 생성 · 작업 실행 · ffmpeg
                  ├─ 조회·저장 ──▶ 3티어 DB (Private): Cloud DB for MySQL
                  └─ HTTPS ──▶ NAT Gateway ──▶ [VPC 밖 NCP 관리형 서비스]
                                    ├─ AI: CLOVA Studio · CSR · Voice · OCR · Maps(역지오코딩)
                                    └─ Object Storage (사진 · 음성) ◀── 브라우저가 서명 URL로 직접 업로드·조회
```

## 2.2 구성 요소

| 구성 | 역할 | NCP 서비스 |
|---|---|---|
| 로드밸런서 | HTTPS 종료(인증서), 요청 분산, 상태 확인 | Public Load Balancer |
| Web 티어 | 프론트 정적 파일 제공 + /api 요청을 WAS로 전달. 프론트와 API가 같은 출처가 됨 | Server (Nginx), Private Subnet |
| App 티어(WAS) | REST API, 작업(Job) 실행, 외부 AI 호출, ffmpeg·EXIF 처리. 언어는 자유(예시는 Python/FastAPI) | Server, Private Subnet |
| DB 티어 | 사용자·여행·장면·질문·발화·챕터·작업(03 설계서 14개 테이블, 7장) | Cloud DB for MySQL (Private Subnet) |
| 외부 호출 경로 | WAS가 NCP 관리형 서비스(AI·Object Storage)에 접근 | NAT Gateway |
| 파일 저장 | 사진 원본, 사용자 녹음, 질문 음성(mp3) | Object Storage (S3 호환) |
| 썸네일 | 장면 카드·표지용 축소 이미지 | Cloud Image Optimizer, 또는 WAS에서 Pillow로 축소(MVP) |
| 장소명 | 사진 GPS 좌표 → 주소 | Maps: Reverse Geocoding |
| 음성 → 텍스트 | 답변 녹음 전사(1회 60초까지) | CLOVA Speech Recognition (CSR) |
| 텍스트 → 음성 | 질문 음성 mp3 | CLOVA Voice (TTS Premium) |
| 생성형 AI | 장면 설명(이미지 1장/호출), 질문·챕터·제목·문체 | CLOVA Studio (HyperCLOVA X: HCX-005 / HCX-DASH-002) |
| 글자 읽기(선택) | 간판·메뉴 OCR | CLOVA OCR (General) |

## 2.3 구상도에서 보완이 필요한 점

| # | 내용 | 이유 · 조치 |
|---|---|---|
| 1 | AI 서비스 박스에 Maps(Reverse Geocoding) 추가 | 데이터 설계서 7-1의 “GPS 좌표를 장소명으로 변환”에 필요. 현재 구상도에는 CLOVA Studio · Speech · Voice · OCR만 있음 |
| 2 | “Speech”를 CLOVA Speech Recognition(CSR)으로 명시 | CLOVA Speech(긴 음성)와 CSR(1회 60초)은 다른 서비스. 프론트의 55초 제한은 CSR 기준 |
| 3 | Nginx가 /api 접두로 API를 전달 | 프론트 화면 경로(/books/:id, /trips/new 등)가 API 경로와 같아 같은 출처에서는 /api 접두가 필수. 프론트는 VITE_API_BASE_URL=/api |
| 4 | Object Storage 버킷 CORS에 브라우저 PUT/GET 허용 | 구상도의 “서명 URL로 직접 업로드·조회” 화살표가 동작하려면 필요 |
| 5 | 로드밸런서 → Nginx 구간은 HTTP, 브라우저 → 로드밸런서는 HTTPS | 쿠키 Secure 속성과 리다이렉트를 위해 WAS가 X-Forwarded-Proto 헤더를 신뢰하도록 설정 |
| 6 | 서브넷 구성(LB 전용·NAT 전용 서브넷 등) | NCP VPC의 서브넷 종류 요건은 구현 전에 공식 문서로 확인 |
| 7 | 타임아웃을 계층별로 60초 이상 | 답변 처리(E11)가 전사·질문 생성·음성 합성까지 동기로 최대 20초 안팎 |
| 8 | 요청 크기 제한 | 녹음 업로드(수 MB)가 Nginx 기본 제한(1MB)에 걸리지 않도록 client_max_body_size 상향 |
| 9 | 단일 인스턴스 | 티어별 1대면 단일 장애점. 확장 시에는 DB·작업 상태가 이미 서버 밖(MySQL)이므로 WAS 복제 + 로드밸런서 연결로 확장 가능 |

## 2.4 처리 흐름 (요약)

```
[브라우저] ──사진 PUT(서명 URL)──▶ [Object Storage]
[브라우저] ──HTTPS /api──▶ [LB] ──▶ [Nginx] ──▶ [WAS] ──▶ [MySQL]
                                              ├─ 사진 분석 job : EXIF → 장면 분할 → Reverse Geocoding → (OCR) → HCX-005
                                              ├─ 인터뷰(동기)   : 질문 생성(HCX) + TTS(CLOVA Voice) / 답변 녹음 → ffmpeg → CSR
                                              ├─ 챕터 작성 job  : 장면 재료 정리 → HCX 작성 → 문장별 근거 검증
                                              └─ 책 엮기·문체 job : HCX
```

## 2.5 인증 (쿠키)

로그인이 없다. POST /users가 닉네임을 저장하고 서버가 무작위 토큰을 발급해 HttpOnly 쿠키로 내려준다(속성: HttpOnly, Secure, SameSite=Lax, Path=/). DB에는 토큰의 해시(SHA-256)만 저장한다. 이후 모든 요청은 같은 출처에서 쿠키가 자동으로 따라오며, 서버는 쿠키로 사용자를 찾아 소유자를 확인한다(다른 사용자의 데이터는 404). 쿠키를 잃으면(삭제·다른 브라우저·시크릿 창) 기존 책장은 복구할 수 없다(의도된 정책, 03 설계서 C-03). 쿠키 이름 `yeohaengmal_token`, 유효 180일(접속 때마다 연장)은 ▲ 팀 확인 값이다(C-02).

- 프론트는 쿠키 값을 읽을 수 없으므로(HttpOnly) GET /users/me로 로그인 상태를 확인한다. 쿠키가 없거나 해당 사용자가 없으면 401 → 프론트가 /start로 이동한다.
- 프론트는 요청마다 credentials: include로 쿠키를 함께 보낸다. 같은 출처이므로 CORS 설정은 필요 없다(로컬 개발은 Vite 프록시가 /api를 백엔드로 전달).
- NCP 호출용 키는 WAS 환경 변수에만 두고 프론트에 내려보내지 않는다.

# 3. NCP 서비스 매핑표

프론트 기능별로 어떤 NCP 서비스를 쓰는지와 제한을 정리했다. 제원은 NCP 공식 문서에서 확인했으며, 확인하지 못한 항목은 “확인 필요”로 표시했다.

| 기능 | NCP 서비스 | 호출 | 핵심 제한 · 메모 |
|---|---|---|---|
| 사진 저장 | Object Storage | S3 호환 API (키 발급 후 S3 SDK 사용) | S3와 높은 호환. 사전 서명 URL(브라우저 직접 업로드) 지원 여부는 확인 필요 → 안 되면 대안 A(5장 E05) |
| 사진 좌표→주소 | Maps Reverse Geocoding | GET https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc | 법정동·행정동·도로명 주소 반환. Application의 Client ID/Secret 필요 |
| 사진 설명(장면 한 줄) | CLOVA Studio — HCX-005 (vision) | POST /v3/chat-completions/HCX-005 | 이미지 입력은 HCX-005만 가능, 한 번에 1장. 장면당 대표 1장만 보낸다 |
| 간판·메뉴 읽기 | CLOVA OCR (General) | 도메인별 Invoke URL + X-OCR-SECRET | jpg/png 등, base64 또는 URL. 선택 항목 |
| 질문 생성 · 챕터 · 문체 | CLOVA Studio — HCX-DASH-002 또는 HCX-005 | POST /v3/chat-completions/{모델} | 텍스트 작업은 가벼운 DASH 모델로도 가능(품질 비교 후 선택) |
| 질문 음성(TTS) | CLOVA Voice (TTS Premium) | POST https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts | text 최대 2000자, speaker 지정, mp3 출력. 설정의 “인터뷰어 목소리” = speaker |
| 답변 전사(STT) | CLOVA Speech Recognition (CSR) | POST Speech Recognition REST (lang=Kor) | 1회 최대 60초(프론트 55초 제한과 일치). 입력: mp3·aac·ac3·ogg·flac·wav, 16kHz 이상. webm/mp4는 ffmpeg 변환 필수 |
| 썸네일 | Cloud Image Optimizer | Object Storage 원본에 변환 URL | MVP는 서버 축소로 대체 가능 |
| 데이터 저장 | Cloud DB for MySQL | 표준 MySQL 8.0 | 03 설계서(utf8mb4). 처음부터 MySQL 사용 |
| 서버(Web·App) | Server (VPC) | Ubuntu | Nginx 티어 + WAS 티어. WAS에 ffmpeg 설치, 환경 변수로 키 주입 |

NCP에 대응 서비스가 없는 것: 장소명(POI) 검색, 사진 EXIF 해석, 장면 묶기 알고리즘, 근거 검증 로직. 장소명과 EXIF 해석은 1.3장의 외부 항목(오픈소스·선택 API), 장면 묶기와 근거 검증은 서버 코드로 직접 만든다(6장).

# 4. 공통 규약

| 항목 | 규칙 |
|---|---|
| Base URL | /api (같은 출처). 프론트는 VITE_API_BASE_URL=/api. Nginx가 /api/ 를 WAS로 전달하며 접두를 제거해 WAS는 /users, /trips 등으로 받는다. 이 문서의 경로는 /api 접두를 뺀 WAS 기준이다. |
| 형식 | 요청·응답 JSON(UTF-8). 예외: 답변 녹음 업로드(multipart/form-data), 사진 업로드(Object Storage 직접 PUT) |
| 인증 | 쿠키(서버 발급 HttpOnly 토큰). 요청 헤더에 사용자 ID를 넣지 않는다. 쿠키가 없거나 사용자가 없으면 401(GET /users/me 포함) |
| CORS | 불필요(같은 출처). 예외: Object Storage 버킷에는 프론트 도메인의 PUT/GET 허용 CORS를 설정한다 |
| 시간 | ISO 8601(UTC). 표시용 문자열(dateLabel 등)은 서버가 한국어로 만들어 내려준다 |
| 오류 응답 | HTTP 상태코드 + { "error": { "code": "...", "message": "..." } }. 프론트는 2xx가 아니면 모두 실패 화면(“저장돼 있어요” 안내 + 다시 시도)으로 처리하므로 message는 사용자에게 보이지 않는다 |
| 오류 코드 | INVALID_REQUEST(400, 세부 코드: NICKNAME_EMPTY·NICKNAME_TOO_LONG 등), UNAUTHORIZED(401, 쿠키 없음/없는 사용자), NOT_FOUND(404), CONFLICT(409, 이미 진행 중), RATE_LIMITED(429), UPSTREAM_ERROR(502, NCP 호출 실패), INTERNAL(500) |
| 작업(Job) | 오래 걸리는 처리는 즉시 { jobId }를 돌려주고 GET /jobs/:jobId로 확인한다. 프론트가 2초마다 확인하므로 응답은 가볍게 |
| 멱등성 | 프론트가 새로고침·재시도로 analyze / chapter / finish / restyle을 같은 입력으로 다시 호출할 수 있다. 같은 대상에 진행 중이거나 완료된 작업이 있으면 새로 만들지 않고 기존 jobId를 반환한다(분석·챕터는 일차 단위, 책은 여행 단위) |
| 원자성 | 작업이 실패해도 기존 데이터(사진, 답변, 기존 본문)는 보존한다. 문체 변경 등은 새 결과가 완성된 뒤에만 교체한다 |

## 4.1 Job 모델

```
GET /jobs/:jobId  →  { "status": "running" | "done" | "failed", "progress": 0.0~1.0 }
```

- progress는 단계 수 기준으로 계산한다(예: 분석 5단계 중 2단계 완료 = 0.4). 프론트는 이 값으로 단계 문구(“n / N”, 1/3 단위)를 바꾼다.
- 상태는 DB(tb_job)에 저장해 서버가 재시작돼도 조회된다. 재시작 시 running이던 작업은 failed로 표시하고 프론트의 재시도로 다시 시작한다.

# 5. 엔드포인트 명세

| ID | 메서드 · 경로 | 용도 | MVP |
|---|---|---|---|
| E01 | POST /users | 닉네임으로 사용자 생성 + 쿠키 발급 | 필수 |
| E20 | GET /users/me | 로그인 확인 + 설정 조회 | 필수 |
| E02 | GET /bookshelf | 책장(진행 중 여행 + 책 목록) | 필수 |
| E03 | POST /trips | 새 여행 생성 | 필수 |
| E04 | GET /trips/:id | 여행 정보(일차·전체 일수) | 필수 |
| E05 | POST /trips/:id/days/:day/photos/upload-urls | 사진 업로드 주소 발급 | 필수 |
| E06 | PUT {업로드 URL} | 사진 직접 업로드(Object Storage) | 필수 |
| E07 | POST /trips/:id/days/:day/analyze | 사진 분석 시작 | 필수 |
| E08 | GET /jobs/:jobId | 작업 상태 | 필수 |
| E09 | GET /trips/:id/days/:day/scenes | 장면 목록 | 필수 |
| E10 | POST /trips/:id/days/:day/interview/start | 인터뷰 시작·이어 하기 | 필수 |
| E11 | POST /trips/:id/days/:day/interview/answer | 답변 전송 → 다음 질문 | 필수 |
| E21 | POST /trips/:id/days/:day/interview/end | 인터뷰 종료(저장하고 마침 / 저장 안 함) | 필수 |
| E12 | POST /trips/:id/days/:day/chapter | 챕터 작성 시작 | 필수 |
| E13 | GET /trips/:id/days/:day/chapter | 챕터 초안 조회 | 필수 |
| E14 | POST /trips/:id/finish | 여행 마치고 책 엮기 시작 | 필수 |
| E15 | GET /books/:id | 책 상세 | 필수 |
| E16 | GET /books/:id/chapters/:n | 리더 본문(문장별 근거 포함) | 필수 |
| E17 | POST /books/:id/restyle | 문체 변경 시작 | 필수 |
| E18 | DELETE /users/me | 내 데이터 삭제 | 필수 |
| E19 | PUT /users/me/settings | 인터뷰어 목소리·음성 보관 저장 | 필수 |

E20·E21은 03 설계서(쿠키 식별, 인터뷰 이어 하기·종료 규칙)와 맞추려고 추가했다. 프론트에는 이미 반영돼 있다. E19는 목소리 설정이 서버(tb_user)에 저장되므로 필수로 올렸다.

코드값: 동행 ALONE/FRIEND/FAMILY/LOVER, 문체 ESSAY/EMOTIONAL/FAIRYTALE, 인터뷰어 목소리 CALM/BRIGHT/PLAIN. 화면 표시 이름은 프론트가 매핑한다.

## 5.1 사용자 · 책장 · 여행

### E01 사용자 생성

| 메서드 · 경로 | POST /users |
|---|---|
| 사용 화면 | S-01 닉네임 입력 |
| 요청 | { "nickname": "서준호" }  (앞뒤 공백 제거 후 1~20자) |
| 성공 응답 | 201  { "nickname": "서준호" }  + Set-Cookie: 토큰(HttpOnly; Secure; SameSite=Lax; Path=/) |
| 서버 처리 | 닉네임 검증 → 무작위 토큰 생성 → 토큰의 SHA-256 해시와 닉네임을 tb_user에 저장 → 저장에 성공했을 때만 쿠키 발급(검증·저장 실패 시 쿠키도 사용자도 만들지 않음). 이미 유효한 쿠키가 있으면 새 사용자를 만들지 않고 기존 사용자를 돌려준다. 닉네임 중복은 허용(식별은 쿠키로만). |
| NCP 서비스 | 없음 (Cloud DB for MySQL) |
| 오류 | 400 NICKNAME_EMPTY / NICKNAME_TOO_LONG (프론트도 같은 규칙으로 먼저 검증) |

### E20 로그인 확인 · 설정 조회

| 메서드 · 경로 | GET /users/me |
|---|---|
| 사용 화면 | 모든 화면의 진입 가드, S-13 설정 |
| 요청 | 쿠키 |
| 성공 응답 | 200  { "nickname": "서준호", "voice": "CALM"\|"BRIGHT"\|"PLAIN", "keepAudio": true } |
| 서버 처리 | 쿠키 토큰의 해시로 tb_user 조회 → last_access_at 갱신. 쿠키는 있으나 사용자가 없으면(데이터 삭제 등) 쿠키를 만료시키는 Set-Cookie와 함께 401. |
| NCP 서비스 | 없음 |
| 오류 | 401 쿠키 없음 또는 사용자 없음 (프론트는 /start로 이동) |

### E02 책장 조회

| 메서드 · 경로 | GET /bookshelf |
|---|---|
| 사용 화면 | S-02 책장, 「오늘」 탭 분기 |
| 요청 | 쿠키 |
| 성공 응답 | 200  { nickname, inProgressTrip: { id, place, day, phase: "writing"\|"todayDone"\|"binding", latestPhotoUrl?, bindingProgress? } \| null, books: [ { id, title, place, dateLabel, days, spineWidth?, coverColor, coverPhotoUrl?, shelfStyle: "cover"\|"spine"\|"mini" } ] } |
| 서버 처리 | 진행 중 여행 = status가 WRITING·BINDING·FAILED인 여행(공통 결정 C-17, 최대 1개, 없으면 null). phase 판정: trip.status=BINDING → binding(진행률은 BOOK_BIND 작업의 완료/전체 건수), trip.status=FAILED(책 엮기 실패) → binding(프론트가 재시도 안내), WRITING이면 오늘 일차의 챕터가 완료(DONE)면 todayDone, 아니면 writing. books = status=DONE인 여행(최신순). coverColor = cover_color_set(1 red, 2 teal, 3 navy, 4 slate). coverPhotoUrl = cover_photo_id의 사진(서명 URL). spineWidth는 일수 규칙(1–2일 24, 3–5일 34, 6일+ 46) 또는 서버 계산. shelfStyle 규칙: 최신 1권 cover, 다음 2권 spine, 나머지 mini. |
| NCP 서비스 | Object Storage 서명 URL / Cloud Image Optimizer |
| 오류 | 401 |

### E03 여행 생성

| 메서드 · 경로 | POST /trips |
|---|---|
| 사용 화면 | S-03 새 여행 시작하기 |
| 요청 | { "place": "전주", "startDate": "2026-07-13", "endDate": "2026-07-15", "companions": "ALONE"\|"FRIEND"\|"FAMILY"\|"LOVER" } |
| 성공 응답 | 201  { "tripId": "t_…" } |
| 서버 처리 | 진행 중(WRITING·BINDING·FAILED) 여행이 이미 있으면 409. DB는 이를 막지 못하므로 사용자 행을 잠근 트랜잭션 안에서 검사한다. tb_trip 저장(status=WRITING) 후 날짜별 tb_trip_day를 기간만큼 모두 만든다(day_no 1..N, travel_date). N은 최대 30일로 제한(제안값). |
| NCP 서비스 | 없음 |
| 오류 | 400 장소·날짜·동행 위반, 409 진행 중 여행 있음 |

### E04 여행 정보

| 메서드 · 경로 | GET /trips/:id |
|---|---|
| 사용 화면 | S-04~S-09 머리글, 마지막 날 판단 |
| 요청 | - |
| 성공 응답 | 200  { id, place, startDate, endDate, day, totalDays, dateLabel }  (day = 오늘이 몇 일차, dateLabel = “7월 14일”) |
| 서버 처리 | day = (오늘 날짜(KST) − start_date) + 1, 여행 기간 밖이면 1 또는 totalDays로 고정(시연 편의). 이 day가 이후 경로의 :day(= tb_trip_day.day_no)로 쓰인다. 시연용으로 ?day=N 쿼리를 허용해도 된다. |
| NCP 서비스 | 없음 |
| 오류 | 404 |

## 5.2 사진 → 장면

### E05 사진 업로드 주소 발급

| 메서드 · 경로 | POST /trips/:id/days/:day/photos/upload-urls |
|---|---|
| 사용 화면 | S-04 오늘 사진 올리기 |
| 요청 | { "count": 42 }  (1~200) |
| 성공 응답 | 200  { "urls": ["https://…", …] }  (count개) |
| 서버 처리 | 해당 일차에 저장 안 함(DISCARD)이 아닌 인터뷰가 이미 있으면 409 INTERVIEW_STARTED(인터뷰 시작 후 사진 추가·장면 재구성은 MVP에서 제한). 아니면 사진 레코드 count개를 upload_status=UPLOADING으로 만들고, 각 객체 키(users/{userId}/trips/{tripId}/day{n}/photos/{photoId}.jpg)에 대한 사전 서명 PUT URL을 만든다(유효 15분). 촬영 날짜가 일차 날짜와 달라도 올린 일차에 저장한다(C-15). |
| NCP 서비스 | Object Storage |
| 오류 | 400 count 범위, 404 여행 없음, 409 INTERVIEW_STARTED |

대안 A (사전 서명 URL이 NCP에서 동작하지 않을 때): 서버 경유 업로드

```
urls[i] = "{API}/trips/:id/days/:day/photos/{photoId}"  → 브라우저가 이 주소로 PUT(본문=이미지)
```

서버가 받은 즉시 Object Storage에 저장한다. 프론트 수정 없음(URL만 다름).

### E06 사진 업로드

| 메서드 · 경로 | PUT {E05가 준 URL} |
|---|---|
| 사용 화면 | S-04 |
| 요청 | 본문 = 이미지 바이너리, Content-Type: image/* |
| 성공 응답 | 200/204 |
| 서버 처리 | 브라우저가 직접 업로드(사전 서명) 또는 서버가 수신(대안 A). 업로드 완료 판정은 E07에서 객체 존재 여부로 확인한다. |
| NCP 서비스 | Object Storage |
| 오류 | 403 서명 만료·불일치(프론트는 실패한 사진만 재시도 → E05 재호출) |

### E07 사진 분석 시작

| 메서드 · 경로 | POST /trips/:id/days/:day/analyze |
|---|---|
| 사용 화면 | S-04 읽는 중 |
| 요청 | - |
| 성공 응답 | 202  { "jobId": "j_…" } |
| 서버 처리 | 같은 일차의 분석 작업이 진행 중이면 기존 jobId를 반환한다(멱등, tb_job.active_key). 이미 분석된 일차를 다시 호출하면(사진을 추가했거나 분석이 실패한 경우) 기존 장면을 지우고 다시 분석한다. 객체가 실제로 올라온 사진만 READY로 바꾸고 그 사진만 분석하며, 0장이면 400. 일차 상태는 ANALYZING → SCENE_READY(실패 시 FAILED). 사진 분석 파이프라인(6.1)을 백그라운드로 시작한다. 완료 시 scenes가 저장된다. |
| NCP 서비스 | Maps Reverse Geocoding, CLOVA Studio HCX-005, (OCR), Object Storage |
| 오류 | 400 업로드된 사진 없음, 404 |

### E08 작업 상태

| 메서드 · 경로 | GET /jobs/:jobId |
|---|---|
| 사용 화면 | S-04, S-07, S-09, 문체 시트 |
| 요청 | - |
| 성공 응답 | 200  { "status": "running"\|"done"\|"failed", "progress": 0.0~1.0 } |
| 서버 처리 | jobs 조회. 소유자 확인. 종류(analyze/chapter/finish/restyle)와 무관하게 같은 모양. |
| NCP 서비스 | 없음 |
| 오류 | 404 |

### E09 장면 목록

| 메서드 · 경로 | GET /trips/:id/days/:day/scenes |
|---|---|
| 사용 화면 | S-05 장면 분석 결과, S-06 통화(장면 수) |
| 요청 | - |
| 성공 응답 | 200  { "scenes": [ { id, time, place?, title, note, photoCount, thumbs: [url…≤3], gap: boolean } ] } |
| 서버 처리 | 시간순 정렬. 사진 장면: time="09:40", place=장소명, title, note(“사진 23장 · 오래 머문 곳” 등 서버 문구). 간격 장면: gap=true, time="14:00–16:50", title="사진 없음 · 질문 후보", note="기억으로 이어질 간격", thumbs=[]. thumbs는 썸네일 서명 URL. |
| NCP 서비스 | Object Storage / Image Optimizer |
| 오류 | 404, 409 분석이 아직 끝나지 않음 |

## 5.3 인터뷰

### E10 인터뷰 시작 · 이어 하기

| 메서드 · 경로 | POST /trips/:id/days/:day/interview/start |
|---|---|
| 사용 화면 | S-06 수신 → 첫 질문 |
| 요청 | - |
| 성공 응답 | 200  { "question": { "index": 1, "total": 5, "text": "…", "audioUrl": "https://…mp3", "sceneRef": { head, title, note, gap, thumbs? } \| null }, "answered": 0 } |
| 서버 처리 | IN_PROGRESS 인터뷰가 있으면 이어 하기: 현재 ASKED 질문(첫 미답변 질문)과 이미 답한 수(answered)를 돌려준다(질문 음성은 저장된 것을 쓰고 다시 합성하지 않는다). 없으면 새 인터뷰를 만들고(일차 상태 INTERVIEWING) 1번 질문을 동적으로 생성한다(6.2). 질문 음성은 CLOVA Voice로 mp3 생성 → Object Storage 저장 → 서명 GET URL을 audioUrl로 준다. 질문 음성은 tb_voice_segment(speaker=AI)에도 기록한다. |
| NCP 서비스 | CLOVA Studio, CLOVA Voice, Object Storage |
| 오류 | 409 장면이 없음(분석 미완료) 또는 이미 종료된 인터뷰(DONE·SAVE_EXIT 이후에는 챕터 작성으로 진행, DISCARD 이후에는 새 인터뷰 가능), 502 TTS·질문 생성 실패 |

### E11 답변 전송

| 메서드 · 경로 | POST /trips/:id/days/:day/interview/answer |
|---|---|
| 사용 화면 | S-06 듣는 중 → 생각하는 중 |
| 요청 | multipart/form-data: audio(webm/opus 또는 mp4, ≤55초) 또는 skip=true |
| 성공 응답 | 200  { "transcript": "…", "skipped": false, "next": { …question } \| null, "moments": ["대나무 숲 소리", …]? }  (next=null일 때만 moments 포함) |
| 서버 처리 | ① 현재 ASKED 질문 확인(이미 처리된 질문이면 저장된 결과를 그대로 반환 — 멱등) ② skip=true면 질문을 SKIPPED로 처리 ③ 아니면 녹음을 ffmpeg로 wav 16kHz mono로 변환 → CSR 전사 ④ 전사가 비어 있으면 SKIPPED로 처리하고 skipped=true(ANSWERED 질문은 비어 있지 않은 확정 전사를 가져야 함) ⑤ 전사가 있으면 질문에 answer_text 저장·ANSWERED, 사용자 발화를 tb_voice_segment(speaker=USER, 전사, 길이, 음성 경로)에 저장 — 원본 음성 보관이 꺼져 있으면 음성 경로는 저장하지 않고 파일은 전사 후 삭제 ⑥ 답한 질문 수(tb_interview.answered_cnt)를 갱신한다. 질문이 5번째가 아니면 이전 질문·답변·장면을 반영해 다음 질문을 동적으로 생성하고 음성 합성 후 반환, 5번째면 인터뷰를 ENDED(end_type=DONE)로 바꾸고 next=null과 moments(HCX가 전사에서 핵심 구절 4개 추출, 저장하지 않고 응답에만 담는다 — 챕터의 moments는 챕터 작성 5단계에서 다시 만든다)를 반환. 장면별 재료 정리(tb_scene_memory)는 여기서 하지 않고 챕터 작성(E12) 1단계에서 한다. |
| NCP 서비스 | CLOVA Speech Recognition, Object Storage, CLOVA Studio, CLOVA Voice |
| 오류 | 400 파일 없음/길이 초과, 409 질문 순서 어긋남, 502 CSR 실패(프론트는 녹음을 유지하고 “다시 보내기”) |

```
ffmpeg -i in.webm -ac 1 -ar 16000 -f wav out.wav
CSR 호출: POST .../recog/v1/stt?lang=Kor  (바이너리 본문, 인증 헤더 포함)  ※ 경로는 구현 시 공식 문서로 재확인
```

동기 처리 시간 목표: 전사 ≤5초 + 질문 생성 ≤10초 + 음성 합성 ≤3초. LB·Nginx·WAS 타임아웃은 60초 이상

### E21 인터뷰 종료

| 메서드 · 경로 | POST /trips/:id/days/:day/interview/end |
|---|---|
| 사용 화면 | S-06 끊기 확인 시트 |
| 요청 | { "type": "SAVE_EXIT" \| "DISCARD" } |
| 성공 응답 | 204 |
| 서버 처리 | SAVE_EXIT(「여기까지 저장하고 마치기」): 현재 ASKED 질문을 SKIPPED로, 인터뷰를 ENDED(end_type=SAVE_EXIT)로 바꾼다(아직 만들지 않은 질문은 만들지 않는다). 이후 챕터 작성이 가능하다. DISCARD(「저장하지 않고 나가기」): 이번 인터뷰의 음성(Object Storage 객체 포함)·전사·질문을 삭제하고 end_type=DISCARD로 기록하며 일차 상태를 SCENE_READY로 되돌린다. 챕터는 만들지 않는다. 프론트는 이 호출을 기다리지 않고 화면을 넘기므로(best-effort) 실패하거나 호출되지 않아도 안전해야 한다: 브라우저를 닫는 등 종료 호출 없이 끊긴 인터뷰는 IN_PROGRESS로 남고 다음 E10에서 이어 하기가 되며, 이 상태에서 E12(챕터 작성)가 오면 SAVE_EXIT로 간주한다. |
| NCP 서비스 | Object Storage(DISCARD 시 삭제) |
| 오류 | 404, 409 이미 종료된 인터뷰(같은 type 재호출은 204로 멱등) |

## 5.4 챕터 · 책

### E12 챕터 작성 시작

| 메서드 · 경로 | POST /trips/:id/days/:day/chapter |
|---|---|
| 사용 화면 | S-06 마무리 → S-07 |
| 요청 | - |
| 성공 응답 | 202  { "jobId": "j_…" } |
| 서버 처리 | 같은 일차에 진행 중인 작성 작업이 있으면 기존 jobId(멱등, tb_job.active_key). 현재 챕터가 이미 DONE이면 새로 쓰지 않고 완료된 작업을 돌려준다. 선행 조건: 인터뷰가 IN_PROGRESS이면 SAVE_EXIT로 간주해 먼저 종료하고, 인터뷰가 없어도 사진 정보만으로 작성할 수 있다. 답변 음성은 E11 요청 안에서 저장이 끝난 뒤 응답하므로 별도의 업로드 대기는 없다. 일차 상태는 WRITING → DONE(실패 시 FAILED). 챕터 작성 파이프라인(6.3) 시작. 실패 시 챕터는 FAILED로 표시하되 사진·음성·전사는 보존한다. 재시도(「다시 쓰기」)는 새 챕터 행(version + 1)과 새 작업을 만들고 retry_cnt를 올린다. |
| NCP 서비스 | CLOVA Studio |
| 오류 | 404 |

### E13 챕터 초안 조회

| 메서드 · 경로 | GET /trips/:id/days/:day/chapter |
|---|---|
| 사용 화면 | S-08 오늘의 챕터 초안 |
| 요청 | - |
| 성공 응답 | 200  { "label": "2일차 · 비 오는 전주", "title": "비 오는 날의 손님", "body": "문단1\n문단2", "moments": ["…"] } |
| 서버 처리 | label = “{N}일차 · {AI가 붙인 부제}”. body는 문단을 \n으로 구분한 텍스트(문장별 근거는 책 확정 시 E16에서 제공). |
| NCP 서비스 | 없음 |
| 오류 | 404 챕터 없음, 409 작성 중 |

### E14 여행 마치고 책 만들기

| 메서드 · 경로 | POST /trips/:id/finish |
|---|---|
| 사용 화면 | S-08 마지막 날 → S-09 |
| 요청 | - |
| 성공 응답 | 202  { "jobId": "j_…", "bookId": "b_…" } |
| 서버 처리 | 이미 책 엮기 작업이 있으면 같은 jobId·bookId 반환(멱등, 책 중복 생성 금지). bookId는 trip.id를 그대로 쓴다(책 1권 = 여행 1건). 완료(DONE)된 챕터가 하나도 없으면 400. 챕터가 작성 중(WRITING)이면 409. trip.status가 FAILED(이전 엮기 실패)여도 다시 호출할 수 있고 새 작업이 만들어진다. 실패·미작성 일차는 책에 포함하지 않는다(공통 결정 C-16). trip.status=BINDING으로 바꾸고 책 엮기 파이프라인(6.4) 시작. 완료 시 status=DONE, completed_at 기록. 완료 전에는 GET /books/:id가 409. |
| NCP 서비스 | CLOVA Studio, Object Storage |
| 오류 | 400 완료된 챕터 없음, 404, 409 작성 중인 챕터 있음 |

### E15 책 상세

| 메서드 · 경로 | GET /books/:id |
|---|---|
| 사용 화면 | S-10 책 완성, S-11 책 상세 |
| 요청 | - |
| 성공 응답 | 200  { id, title, place, dateRange: "2026.07.13–07.15", coverPhotoUrl?, stats: { days, chapters, photos, voiceMinutes }, chapters: [ { n, day, title } ] } |
| 서버 처리 | 표지는 사진 배경 위에 제목을 얹은 고정 형식이므로 coverPhotoUrl(대표 사진)과 title만 준다. voiceMinutes = 사용자 발화(tb_voice_segment, speaker=USER) 길이 합(분, 올림). 원본 음성 보관이 꺼져 있어도 길이는 기록돼 있다. |
| NCP 서비스 | Object Storage / Image Optimizer |
| 오류 | 404, 409 엮는 중 |

### E16 리더 본문

| 메서드 · 경로 | GET /books/:id/chapters/:n |
|---|---|
| 사용 화면 | S-12 리더 |
| 요청 | - |
| 성공 응답 | 200  { n, total, label, title, photoUrl?, photoCaption?, paragraphs: [ { sentences: [ { text, evidence?: { photoUrl?, photoLabel?, photoNote?, transcript?, audioUrl?, interviewLabel? } } ] } ], pullQuote?: { text, audioUrl?, seconds, transcript }, page, pages, style } |
| 서버 처리 | evidence가 있는 문장이 프론트에서 밑줄로 보인다. photoUrl·audioUrl은 서명 GET URL(1시간). audioUrl은 저장된 사용자 녹음(원본)이며, 원본 음성 보관이 꺼져 있어 audio_key가 없으면 생략한다(프론트는 재생 버튼을 숨김). page/pages = 책 전체에서의 쪽 위치(챕터 길이 기준 환산). style = 현재 문체. |
| NCP 서비스 | Object Storage |
| 오류 | 404 챕터 번호 범위 밖 |

### E17 문체 변경 시작

| 메서드 · 경로 | POST /books/:id/restyle |
|---|---|
| 사용 화면 | S-11, S-12 문체 시트 |
| 요청 | { "style": "ESSAY" \| "EMOTIONAL" \| "FAIRYTALE" } |
| 성공 응답 | 202  { "jobId": "j_…" } |
| 서버 처리 | 책의 모든 일차 챕터를 새 문체로 다시 쓴다. 기존 챕터는 그대로 두고 새 버전(version+1, style_code)을 만들며, 모든 일차가 완성된 뒤 한 번에 current_yn을 전환하고 tb_trip.writing_style을 갱신한다(실패 시 기존 본문 유지). 같은 책에 진행 중 작업이 있으면 기존 jobId. 같은 문체로 요청하면 새로 쓰지 않고 완료된 작업을 반환해도 된다. |
| NCP 서비스 | CLOVA Studio |
| 오류 | 400 지원하지 않는 문체, 404, 409 |

## 5.5 설정 · 삭제

### E18 내 데이터 삭제

| 메서드 · 경로 | DELETE /users/me |
|---|---|
| 사용 화면 | S-13 설정 |
| 요청 | 쿠키 |
| 성공 응답 | 204  + 쿠키 만료(Set-Cookie) |
| 서버 처리 | 03 설계서 11장의 삭제 절차(사용자의 모든 여행을 대상으로): ① 여행을 DELETING으로 바꿔 업로드·생성·결과 반영을 막고 진행 중 작업을 취소 ② 사진·발화를 DELETE_PENDING으로 표시하고 Object Storage 객체를 삭제(실패 시 객체 키와 DB 행을 남겨 재시도) ③ 삭제 확인 후 표지·대표 인용 참조를 풀고 근거·문장·질문 등 자식 데이터부터 삭제 ④ 마지막에 사용자 삭제와 쿠키 만료. DB의 CASCADE만으로 지우면 Object Storage 파일이 남으므로 객체 삭제가 먼저다. |
| NCP 서비스 | Object Storage |
| 오류 | 500 (프론트는 “데이터는 그대로 있어요” 안내 + 다시 시도) |

### E19 설정 저장

| 메서드 · 경로 | PUT /users/me/settings |
|---|---|
| 사용 화면 | S-13 설정 |
| 요청 | { "voice": "CALM"\|"BRIGHT"\|"PLAIN", "keepAudio": true } |
| 성공 응답 | 200  { nickname, voice, keepAudio } |
| 서버 처리 | tb_user.interviewer_voice, keep_audio_yn 갱신. voice → CLOVA Voice speaker 매핑(6.2). keepAudio=false이면 이후 답변 녹음 원본을 보관하지 않고 전사 후 삭제한다(이미 보관된 음성은 유지). 그러면 그 답변이 근거인 문장은 audioUrl이 없다 — 프론트는 audioUrl이 없으면 재생 버튼을 숨긴다. |
| NCP 서비스 | CLOVA Voice |
| 오류 | 400 알 수 없는 코드 |

# 6. 서버 처리 파이프라인

이 장의 숫자(시간·거리·개수)는 시작 값이며, 시연 데이터에 맞춰 조정한다.

## 6.1 사진 분석 (E07)

| 단계 | 처리 | 사용 서비스 | 실패 시 |
|---|---|---|---|
| 1 수집 | Object Storage에서 해당 일차 사진 목록 확인. 업로드 안 된 레코드는 제외 | Object Storage | 0장이면 failed |
| 2 EXIF | 각 사진의 촬영 시각(DateTimeOriginal), GPS 위도·경도, 가로·세로 크기 읽기. 촬영 시각이 없으면 NULL로 저장하고 업로드 시각을 촬영 시각으로 간주하지 않는다(공통 결정 C-07). 시각 없는 사진은 시각이 있는 가장 늦은 장면(직전 장면)에 편입하고, 시각 있는 사진이 하나도 없으면 “시간 미상” 장면(start_time NULL)을 1개 만든다(공통 결정 C-07) | Pillow(오픈소스) | 해당 사진은 시간 NULL |
| 3 장면 분할 | 촬영 시각순 정렬 후, 앞 사진과 시간 간격 > 40분 또는 거리 > 300m이면 새 장면. 사진이 1장뿐이어도 장면으로 인정 | 서버 코드 | - |
| 4 장소명 | 장면 대표 사진(중앙 시각 또는 가장 큰 사진)의 GPS를 Reverse Geocoding → 동/도로명. (선택) 네이버 검색 API(지역)로 주변 장소명 보강 | Maps Reverse Geocoding, (Naver 검색 API) | 좌표 없으면 장소명 비움(제목은 시간대로) |
| 5 글자 읽기(선택) | 대표 사진을 OCR로 읽어 간판·메뉴 글자 추출 | CLOVA OCR | 건너뜀 |
| 6 장면 설명 | 대표 사진 1장 + 장소명 + OCR 글자를 HCX-005에 보내 장면 제목·한 줄 메모 생성(“콩나물국밥집 / 간판과 메뉴를 읽었어요”). 이미지는 호출당 1장 | CLOVA Studio HCX-005 | 장소명·시간으로 기본 문구 생성 |
| 7 간격 장면 | 인접한 두 장면 사이 시간 간격 ≥ 90분이면 gap 장면을 만든다(“14:00–16:50 사진 없음 · 질문 후보”) | 서버 코드 | - |
| 8 썸네일·저장 | 장면별 썸네일 최대 3장 확정, scenes 저장, 일차 상태를 SCENE_READY로 변경(여행 phase는 writing 유지) | Image Optimizer 또는 Pillow | failed |

progress: 8단계 중 완료 단계 수 / 8.

## 6.2 인터뷰 (E10, E11)

### 질문 생성 규칙 (동적)

- 질문은 한 번에 5개를 만들어 두지 않고, 답변이 확정될 때마다 이전 대화와 장면을 반영해 다음 질문을 하나씩 생성한다(공통 결정 C-08). 첫 질문은 인터뷰 시작 때 생성한다. 질문 개수는 5개 고정이다.
- 질문 유형 순서(제안값): ① 간격 장면(GAP)이 있으면 가장 긴 것 1개를 첫 질문으로 ② 사진 수가 많거나 간판·메뉴가 읽힌 장면(PLACE) 3개 ③ 마지막은 고정 질문 “오늘 하루를 한 단어로 하면요?”(CLOSING, 근거 장면 없음).
- 각 질문은 근거 장면(scene_id)·대표 사진(photo_id)·근거 설명(basis_text)과 함께 저장한다. 사진에서 근거를 찾을 수 없는 사실을 단정하지 않는다(“~네요, 그때 어땠어요?” 형식).
- 건너뛴 질문은 그 장면을 답변 없이 사진 정보만으로 다룬다. 이후 질문은 건너뛴 장면보다 아직 묻지 않은 장면을 우선한다.
- 다음 질문 생성이 지연되면 프론트는 “생각하는 중”을 계속 보여 준다. 생성은 동기이며, 질문 생성은 tb_job을 쓰지 않는다(프론트가 응답을 기다리는 동기 호출).

### 질문 음성 (TTS)

| 설정 값(프론트) | CLOVA Voice speaker | 비고 |
|---|---|---|
| 차분한 목소리 (기본) | 차분한 톤의 여성/남성 화자 1종 | 화자 이름은 CLOVA Voice 콘솔의 TTS Premium 목록에서 선택(확인 필요) |
| 밝은 목소리 | 밝은 톤 화자 1종 | 위와 같음 |
| 담백한 목소리 | 담백한 톤 화자 1종 | 위와 같음 |

- 질문 텍스트(≤2000자)를 CLOVA Voice에 보내 mp3를 받아 Object Storage에 저장한다. 같은 텍스트·화자는 캐시한다.

### 답변 처리

- 프론트는 한 답변을 최대 55초로 자른다. 서버는 길이 > 60초면 400, 그 이하면 CSR에 보낸다.
- 브라우저 녹음 형식(webm/opus 또는 mp4)은 CSR이 직접 받지 못하므로 ffmpeg로 wav 16kHz mono로 변환한다.
- 전사가 빈 문자열이면(무음) 답변으로 인정하지 않고 SKIPPED로 처리한다(03 설계서 10장: ANSWERED는 비어 있지 않은 전사 필수). 응답의 skipped=true.
- 같은 질문에 대한 재전송(프론트의 “다시 보내기”)은 이미 처리된 결과를 그대로 돌려준다(멱등).
- 「다시 듣기」·「건너뛰기」는 답변 확정을 취소하는 동작일 뿐 이미 저장된 원본 음성을 삭제하지 않는다. 확정된 답변의 전사·음성 연결은 수정하지 않는다.

## 6.3 챕터 작성 (E12)

| 단계 | 처리 | 핵심 규칙 |
|---|---|---|
| 1 재료 정리 | 해당 일차의 장면(시간·장소·메모·OCR)과 답변 전사에서 장면별 행동·느낌·장소·사진 속 텍스트를 뽑아 tb_scene_memory에 저장한다(건너뛴 장면은 사진 정보만). 기존 장면 기억이 있으면 지우고 다시 만든다 | 모든 재료에 근거 id(photo:…, voice:…, memory:…)를 붙인다 |
| 2 초안 생성 | HCX에 재료를 JSON으로 주고 문단·문장 단위로 쓰게 한다. 출력도 JSON: title, subtitle, paragraphs[ sentences[ { text, evidenceIds[] } ] ], pullQuote(원문 전사에서 그대로 인용) | “사진 메타와 사용자의 말에 있는 내용만 쓴다. 근거 없는 사실을 만들지 않는다”를 지시문에 명시 |
| 3 걸러내기 | 각 문장(문단이 아니라 문장 단위)에 evidenceIds가 비어 있거나, 존재하지 않는 id를 가리키거나, 명백한 새 고유명사·수치가 있으면 그 문장을 제거 또는 근거 있는 표현으로 재작성한다 | 프론트 단계 문구 “사진과 말에 없는 내용을 걸러낼게요”에 해당. 걸러낸 뒤 남은 문장만 저장 |
| 4 근거 연결 | 문장별로 사진(photoUrl·시각·장소·설명), 전사(transcript)와 발화 음성(audioUrl)을 evidence로 묶어 저장. tb_chapter_sentence · tb_sentence_evidence(문장 단위)에 저장 | 근거가 있는 문장만 프론트에서 밑줄 |
| 5 순간 칩 | 답변에서 핵심 구절 4개(moments) 추출 → tb_chapter.moments | 프론트 “포착 순간” |
| 6 챕터 저장 | 제목·부제·본문 대표 사진(tb_chapter.photo_id)·대표 인용(highlight_voice_segment_id, highlight_text는 전사에서 그대로 발췌)을 저장하고 문장·근거와 한 트랜잭션으로 챕터를 DONE으로 바꾼다 | 실패하면 챕터 FAILED, 사진·음성·전사 보존 |

progress: 1~2단계 구간은 0~0.5, 3~5단계 구간은 0.5~1.0(프론트가 50%를 기준으로 “쓰는 중 / 내용 확인 중” 문구를 바꾼다).

## 6.4 책 엮기 (E14)

- 완료(DONE)된 일차의 챕터를 일차순으로 연결해 tb_chapter.chapter_no(n)와 목차를 만든다.
- 책 제목: HCX에 챕터 제목·장소·기간을 주고 한 줄 제목 생성(“비 오는 날의 손님”).
- 표지: 고정 형식(사진 배경 + 제목). 대표 사진은 사진 수가 가장 많은 장면의 대표 사진으로 자동 선택해 tb_trip.cover_photo_id에 저장하고, 책등 색(cover_color_set)은 완성된 책 수 % 4 + 1(1 red, 2 teal, 3 navy, 4 slate)로 정한다(제안값).
- 통계: days, chapters, photos(업로드 사진 수), voiceMinutes(녹음 길이 합)를 계산한다.
- 근거 재확인: 모든 문장의 evidenceIds가 유효한지 다시 검증해 깨진 근거는 제거한다(프론트 단계 문구 “문장마다 근거를 다시 확인할게요”).
- progress: 3등분(챕터 연결 → 제목·표지 → 근거 확인). 완료 시 books 추가, 진행 중 여행 종료.

## 6.5 문체 변경 (E17)

- 입력: 각 문단의 문장 목록 + 목표 문체(에세이 / 감성 / 동화). 지시: 사실과 고유명사를 바꾸지 않고 문체만 바꾼다. 출력 문장 수·순서는 입력과 같아야 하며 각 문장의 evidenceIds는 그대로 유지한다.
- 문체 설명(프롬프트용): 에세이 = 담담한 서술(“오후 두 시쯤, 비가 갑자기 쏟아졌다.”), 감성 = 감각적·비유적(“비는 예고도 없이, 우리를 골목 끝으로 데려갔다.”), 동화 = 쉬운 말·~어요체(“비가 톡톡 내리던 날, 두 친구는 작은 카페로 쏙 들어갔어요.”).
- 새 본문이 책 전체에 대해 모두 만들어진 뒤에만 한 번에 교체(원자성). 실패 시 기존 본문과 style 유지.
- style은 책 단위로 저장하며 E16 응답의 style로 돌려준다.

## 6.6 작업 실행 · 복구

| 항목 | 규칙 |
|---|---|
| 실행 | WAS 프로세스 안의 백그라운드 작업(스레드/비동기). 상태는 모두 tb_job(MySQL)에 저장. 동시 실행은 사용자당 1개, 서버 전체 2~3개로 제한(NCP 호출 한도 보호) |
| 상태 저장 | tb_job(job_type, target_type, target_id, status, progress_done/progress_total, error_code …). API의 progress = progress_done / progress_total(0~1). 같은 대상의 진행 중 작업 중복은 tb_job.active_key 유니크 제약으로 막는다(03 설계서 3-13) |
| 재시작 | 서버가 재시작되면 running이던 job은 failed로 바꾼다. 프론트가 같은 API를 다시 호출하면 새 job이 만들어진다 |
| 외부 호출 재시도 | NCP 호출은 일시 오류(5xx, 429)에 한해 최대 2회, 지수 대기(1s, 3s). 그래도 실패하면 job failed + UPSTREAM_ERROR |
| 타임아웃 | HCX 60초, CSR 30초, TTS 30초, Reverse Geocoding 10초 |
| MVP 이후 | WAS를 여러 대로 늘리면 작업 실행이 서버 메모리에 묶이지 않도록 tb_job을 가져가는 방식(행 잠금)으로 바꾸거나 큐로 분리 |

# 7. 데이터 모델 대응

데이터 구조는 03 데이터 테이블 설계서 v0.5(MySQL 8.0, 14개 테이블)가 기준이다. 아래는 API 응답이 어느 테이블·컬럼에서 만들어지는지의 대응이다.

| API 응답 항목 | 출처 테이블 · 컬럼 | 비고 |
|---|---|---|
| nickname / voice / keepAudio | tb_user.nickname, interviewer_voice, keep_audio_yn | 코드값 CALM/BRIGHT/PLAIN. 식별은 browser_token_hash(쿠키 해시) |
| trip.place / startDate / endDate / totalDays | tb_trip.destination, start_date, end_date | totalDays = end_date − start_date + 1 |
| trip.day / dateLabel | tb_trip_day.day_no, travel_date | day = 오늘(KST) − start_date + 1 |
| inProgressTrip / phase / bindingProgress | tb_trip.status(WRITING·BINDING·FAILED), 오늘 일차의 tb_trip_day.status, tb_job(BOOK_BIND).progress | 매핑 규칙은 E02 |
| books[] | tb_trip(status=DONE): title, destination, start_date | days·spineWidth·shelfStyle은 계산 |
| coverPhotoUrl / coverColor | tb_trip.cover_photo_id → tb_photo.storage_key / tb_trip.cover_color_set | 표지는 사진 배경 + 제목 고정, 색은 책등 색 |
| scenes[].time / place / title / note / gap | tb_scene.start_time·end_time, place_name, title, summary, scene_type(GAP) | thumbs = tb_photo(scene_id) 최대 3장 |
| question.index / total | tb_interview_question.seq / tb_interview.total_question_cnt | |
| question.text / sceneRef | tb_interview_question.question_text, scene_id, photo_id, basis_text | sceneRef.head = 장면 시간·장소 |
| question.audioUrl | tb_voice_segment(question_id, speaker=AI).audio_key → 서명 URL | |
| answered | tb_interview.answered_cnt | 건너뜀·빈 답변 제외 |
| transcript / skipped | tb_voice_segment(speaker=USER).transcript / tb_interview_question.status(SKIPPED) | 빈 전사 = SKIPPED |
| moments (마무리 칩) | 저장하지 않음(응답에서 계산) | 챕터의 moments와 별개 |
| chapter.label / title / moments | tb_trip_day.day_no + tb_chapter.subtitle, title, moments | label = “{day_no}일차 · {subtitle}” |
| chapter.body | tb_chapter_sentence.content (paragraph_no별로 묶어 \n 구분) | 현재 버전(current_yn=Y) |
| sentences[].evidence | tb_sentence_evidence → tb_photo / tb_voice_segment / tb_scene_memory | 근거 있는 문장만 evidence 포함 |
| evidence.photoUrl / photoLabel / photoNote | tb_photo.storage_key / taken_at + place_name / caption | |
| evidence.transcript / audioUrl | tb_voice_segment.transcript / audio_key | MEMORY 근거는 연결된 발화 사용. audio_key 없으면 audioUrl 생략 |
| evidence.interviewLabel | “인터뷰 · {day_no}일차” | |
| 리더 photoUrl / photoCaption | tb_chapter.photo_id → tb_photo.storage_key / taken_at + place_name | |
| pullQuote | tb_chapter.highlight_text, highlight_voice_segment_id → duration_sec(seconds), transcript, audio_key | |
| book.title / dateRange / stats | tb_trip.title, start_date~end_date, 집계 | 사진 수 = READY 사진, 목소리 = USER 발화 길이 합(분) |
| book.chapters[] | tb_chapter(current_yn=Y, DONE): chapter_no, title + tb_trip_day.day_no | |
| style | tb_chapter.style_code(현재 버전) / tb_trip.writing_style | ESSAY/EMOTIONAL/FAIRYTALE (NOVEL 제외, C-05) |
| page / pages | 계산 | 챕터 문장 길이 기준 환산 |
| jobId / status / progress | tb_job.id, status, progress_done/progress_total | QUEUED·RUNNING → running, DONE → done, FAILED → failed |

## 7.1 Object Storage 경로

```
users/{userId}/trips/{tripId}/day{n}/photos/{photoId}.jpg      사진 원본 (tb_photo.storage_key)
users/{userId}/trips/{tripId}/day{n}/answers/{segmentId}.webm   사용자 발화 원본(보관 설정 시) (tb_voice_segment.audio_key)
users/{userId}/trips/{tripId}/day{n}/tts/{hash}.mp3            질문 음성(캐시) (tb_voice_segment.audio_key, speaker=AI)
```

- 버킷은 비공개. DB에는 객체 키만 저장하고(03 설계서), URL은 요청 때마다 서명 URL(PUT 15분, GET 1시간)로 만들어 준다. 삭제는 users/{userId}/ 접두 일괄 삭제(E18 절차).

# 8. 설정 · 키 목록

| 환경 변수 | 설명 | 발급 위치 |
|---|---|---|
| NCP_ACCESS_KEY / NCP_SECRET_KEY | Object Storage(S3 호환) 접근 키 | NCP 콘솔 > 마이페이지 > API 인증키 |
| NCP_OS_ENDPOINT / NCP_OS_BUCKET | Object Storage 엔드포인트(리전)와 버킷 이름 | Object Storage 버킷 생성 |
| NCP_APIGW_KEY_ID / NCP_APIGW_KEY | Maps·CSR·Voice 호출용 Client ID / Secret | 콘솔 > AI·NAVER API > Application 등록(Maps, CSR, Voice 선택) |
| CLOVA_STUDIO_API_KEY | HyperCLOVA X(Chat Completions) 호출 키 | CLOVA Studio 콘솔 |
| CLOVA_OCR_URL / CLOVA_OCR_SECRET | (선택) OCR 도메인 Invoke URL과 Secret | CLOVA OCR 도메인 생성 |
| NAVER_SEARCH_ID / NAVER_SEARCH_SECRET | (선택) 네이버 검색 API(지역) | Naver Developers 애플리케이션 등록 |
| DB_HOST / DB_NAME / DB_USER / DB_PASSWORD | Cloud DB for MySQL 접속 정보(utf8mb4) | Cloud DB for MySQL |
| COOKIE_NAME / COOKIE_MAX_AGE_DAYS | 쿠키 이름(예: yeohaengmal_token)과 유효 기간(접속할 때마다 연장). 속성은 HttpOnly·Secure·SameSite=Lax·Path=/ 고정 | - |

키는 서버 환경 변수나 비밀 저장소에만 둔다. 저장소(깃)와 프론트 코드에는 절대 넣지 않는다.

## 8.1 프론트 연결

- VITE_USE_MOCK=false, VITE_API_BASE_URL=/api 로 두고 Nginx가 /api를 WAS로 전달하면 src/api/index.ts가 실제 호출한다. 엔드포인트·응답 모양은 이 문서와 src/api/types.ts가 같다.
- Object Storage 버킷 CORS(PUT 허용)를 먼저 열어 둔다. API는 같은 출처라 CORS가 필요 없다. 마이크는 HTTPS에서만 되므로 로드밸런서에서 HTTPS를 종료한다. 로컬 개발은 Vite 프록시가 /api를 http://localhost:8080으로 넘긴다.
- 프론트는 이미 쿠키 방식(credentials: include, GET /users/me), 코드값(동행·문체·목소리), 인터뷰 종료·이어 하기(E21, answered), 설정 서버 저장(E19)을 호출하도록 맞춰져 있다.

# 9. 최소 구동을 위한 구현 순서

가장 먼저 “화면이 끝까지 도는 것”을 목표로 하며, AI 품질 개선은 마지막에 한다.

| 순서 | 작업 | 완료 기준 |
|---|---|---|
| 1 | VPC·서브넷·서버, Cloud DB for MySQL, 03 설계서 12장의 DDL 실행, WAS 뼈대, Nginx(/api 전달), 로드밸런서 HTTPS | HTTPS 주소로 화면이 열리고 /api/users/me가 401을 돌려준다 |
| 2 | E01·E20·E03·E04·E19 + 쿠키 + tb_job 프레임워크 + E08 | 닉네임 → 책장 → 새 여행까지 실제 서버로 동작 |
| 3 | Object Storage 연결 + E05·E06 (서명 URL 시험, 안 되면 서버 경유) | 사진 42장이 버킷에 올라간다 |
| 4 | 사진 분석: EXIF + 장면 분할 + Reverse Geocoding(기본 문구) + E07·E09 | 장면 5개가 화면에 뜬다 |
| 5 | ffmpeg + CSR + CLOVA Voice + HCX 질문 + E10·E11·E21 | 질문 5개가 끝까지 돌고 전사가 저장되며 이어 하기가 된다 |
| 6 | HCX 챕터 작성(문장 단위 근거 + 걸러내기) + E12·E13 | 초안이 나온다 |
| 7 | 책 엮기·리더·문체 + E14·E15·E16·E17, 삭제 E18 | 책 완성 → 읽기 → 문체 변경 → 데이터 삭제 |
| 8 | HCX-005 장면 설명, OCR, 네이버 검색 API(선택), 썸네일 최적화 | 품질 개선 |

## 9.1 서버 없이 먼저 시연이 필요한 경우

1~3번이 끝나기 전에도 프론트는 mock으로 전체 시연이 된다. 서버를 단계적으로 붙일 때 엔드포인트별로 mock/실서버를 섞고 싶다면 프론트의 api 함수 단위로 USE_MOCK 분기를 나누면 된다(별도 요청 시 작업).

# 10. 제한 · 위험 · 확인 필요

| 항목 | 내용 | 대응 |
|---|---|---|
| 녹음 형식 | CSR은 webm/opus·mp4를 직접 받지 않는다(mp3·aac·ac3·ogg·flac·wav, 16kHz 이상) | ffmpeg 변환(필수). 서버에 ffmpeg 설치 |
| 음성 길이 | CSR 1회 최대 60초 | 프론트가 55초로 자른다. 서버도 60초 초과는 400 |
| 이미지 입력 | HCX-005만 가능, 호출당 1장 | 장면당 대표 1장만 사용. 모든 사진을 보내지 않음 |
| 세션 쿠키 | 쿠키를 잃으면(삭제·다른 브라우저·시크릿 창) 기존 책장을 복구할 수 없음. 쿠키 이름·유효기간은 ▲ 팀 확인(C-02·C-03) | 시연 중 브라우저를 바꾸지 않도록 안내 |
| iPhone 사진 위치정보 | iPhone Safari에서 사진을 고를 때 위치정보(GPS)가 빠질 수 있음(선택 옵션에 따라 다름 — 확인 필요) | GPS가 없어도 동작하도록 설계됨(장소명 비움). 시연용 사진은 위치정보를 포함해 시험 |
| 사전 서명 URL | NCP Object Storage에서의 지원 여부를 문서로 확인하지 못함 | 먼저 실제로 시험(boto3 generate_presigned_url). 안 되면 대안 A(서버 경유) |
| 장소명(POI) | NCP Maps에는 장소명 검색이 없음(좌표→주소만) | 주소·OCR 글자로 대체하거나 네이버 검색 API(선택) 사용 |
| 지연 | 분석·챕터·책 엮기는 수십 초~1분 이상 걸릴 수 있음 | Job + 2초 폴링(이미 프론트에 구현) |
| 환각 | LLM이 없는 사실을 쓸 수 있음 | 근거 id 필수 + 걸러내기 단계(6.3). 서비스의 핵심 원칙 |
| 호출 한도·비용 | CSR 월 사용량 한도, HCX 토큰 과금 등 | 시연 데이터로 호출 수 산정 후 사용량 제한 신청. 질문 음성·전사는 캐시 |
| 개인정보 | 사진(GPS 포함)·음성은 민감 정보 | 비공개 버킷, 서명 URL, E18 삭제 보장, 키 서버 보관 |
| 제품명·화자명 | CLOVA Voice 화자 이름, 모델 이름 등은 변경될 수 있음 | 구현 시점에 NCP 콘솔·공식 문서로 재확인 |

## 10.1 출처 (NCP 공식 문서)

- CLOVA Speech Recognition(CSR) 사양: guide.ncloud-docs.com/docs/csr-spec — 1회 60초, 지원 형식·샘플레이트
- CLOVA Studio Chat Completions v3: api.ncloud-docs.com/docs/clovastudio-chatcompletionsv3 — HCX-005 이미지 입력, 호출당 1장
- CLOVA Voice TTS Premium: api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium — text 2000자, mp3
- Maps Reverse Geocoding: api.ncloud-docs.com/docs/ainaverapi-maps-overview
- Object Storage(S3 호환): api.ncloud-docs.com/docs/storage-objectstorage
- Cloud Image Optimizer: guide.ncloud-docs.com/docs/media-media-3-1
- CLOVA OCR General: api.ncloud-docs.com/docs/ai-application-service-ocr-ocr