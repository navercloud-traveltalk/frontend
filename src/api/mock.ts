import type { BookshelfResponse, BookSummary, CreateTripRequest, CreateTripResponse, CreateUserResponse, InProgressTrip, TripPhase } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** 실제처럼 0.5~2초 지연 */
export const delay = () => sleep(500 + Math.random() * 1500)

const COVER_PHOTO = '/img/cover-jeju.png'

const SEED_BOOKS: BookSummary[] = [
  { id: 'b1', title: '바람이 머문 제주', place: '제주', dateLabel: '2026.09', days: 4, coverType: 'photo', coverColor: 'red', coverPhotoUrl: COVER_PHOTO, shelfStyle: 'cover' },
  { id: 'b2', title: '바람이 지나간 자리', place: '제주', dateLabel: '2026', days: 4, spineWidth: 34, coverType: 'cloth', coverColor: 'teal', shelfStyle: 'spine' },
  { id: 'b3', title: '첫눈 오던 골목', place: '강릉', dateLabel: '2025', days: 3, spineWidth: 30, coverType: 'type', coverColor: 'slate', shelfStyle: 'spine' },
  { id: 'b4', title: '바람이 지나간 자리', place: '제주', dateLabel: '2026.03', days: 3, coverType: 'cloth', coverColor: 'teal', coverPhotoUrl: '/img/round-jeju.png', shelfStyle: 'mini' },
  { id: 'b5', title: '첫눈 오던 골목', place: '강릉', dateLabel: '2025.12', days: 3, coverType: 'type', coverColor: 'slate', shelfStyle: 'mini' },
]

export type Scenario = 'empty' | 'writing' | 'todayDone' | 'binding'

interface MockDb {
  nickname: string
  trip: InProgressTrip | null
  books: BookSummary[]
}

const DB_KEY = 'yhm.mock'

function load(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    /* ignore */
  }
  return { nickname: '', trip: null, books: [] }
}
function save(db: MockDb) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

/** ?scenario=empty|writing|todayDone|binding — 화면 상태를 바로 보는 개발용 스위치 */
function applyScenario(db: MockDb): MockDb {
  const p = new URLSearchParams(location.search).get('scenario') as Scenario | null
  if (!p) return db
  const trip = (phase: TripPhase, extra: Partial<InProgressTrip> = {}): InProgressTrip => ({ id: 't1', place: '전주', day: 2, phase, latestPhotoUrl: '/img/photo-writing.png', ...extra })
  if (p === 'empty') return { ...db, trip: null, books: [] }
  if (p === 'writing') return { ...db, trip: trip('writing'), books: SEED_BOOKS }
  if (p === 'todayDone') return { ...db, trip: trip('todayDone'), books: SEED_BOOKS }
  if (p === 'binding') return { ...db, trip: trip('binding', { bindingProgress: 76 / 124 }), books: SEED_BOOKS }
  return db
}

export async function mockCreateUser(nickname: string): Promise<CreateUserResponse> {
  await delay()
  const db = load()
  save({ ...db, nickname })
  return { userId: `u_${Math.random().toString(36).slice(2, 8)}`, nickname }
}

export async function mockGetBookshelf(): Promise<BookshelfResponse> {
  await delay()
  let db = dayFromQuery(applyScenario(load()))
  if (db.trip?.phase === 'binding' && new URLSearchParams(location.search).get('scenario') !== 'binding') {
    const p = Math.min(1, (Date.now() - bindStart()) / 5000)
    if (p >= 1) db = finalizeBinding(db)
    else db = { ...db, trip: { ...db.trip, bindingProgress: Math.max(0.1, p) } }
  }
  return { nickname: db.nickname || '서준호', inProgressTrip: db.trip, books: db.books }
}

export async function mockCreateTrip(req: CreateTripRequest): Promise<CreateTripResponse> {
  await delay()
  const db = load()
  const tripId = 't1'
  save({ ...db, trip: { id: tripId, place: req.place, day: 1, phase: 'writing', latestPhotoUrl: '/img/photo-writing.png' } })
  try { localStorage.setItem('yhm.mock.meta', JSON.stringify({ startDate: req.startDate, endDate: req.endDate })) } catch { /* ignore */ }
  return { tripId }
}

