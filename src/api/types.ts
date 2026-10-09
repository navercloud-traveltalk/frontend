/**
 * 여행말 API 타입 — 백엔드 담당은 이 파일을 기준으로 맞춘다.
 * 지금은 src/api/mock.ts 가 같은 모양의 가짜 응답을 돌려준다.
 */

/** 동행 코드 (화면 표시: 혼자/친구/가족/연인) */
export type Companion = 'ALONE' | 'FRIEND' | 'FAMILY' | 'LOVER'

// ── 사용자 ────────────────────────────────────────────
/**
 * 사용자는 로그인 없이 브라우저 쿠키로 식별한다(서버가 HttpOnly 쿠키 발급). 요청에 사용자 ID 헤더는 없다.
 * POST /users → Set-Cookie + { nickname }, GET /users/me → 쿠키 확인(없으면 401).
 */
/** 인터뷰어 목소리 코드 (화면 표시: 차분한/밝은/담백한 목소리) */
export type VoiceCode = 'CALM' | 'BRIGHT' | 'PLAIN'
export interface CreateUserRequest { nickname: string }
export interface CreateUserResponse { nickname: string }
/** GET /users/me · PUT /users/me/settings 응답 */
export interface MeResponse { nickname: string; voice: VoiceCode; keepAudio: boolean }
export interface UpdateSettingsRequest { voice: VoiceCode; keepAudio: boolean }

// ── 책장 ──────────────────────────────────────────────
export type CoverColor = 'red' | 'teal' | 'navy' | 'slate'

/** 선반 위에서 어떻게 꽂을지: 표지가 보이게(cover) / 책등만(spine) / 작은 표지(mini) */
export type ShelfStyle = 'cover' | 'spine' | 'mini'

export interface BookSummary {
  id: string
  title: string
  place: string
  /** 표지에 찍히는 날짜, 예: "2026.09" */
  dateLabel: string
  /** 책등 두께 결정 (1–2일 / 3–5일 / 6일 이상) */
  days: number
  /** 서버가 계산한 책등 두께(px). 없으면 days 로 계산 (1–2일 24 / 3–5일 34 / 6일+ 46) */
  spineWidth?: number
  /** 책등 색 (표지는 사진 배경 + 제목으로 고정) */
  coverColor: CoverColor
  coverPhotoUrl?: string
  shelfStyle: ShelfStyle
}

/** writing: 오늘 사진 기다리는 중 / todayDone: 오늘 인터뷰 끝 / binding: 책 엮는 중 */
export type TripPhase = 'writing' | 'todayDone' | 'binding'

export interface InProgressTrip {
  id: string
  place: string
  /** 현재 몇 일차 */
  day: number
  phase: TripPhase
  latestPhotoUrl?: string
  /** binding 일 때 0–1 */
  bindingProgress?: number
  /** 그 일차에서 다시 들어갈 화면(서버 계산). 책을 엮는 중이면 없다 */
  nextStep?: NextStep
}

/** 일차에서 다음에 할 화면: 사진 올리기 · 사진 정리 중 · 장면 확인 · 인터뷰(이어 하기) · 챕터 작성 · 챕터 확인 */
export type NextStep = 'upload' | 'analyzing' | 'scenes' | 'call' | 'writing' | 'draft'
/** GET /trips/:id 의 days[] */
export interface TripDayInfo {
  day: number
  dateLabel: string
  status: string
  nextStep: NextStep
  /** 사진 정리·챕터 작성이 진행 중이면 그 작업 */
  jobId?: string
  /** 이미 올린 사진 수(업로드 중 포함) */
  photoCount: number
}

/** GET /bookshelf */
export interface BookshelfResponse {
  nickname: string
  inProgressTrip: InProgressTrip | null
  books: BookSummary[]
}

// ── 여행 ──────────────────────────────────────────────
/** POST /trips */
export interface CreateTripRequest {
  place: string
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  companions: Companion
}
export interface CreateTripResponse { tripId: string }

// ── 오늘 (사진 → 장면) ────────────────────────────────
/** GET /trips/:id — 화면 머리글(“7월 14일 · 여행 2일차”)과 마지막 날 판단에 쓴다 */
export interface TripInfo {
  id: string
  place: string
  startDate: string
  endDate: string
  day: number
  totalDays: number
  /** “7월 14일” */
  dateLabel: string
  /** 지금 작성할 일차(여행 중=오늘, 지난 여행=아직 끝내지 않은 가장 이른 일차). 없으면 day */
  currentDay?: number
  /** 일차별 진행 상태(서버가 계산, 없으면 이전 동작) */
  days?: TripDayInfo[]
}

/** POST /trips/:id/days/:day/photos/upload-urls {count} */
export interface UploadUrlsResponse { urls: string[] }

/** POST /trips/:id/days/:day/analyze · /chapter · /trips/:id/finish · /books/:id/restyle */
export interface JobResponse { jobId: string }

