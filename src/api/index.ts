import { mockCreateTrip, mockCreateUser, mockEndInterview, mockGetMe, mockUpdateSettings, mockGetBookshelf, mockDeleteMyData, mockFinishTrip, mockGetChapterContent, mockRestyle, mockGetBook, mockGetChapter, mockGetTrip, mockInterviewAnswer, mockInterviewStart, mockJobStatus, mockPutPhoto, mockScenes, mockStartJob, mockUploadUrls } from './mock'
import type { Book, BookshelfResponse, ChapterContent, StyleCode, EndInterviewRequest, MeResponse, UpdateSettingsRequest, ChapterDraft, FinishTripResponse, CreateTripRequest, CreateTripResponse, CreateUserResponse, InterviewAnswerResponse, InterviewStartResponse, JobResponse, JobStatusResponse, ScenesResponse, TripInfo, UploadUrlsResponse } from './types'
import { ApiError, toApiError } from './error'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export { ApiError }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    // 로그인이 없고 서버가 준 HttpOnly 쿠키로 사용자를 구별한다 → 쿠키를 항상 함께 보낸다
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new ApiError('네트워크에 연결할 수 없어요')
  }
  if (!res.ok) throw await toApiError(res, '서버에서 응답을 받지 못했어요')
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  /** 쿠키가 유효하면 사용자 정보, 없으면 401 */
  getMe: (): Promise<MeResponse> => (USE_MOCK ? mockGetMe() : request('/users/me')),

  updateSettings: (body: UpdateSettingsRequest): Promise<MeResponse> =>
    USE_MOCK ? mockUpdateSettings(body) : request('/users/me/settings', { method: 'PUT', body: JSON.stringify(body) }),

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

  /**
   * 녹음 파일(건너뛰면 null)을 보내고 다음 질문을 받는다.
   * index(질문 번호)를 함께 보내면 "다시 보내기"가 어느 질문의 재전송인지 서버가 정확히 가린다(같은 결과를 다시 돌려준다).
   */
  answerInterview: async (tripId: string, day: number, audio: Blob | null, index?: number): Promise<InterviewAnswerResponse> => {
    if (USE_MOCK) return mockInterviewAnswer(audio === null)
    const form = new FormData()
    if (audio) form.append('audio', audio, `answer.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
    else form.append('skip', 'true')
    if (index !== undefined) form.append('index', String(index))
    let res: Response
    try {
      res = await fetch(`${BASE}/trips/${tripId}/days/${day}/interview/answer`, { method: 'POST', body: form, credentials: 'include' })
    } catch {
      throw new ApiError('네트워크에 연결할 수 없어요')
    }
    if (!res.ok) throw await toApiError(res, '답변을 보내지 못했어요')
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

  restyle: (bookId: string, style: StyleCode): Promise<JobResponse> =>
    USE_MOCK ? mockRestyle(style) : request(`/books/${bookId}/restyle`, { method: 'POST', body: JSON.stringify({ style }) }),

  /** 내 데이터 삭제 */
  deleteMyData: (): Promise<void> => (USE_MOCK ? mockDeleteMyData() : request('/users/me', { method: 'DELETE' })),

  /** 인터뷰를 끝낸다: SAVE_EXIT(지금까지 저장) / DISCARD(저장 안 함, 이번 인터뷰 음성·전사 삭제) */
  endInterview: (tripId: string, day: number, type: EndInterviewRequest['type']): Promise<void> =>
    USE_MOCK ? mockEndInterview() : request(`/trips/${tripId}/days/${day}/interview/end`, { method: 'POST', body: JSON.stringify({ type }) }),
}