// ── 여행 정보 · 사진 · 장면 ───────────────────────────
import type { JobStatusResponse, ScenesResponse, TripInfo, UploadUrlsResponse } from './types'

const SAMPLE_PHOTOS = Array.from({ length: 9 }, (_, i) => `/img/photo-${i + 1}.png`)
export { SAMPLE_PHOTOS }

/** ?day=3 처럼 붙이면 mock 여행의 오늘 일차를 바꾼다 (마지막 날 화면 확인용) */
function dayFromQuery(db: MockDb): MockDb {
  const d = Number(new URLSearchParams(location.search).get('day'))
  if (!d || !db.trip || db.trip.day === d) return db
  const next = { ...db, trip: { ...db.trip, day: d, phase: 'writing' as TripPhase } }
  save(next)
  return next
}

const fmtDate = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`

interface MockMeta { startDate: string; endDate: string }
function loadMeta(): MockMeta {
  try {
    const raw = localStorage.getItem('yhm.mock.meta')
    if (raw) return JSON.parse(raw) as MockMeta
  } catch { /* ignore */ }
  return { startDate: '2026-07-13', endDate: '2026-07-15' }
}

export async function mockGetTrip(id: string): Promise<TripInfo> {
  await delay()
  const db = dayFromQuery(applyScenario(load()))
  const meta = loadMeta()
  const day = db.trip?.day ?? 1
  const start = new Date(meta.startDate)
  const total = Math.round((new Date(meta.endDate).getTime() - start.getTime()) / 86400000) + 1
  const cur = new Date(start.getTime() + (day - 1) * 86400000).toISOString().slice(0, 10)
  return { id, place: db.trip?.place ?? '전주', startDate: meta.startDate, endDate: meta.endDate, day, totalDays: total, dateLabel: fmtDate(cur) }
}

export async function mockUploadUrls(count: number): Promise<UploadUrlsResponse> {
  await delay()
  return { urls: Array.from({ length: count }, (_, i) => `mock://upload/${i}`) }
}

let failedOnce = false
let failCount = 0
/** 사진 한 장 업로드 흉내. ?scenario=uploadFail 이면 처음 한 번만 3장을 실패시킨다. */
export async function mockPutPhoto(index: number): Promise<void> {
  await sleep(120 + Math.random() * 130)
  const sc = new URLSearchParams(location.search).get('scenario')
  if (sc === 'uploadFail' && !failedOnce && [4, 13, 29].includes(index)) {
    if (++failCount >= 3) failedOnce = true
    throw new Error('upload failed')
  }
}

const jobs = new Map<string, number>()
const jobKinds = new Map<string, string>()
let chapterFailedOnce = false
export async function mockStartJob(kind = 'job'): Promise<{ jobId: string }> {
  await delay()
  const jobId = `job_${Math.random().toString(36).slice(2, 8)}`
  jobs.set(jobId, Date.now())
  jobKinds.set(jobId, kind)
  return { jobId }
}
/** 시작하고 5초쯤 뒤에 완료 */
export async function mockJobStatus(jobId: string): Promise<JobStatusResponse> {
  await sleep(250)
  const t0 = jobs.get(jobId) ?? Date.now() - 6000
  const progress = Math.min(1, (Date.now() - t0) / 5000)
  // ?scenario=chapterFail — 챕터 작성이 한 번만 실패한다
  if (jobKinds.get(jobId) === 'chapter' && new URLSearchParams(location.search).get('scenario') === 'chapterFail' && !chapterFailedOnce && progress > 0.5) {
    chapterFailedOnce = true
    return { status: 'failed', progress }
  }
  if (jobKinds.get(jobId) === 'binding' && progress >= 1) { const d = load(); if (d.trip?.phase === 'binding') finalizeBinding(d) }
  return { status: progress >= 1 ? 'done' : 'running', progress }
}