/** GET /jobs/:jobId */
export type JobStatus = 'running' | 'done' | 'failed'
export interface JobStatusResponse { status: JobStatus; progress: number }

export interface Scene {
  id: string
  /** 사진 장면이면 "09:40", 사진 없는 간격이면 "14:00–16:50" */
  time: string
  place?: string
  title: string
  note: string
  photoCount: number
  thumbs: string[]
  /** 사진이 없는 빈 시간(질문 후보) */
  gap: boolean
}
/** GET /trips/:id/days/:day/scenes */
export interface ScenesResponse { scenes: Scene[] }

// ── 인터뷰 (턴제 통화) ─────────────────────────────────
export interface SceneRef {
  /** "14:00–16:50" 또는 "09:40 · 경기전" */
  head: string
  title: string
  note: string
  gap: boolean
  thumbs?: string[]
}

export interface Question {
  /** 1부터 */
  index: number
  total: number
  text: string
  /** 질문 음성(mp3) 주소. 음성을 만들지 못하면 없다(글만 보여 준다) */
  audioUrl?: string
  /** 이 질문의 근거가 된 장면. 마지막 질문처럼 없을 수 있다 */
  sceneRef?: SceneRef | null
}

/** POST /trips/:id/days/:day/interview/start */
export interface InterviewStartResponse {
  question: Question
  /** 이어 하기: 이미 답한 질문 수(처음이면 0 또는 생략) */
  answered?: number
}

/**
 * POST /trips/:id/days/:day/interview/answer  (multipart: audio=녹음 파일, 건너뛰기면 skip=true)
 * next 가 null 이면 마지막 질문이 끝난 것이다. 이때 moments(오늘의 순간 칩)를 함께 준다.
 */
export interface InterviewAnswerResponse {
  transcript: string
  next: Question | null
  moments?: string[]
  /** 건너뜀(skip 요청 또는 전사가 비어 있음) — 답한 질문 수에 세지 않는다 */
  skipped?: boolean
}

/** POST …/interview/end — SAVE_EXIT: 지금까지 저장하고 마침(남은 질문 건너뜀), DISCARD: 저장하지 않고 나감(이번 인터뷰 음성·전사 삭제) */
export interface EndInterviewRequest { type: 'SAVE_EXIT' | 'DISCARD' }

// ── 챕터 초안 · 책 완성 ────────────────────────────────
/** GET /trips/:id/days/:day/chapter */
export interface ChapterDraft {
  /** “2일차 · 비 오는 전주” */
  label: string
  title: string
  /** 줄바꿈(\n)으로 문단을 나눈다 */
  body: string
  /** 포착 순간 칩 */
  moments: string[]
}

/** POST /trips/:id/finish */
export interface FinishTripResponse { jobId: string; bookId: string }

export interface BookChapterItem { n: number; day: number; title: string }

/** GET /books/:id */
export interface Book {
  id: string
  title: string
  place: string
  /** “2026.07.13–07.15” */
  dateRange: string
  /** 표지는 사진 배경 위에 제목을 얹은 고정 형식 */
  coverPhotoUrl?: string
  stats: { days: number; chapters: number; photos: number; voiceMinutes: number }
  chapters: BookChapterItem[]
}

// ── 리더 ──────────────────────────────────────────────
/** 문체 코드 (화면 표시: 에세이/감성/동화) */
export type StyleCode = 'ESSAY' | 'EMOTIONAL' | 'FAIRYTALE'

/** 문장의 근거: 사진, 내가 한 말(전사), 저장된 음성 */
export interface Evidence {
  photoUrl?: string
  /** “사진 · 16:52 골목 카페” */
  photoLabel?: string
  photoNote?: string
  transcript?: string
  /** 그때 내 목소리 음성 파일 주소 */
  audioUrl?: string
  /** “인터뷰 · 2일차” */
  interviewLabel?: string
}
export interface Sentence {
  text: string
  /** 대표 근거(첫 사진 + 첫 말). 없으면 밑줄 없음 */
  evidence?: Evidence
  /** 근거가 2개 이상인 문장만: 근거마다 하나씩, 저장된 순서대로 */
  evidences?: Evidence[]
}
export interface Paragraph { sentences: Sentence[] }

/** GET /books/:id/chapters/:n */
export interface ChapterContent {
  n: number
  total: number
  /** “2일차 · 비 오는 전주” */
  label: string
  title: string
  photoUrl?: string
  /** “16:52 · 골목 카페” */
  photoCaption?: string
  paragraphs: Paragraph[]
  /** 문단 뒤에 크게 뜨는 인용 + 그때 내 목소리 */
  /** audioUrl 은 원본 음성을 보관하지 않는 설정이면 없다 */
  pullQuote?: { text: string; audioUrl?: string; seconds: number; transcript: string }
  /** 책 전체에서 이 페이지 위치 (“24 / 61”) */
  page: number
  pages: number
  style: StyleCode
}

/** POST /books/:id/restyle {style} → JobResponse */
export interface RestyleRequest { style: StyleCode }
