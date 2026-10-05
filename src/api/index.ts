import { mockCreateTrip, mockCreateUser, mockGetBookshelf, mockDeleteMyData, mockFinishTrip, mockGetChapterContent, mockRestyle, mockUpdateCover, mockGetBook, mockGetChapter, mockGetTrip, mockInterviewAnswer, mockInterviewStart, mockJobStatus, mockPutPhoto, mockScenes, mockStartJob, mockUploadUrls } from './mock'
import type { Book, BookshelfResponse, ChapterContent, StyleName, UpdateCoverRequest, ChapterDraft, FinishTripResponse, CreateTripRequest, CreateTripResponse, CreateUserResponse, InterviewAnswerResponse, InterviewStartResponse, JobResponse, JobStatusResponse, ScenesResponse, TripInfo, UploadUrlsResponse } from './types'
import { getSession } from '../lib/session'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const userId = getSession()?.userId
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(userId ? { 'X-User-Id': userId } : {}), ...init.headers },
    })
  } catch {
    throw new ApiError('네트워크에 연결할 수 없어요')
  }
  if (!res.ok) throw new ApiError('서버에서 응답을 받지 못했어요', res.status)
  return (await res.json()) as T
}

export const api = {
  createUser: (nickname: string): Promise<CreateUserResponse> =>
    USE_MOCK ? mockCreateUser(nickname) : request('/users', { method: 'POST', body: JSON.stringify({ nickname }) }),

  getBookshelf: (): Promise<BookshelfResponse> => (USE_MOCK ? mockGetBookshelf() : request('/bookshelf')),

  createTrip: (body: CreateTripRequest): Promise<CreateTripResponse> =>
    USE_MOCK ? mockCreateTrip(body) : request('/trips', { method: 'POST', body: JSON.stringify(body) }),

  getTrip: (tripId: string): Promise<TripInfo> => (USE_MOCK ? mockGetTrip(tripId) : request(`/trips/${tripId}`)),

  getUploadUrls: (tripId: string, day: number, count: number): Promise<UploadUrlsResponse> =>
    USE_MOCK ? mockUploadUrls(count) : request(`/trips/${tripId}/days/${day}/photos/upload-urls`, { method: 'POST', body: JSON.stringify({ count }) }),

  /** 서버가 준 업로드 주소로 사진을 직접 올린다 */
  putPhoto: async (url: string, file: File | undefined, index: number): Promise<void> => {
    if (USE_MOCK) return mockPutPhoto(index)
    const res = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file?.type ?? 'image/jpeg' } })
    if (!res.ok) throw new ApiError('사진을 올리지 못했어요', res.status)
  },

  analyze: (tripId: string, day: number): Promise<JobResponse> =>
    USE_MOCK ? mockStartJob('analyze') : request(`/trips/${tripId}/days/${day}/analyze`, { method: 'POST' }),

  getJob: (jobId: string): Promise<JobStatusResponse> => (USE_MOCK ? mockJobStatus(jobId) : request(`/jobs/${jobId}`)),

  getScenes: (tripId: string, day: number): Promise<ScenesResponse> =>
    USE_MOCK ? mockScenes() : request(`/trips/${tripId}/days/${day}/scenes`),

  startInterview: (tripId: string, day: number): Promise<InterviewStartResponse> =>
    USE_MOCK ? mockInterviewStart() : request(`/trips/${tripId}/days/${day}/interview/start`, { method: 'POST' }),

  /** 녹음 파일(건너뛰면 null)을 보내고 다음 질문을 받는다 */
  answerInterview: async (tripId: string, day: number, audio: Blob | null): Promise<InterviewAnswerResponse> => {
    if (USE_MOCK) return mockInterviewAnswer(audio === null)
    const form = new FormData()
    if (audio) form.append('audio', audio, `answer.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
    else form.append('skip', 'true')
    const userId = getSession()?.userId
    let res: Response
    try {
      res = await fetch(`${BASE}/trips/${tripId}/days/${day}/interview/answer`, { method: 'POST', body: form, headers: userId ? { 'X-User-Id': userId } : {} })
    } catch {
      throw new ApiError('네트워크에 연결할 수 없어요')
    }
    if (!res.ok) throw new ApiError('답변을 보내지 못했어요', res.status)
    return (await res.json()) as InterviewAnswerResponse
  },

  /** 오늘의 챕터 초안 만들기 시작 → jobId */
  createChapter: (tripId: string, day: number): Promise<JobResponse> =>
    USE_MOCK ? mockStartJob('chapter') : request(`/trips/${tripId}/days/${day}/chapter`, { method: 'POST' }),

  getChapter: (tripId: string, day: number): Promise<ChapterDraft> =>
    USE_MOCK ? mockGetChapter() : request(`/trips/${tripId}/days/${day}/chapter`),

  /** 여행을 마치고 책 만들기 시작 */
  finishTrip: (tripId: string): Promise<FinishTripResponse> =>
    USE_MOCK ? mockFinishTrip() : request(`/trips/${tripId}/finish`, { method: 'POST' }),

  getBook: (bookId: string): Promise<Book> => (USE_MOCK ? mockGetBook(bookId) : request(`/books/${bookId}`)),

  getBookChapter: (bookId: string, n: number): Promise<ChapterContent> =>
    USE_MOCK ? mockGetChapterContent(bookId, n) : request(`/books/${bookId}/chapters/${n}`),

  restyle: (bookId: string, style: StyleName): Promise<JobResponse> =>
    USE_MOCK ? mockRestyle(style) : request(`/books/${bookId}/restyle`, { method: 'POST', body: JSON.stringify({ style }) }),

  updateCover: (bookId: string, body: UpdateCoverRequest): Promise<void> =>
    USE_MOCK ? mockUpdateCover(bookId, body) : request(`/books/${bookId}/cover`, { method: 'PATCH', body: JSON.stringify(body) }),

  /** 내 데이터 삭제 */
  deleteMyData: (): Promise<void> => (USE_MOCK ? mockDeleteMyData() : request('/users/me', { method: 'DELETE' })),
}