const THUMB = '/img/thumb-alley.png'
export async function mockScenes(): Promise<ScenesResponse> {
  await delay()
  return {
    scenes: [
      { id: 's1', time: '09:40', place: '경기전', title: '경기전', note: '사진 23장 · 오래 머문 곳', photoCount: 23, thumbs: [THUMB, THUMB, THUMB], gap: false },
      { id: 's2', time: '12:30', place: '콩나물국밥집', title: '콩나물국밥집', note: '간판과 메뉴를 읽었어요', photoCount: 6, thumbs: [THUMB, THUMB, THUMB], gap: false },
      { id: 's3', time: '14:00–16:50', title: '사진 없음 · 질문 후보', note: '기억으로 이어질 간격', photoCount: 0, thumbs: [], gap: true },
      { id: 's4', time: '16:52', place: '골목 카페', title: '골목 카페', note: '사진 1장', photoCount: 1, thumbs: [THUMB, THUMB, THUMB], gap: false },
      { id: 's5', time: '18:20', place: '오목대', title: '오목대', note: '노을 사진 9장', photoCount: 9, thumbs: [THUMB, THUMB, THUMB], gap: false },
    ],
  }
}

// ── 인터뷰 mock: 질문 5개 ─────────────────────────────
import type { InterviewAnswerResponse, InterviewStartResponse, Question } from './types'

