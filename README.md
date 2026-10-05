# frontend

네이버클라우드 프로젝트 프론트 레포지토리 — 여행말 프론트엔드

여행 사진과 밤마다 하는 AI 음성 인터뷰로 여행 이야기책을 만드는 모바일 웹. 백엔드 없이 mock 으로 처음부터 끝까지 돌아간다.

```bash
npm install
npm run dev        # http://localhost:5173  (모바일 폭 390px 기준, 데스크톱에서는 가운데 430px)
npm run build
```

## 환경 변수 (`.env`, 예시는 `.env.example`)

| 이름 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `true` 면 `src/api/mock.ts` 의 가짜 응답(0.5~2초 지연). `false` 면 실제 서버 |
| `VITE_API_BASE_URL` | `/api` (Nginx가 같은 출처에서 API를 전달. 로컬 개발은 Vite 프록시가 `localhost:8080`으로 넘김) |

## 백엔드 담당에게

API 모양은 [`src/api/types.ts`](src/api/types.ts), 호출 함수는 [`src/api/index.ts`](src/api/index.ts) 에 모여 있다.
명세에 없던 것을 화면 때문에 추가했다:
`GET /trips/:id`(머리글·마지막 날 판단), `GET /trips/:id/days/:day/chapter` 응답 모양, 인터뷰 `answer` 의 `skip=true`·`moments`,
`GET /users/me`·`PUT /users/me/settings`·`POST …/interview/end`, `DELETE /users/me`. 사용자는 로그인 없이 서버가 발급한 쿠키로 식별한다.

## 시연 · 점검용 주소 스위치 (mock 전용)

- `/?scenario=empty|writing|todayDone|binding` 책장 상태 바로 보기
- `?scenario=uploadFail` 사진 올리기에서 3장 실패 → 실패한 것만 다시 시도
- `?scenario=chapterFail` 챕터 작성이 한 번 실패 → 다시 쓰기
- `?day=3` 오늘을 3일차(마지막 날)로 바꿔 "여행 마치고 책 만들기" 화면 보기
- 마이크가 없거나 거절돼도 통화 수신 화면의 "마이크 없이 체험하기"로 질문 5개가 끝까지 돈다
- 사진 올리기 첫 화면의 "예시 사진 42장으로 해 볼게요"로 파일 선택 없이 진행

## 구조

```
src/styles/      디자인 토큰(tokens.css, Figma 보드에서 추출) + 전역
src/components/  버튼·칩·책 표지·책등·장면 카드·파형·바텀시트·탭 바 등 공통
src/api/         types.ts(계약) · index.ts(호출) · mock.ts(가짜 응답)
src/pages/       화면 (pages/call/ 은 useReducer 상태 기계 + 녹음/재생 훅)
public/img/      Figma 에서 받은 사진·아이콘
```