/** 질문 길이에 맞춘 무음 WAV 를 만들어 mp3 주소 대신 쓴다 (mock 전용) */
function silentWavUrl(seconds: number): string {
  const rate = 8000
  const n = Math.round(rate * seconds)
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  w(36, 'data'); v.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(128)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

const QUESTIONS: { text: string; sceneRef: Question['sceneRef']; answer: string }[] = [
  { text: '아침에 경기전을 오래 둘러보셨네요. 가장 기억에 남는 장면이 뭐였어요?', sceneRef: { head: '09:40 · 경기전', title: '경기전', note: '사진 23장 · 오래 머문 곳', gap: false, thumbs: ['/img/thumb-alley.png', '/img/thumb-alley.png', '/img/thumb-alley.png'] }, answer: '한복 입은 사람들이 우산 쓰고 걷는 모습이 예뻤어요.' },
  { text: '점심에 드신 콩나물국밥은 어땠어요? 수란은 어떻게 드셨어요?', sceneRef: { head: '12:30 · 콩나물국밥집', title: '콩나물국밥집', note: '간판과 메뉴를 읽었어요', gap: false, thumbs: ['/img/thumb-alley.png', '/img/thumb-alley.png', '/img/thumb-alley.png'] }, answer: '수란을 밥에 비벼 먹었는데 국물이 정말 시원했어요.' },
  { text: '3시부터 5시까지는 사진이 한 장도 없네요. 그때 뭐 하셨어요?', sceneRef: { head: '14:00–16:50', title: '사진 없음 · 질문 후보', note: '기억으로 이어질 간격', gap: true }, answer: '비 왔어요 갑자기. 우산 없어서 골목 카페에…' },
  { text: '골목 카페에서 찍은 사진은 한 장뿐이에요. 그곳은 어떤 곳이었어요?', sceneRef: { head: '16:52 · 골목 카페', title: '골목 카페', note: '사진 1장', gap: false, thumbs: ['/img/thumb-alley.png'] }, answer: '창가 자리에서 비 오는 골목을 한참 봤어요.' },
  { text: '오늘 하루를 한 단어로 하면요?', sceneRef: null, answer: '분홍 노을.' },
]
let qIndex = 0

function makeQuestion(i: number): Question {
  const q = QUESTIONS[i]
  return { index: i + 1, total: QUESTIONS.length, text: q.text, audioUrl: silentWavUrl(Math.max(2.5, q.text.length * 0.11)), sceneRef: q.sceneRef }
}

export async function mockInterviewStart(): Promise<InterviewStartResponse> {
  await delay()
  qIndex = 0
  return { question: makeQuestion(0) }
}

export async function mockInterviewAnswer(skip: boolean): Promise<InterviewAnswerResponse> {
  await delay()
  const transcript = skip ? '' : QUESTIONS[qIndex].answer
  qIndex += 1
  if (qIndex >= QUESTIONS.length) return { transcript, next: null, moments: ['대나무 숲 소리', '수란 먹는 법', '할머니의 고구마', '분홍 노을'] }
  return { transcript, next: makeQuestion(qIndex) }
}

/** 화면에 보여 줄 실시간 전사 흉내 (mock 전용) */
export const mockLiveCaption = (questionIndex: number) => QUESTIONS[Math.max(0, questionIndex - 1)]?.answer ?? ''


// ── 챕터 초안 · 책 ────────────────────────────────────
import type { Book, ChapterDraft, FinishTripResponse } from './types'

export async function mockGetChapter(): Promise<ChapterDraft> {
  await delay()
  const db = load()
  // 오늘의 챕터가 기록되면 책장에는 "오늘 완료"로 보인다
  if (db.trip && db.trip.phase !== 'binding') save({ ...db, trip: { ...db.trip, phase: 'todayDone' } })
  return {
    label: `${db.trip?.day ?? 2}일차 · 비 오는 ${db.trip?.place ?? '전주'}`,
    title: '비 오는 날의 손님',
    body: '오후 두 시쯤, 비가 갑자기 쏟아졌다.\n우리는 골목의 작은 카페로 뛰어들었다.',
    moments: ['대나무 숲 소리', '수란 먹는 법', '할머니의 고구마', '분홍 노을'],
  }
}

/** 책 엮기가 끝나면: 새 책을 맨 앞에 꽂고 진행 중 여행을 닫는다 */
function finalizeBinding(db: MockDb): MockDb {
  const book: BookSummary = { id: 'b_new', title: '비 오는 날의 손님', place: '전주', dateLabel: '2026.07', days: 3, coverType: 'photo', coverColor: 'red', coverPhotoUrl: '/img/cover-main.png', shelfStyle: 'cover' }
  const rest = db.books.filter((b) => b.id !== 'b_new').map((b, i) => (i === 0 && b.shelfStyle === 'cover' ? { ...b, shelfStyle: 'spine' as const, spineWidth: 34 } : b))
  const next: MockDb = { ...db, trip: null, books: [book, ...rest] }
  save(next)
  return next
}
const BIND_KEY = 'yhm.mock.bind'
const bindStart = () => Number(localStorage.getItem(BIND_KEY) ?? 0)

export async function mockFinishTrip(): Promise<FinishTripResponse> {
  await delay()
  const db = load()
  localStorage.setItem(BIND_KEY, String(Date.now()))
  if (db.trip) save({ ...db, trip: { ...db.trip, phase: 'binding', bindingProgress: 0.1 } })
  return { ...(await mockStartJob('binding')), bookId: 'b_new' }
}

const CHAPTERS = [
  { n: 1, day: 1, title: '한옥마을의 첫 저녁' },
  { n: 2, day: 2, title: '비 오는 날의 손님' },
  { n: 3, day: 3, title: '돌아오는 기차' },
]
export async function mockGetBook(id: string): Promise<Book> {
  await delay()
  const seeded = SEED_BOOKS.find((b) => b.id === id)
  const db = load()
  const found = db.books.find((b) => b.id === id)
  const isNew = id === 'b_new' || !seeded
  return {
    id,
    title: isNew ? '비 오는 날의 손님' : seeded.title,
    place: isNew ? '전주' : seeded.place,
    dateRange: '2026.07.13–07.15',
    coverType: coverOverride.get(id)?.coverType ?? found?.coverType ?? 'photo',
    coverColor: coverOverride.get(id)?.coverColor ?? found?.coverColor ?? 'red',
    coverPhotoUrl: found?.coverType === 'cloth' && !coverOverride.get(id) ? found.coverPhotoUrl : COVER_PHOTO_MAIN,
    stats: { days: 3, chapters: 3, photos: 118, voiceMinutes: 14 },
    chapters: CHAPTERS,
  }
}
const COVER_PHOTO_MAIN = '/img/cover-main.png'

// ── 리더 · 문체 · 표지 · 데이터 삭제 ──────────────────
import type { ChapterContent, Evidence, StyleName, UpdateCoverRequest } from './types'

const VOICE = 'mock://voice'
const FIRST: Record<StyleName, string> = {
  에세이: '오후 두 시쯤, 비가 갑자기 쏟아졌다. ',
  감성: '비는 예고도 없이, 우리를 골목 끝으로 데려갔다. ',
  동화: '비가 톡톡 내리던 날, 두 친구는 작은 카페로 쏙 들어갔어요. ',
}
const CAFE: Evidence = { photoUrl: '/img/evidence-photo.png', photoLabel: '사진 · 16:52 골목 카페', photoNote: '비 내리던 골목의 작은 카페', transcript: '비 왔어요 갑자기. 우산 없어서 골목 카페 들어갔는데…', audioUrl: VOICE, interviewLabel: '인터뷰 · 2일차' }

let currentStyle: StyleName = '에세이'
export async function mockGetChapterContent(_bookId: string, n: number): Promise<ChapterContent> {
  await delay()
  const style = currentStyle
  if (n === 1) {
    return { n, total: 3, label: '1일차 · 한옥마을', title: '한옥마을의 첫 저녁', photoUrl: '/img/photo-1.png', photoCaption: '18:20 · 한옥마을', paragraphs: [{ sentences: [{ text: '해가 기울 무렵 한옥마을에 닿았다. ' }, { text: '골목마다 등이 하나씩 켜졌고, 우리는 말없이 오래 걸었다.', evidence: { photoUrl: '/img/photo-1.png', photoLabel: '사진 · 18:20 한옥마을', photoNote: '등이 켜지던 골목', transcript: '도착하자마자 골목이 너무 예뻐서 말을 못 했어요.', audioUrl: VOICE, interviewLabel: '인터뷰 · 1일차' } }] }], page: 3, pages: 61, style }
  }
  if (n === 3) {
    return { n, total: 3, label: '3일차 · 돌아오는 길', title: '돌아오는 기차', photoUrl: '/img/photo-6.png', photoCaption: '17:40 · 전주역', paragraphs: [{ sentences: [{ text: '기차 창밖으로 분홍빛 노을이 길게 번졌다. ', evidence: { photoUrl: '/img/photo-6.png', photoLabel: '사진 · 17:40 전주역', photoNote: '창밖의 노을', transcript: '분홍 노을.', audioUrl: VOICE, interviewLabel: '인터뷰 · 3일차' } }, { text: '여행은 끝났지만 오늘 하루만큼은 오래 기억할 것 같았다.' }] }], pullQuote: { text: '“분홍 노을.”', audioUrl: VOICE, seconds: 4, transcript: '분홍 노을.' }, page: 52, pages: 61, style }
  }
  return {
    n: 2, total: 3, label: '2일차 · 비 오는 전주', title: '비 오는 날의 손님', photoUrl: '/img/reader-photo.png', photoCaption: '16:52 · 골목 카페',
    paragraphs: [{ sentences: [{ text: FIRST[style] }, { text: '우산이 없던 우리는 골목의 작은 카페로 뛰어들었다.', evidence: CAFE }, { text: ' 할머니 혼자 꾸려 가는 곳이었고, 손님은 우리 둘뿐이었다.' }] }],
    pullQuote: { text: '“비 오는 날 온 손님은 꼭 다시 와.”', audioUrl: VOICE, seconds: 12, transcript: '비 오는 날 온 손님은 꼭 다시 와.' },
    page: 24, pages: 61, style,
  }
}

export async function mockRestyle(style: StyleName): Promise<{ jobId: string }> {
  const r = await mockStartJob('restyle')
  currentStyle = style
  return r
}

export async function mockUpdateCover(bookId: string, body: UpdateCoverRequest): Promise<void> {
  await delay()
  const db = load()
  save({ ...db, books: db.books.map((b) => (b.id === bookId ? { ...b, coverType: body.coverType, coverColor: body.coverColor } : b)) })
  coverOverride.set(bookId, body)
}
const coverOverride = new Map<string, UpdateCoverRequest>()

export async function mockDeleteMyData(): Promise<void> {
  await delay()
  try {
    ;['yhm.mock', 'yhm.mock.meta', 'yhm.mock.bind'].forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
