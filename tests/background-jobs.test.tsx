// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api'
import Shelf from '../src/pages/Shelf'
import Writing from '../src/pages/Writing'
import Binding from '../src/pages/Binding'
import Draft from '../src/pages/Draft'
import TodayRedirect from '../src/pages/TodayRedirect'
import ResumeTrip from '../src/pages/ResumeTrip'
import Reader from '../src/pages/Reader'
import Complete from '../src/pages/Complete'
import { BINDING_PREVIEW_KEY, type BindingPreview } from '../src/lib/useBindingPreview'
import type { BookshelfResponse, InProgressTrip, TripInfo } from '../src/api/types'

vi.mock('../src/api', () => ({ api: {
  getBookshelf: vi.fn(), getJob: vi.fn(), getTrip: vi.fn(),
  createChapter: vi.fn(), finishTrip: vi.fn(), getChapter: vi.fn(), getBook: vi.fn(), getBookChapter: vi.fn(),
} }))

const clients: QueryClient[] = []
const pending: InProgressTrip = {
  id: '1', place: '전주', day: 1, phase: 'writing', nextStep: 'writing', jobStatus: 'running',
}
const trip: TripInfo = {
  id: '1', place: '전주', startDate: '2026-10-12', endDate: '2026-10-12', day: 1,
  totalDays: 1, dateLabel: '10월 12일', currentDay: 1,
  days: [{ day: 1, dateLabel: '10월 12일', status: 'FAILED', nextStep: 'writing', photoCount: 1 }],
}
function NextDayUpload() {
  const [params] = useSearchParams()
  return <p>{params.get('day')}일차 사진 올리기</p>
}
function open(path = '/', realDraft = false, realBook = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  render(<StrictMode><QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/" element={<Shelf />} />
      <Route path="/today" element={<TodayRedirect />} />
      <Route path="/trips/:id/today" element={<ResumeTrip />} />
      <Route path="/trips/:id/today/upload" element={<NextDayUpload />} />
      <Route path="/trips/:id/today/writing" element={<Writing />} />
      <Route path="/trips/:id/binding" element={<Binding />} />
      <Route path="/trips/:id/today/draft" element={realDraft ? <Draft /> : <p>완성된 초안</p>} />
      <Route path="/books/:id/complete" element={realBook ? <Complete /> : <p>완성된 책</p>} />
      <Route path="/books/:id/read" element={<Reader />} />
    </Routes></MemoryRouter>
  </QueryClientProvider></StrictMode>)
  return client
}
const tick = async (ms = 50) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); vi.mocked(api.getTrip).mockResolvedValue(trip) })
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.useRealTimers() })

describe('책장에서 기다리기', () => {
  const completed: InProgressTrip = { ...pending, phase: 'todayDone', nextStep: 'draft', jobStatus: undefined }
  const multiDay: TripInfo = { ...trip, startDate: '2026-10-06', endDate: '2026-10-08', day: 3,
    totalDays: 3, currentDay: 2, days: [
      { day: 1, dateLabel: '10월 6일', status: 'DONE', nextStep: 'draft', photoCount: 1 },
      { day: 2, dateLabel: '10월 7일', status: 'READY', nextStep: 'upload', photoCount: 0 },
      { day: 3, dateLabel: '10월 8일', status: 'READY', nextStep: 'upload', photoCount: 0 },
    ] }
  function completedApis() {
    vi.mocked(api.getTrip).mockResolvedValue(multiDay)
    vi.mocked(api.getChapter).mockResolvedValue({ label: '1일차 · 전주', title: '골목의 하루',
      body: '첫날 골목에서 남긴 이야기', moments: [] })
  }

  it('1일차 완성 후 현재 작성 일차가 2일차여도 1일차 이야기를 먼저 읽고 다음 일차를 선택한다', async () => {
    completedApis()
    let data: BookshelfResponse = { nickname: '테스트', inProgressTrip: pending, books: [] }
    vi.mocked(api.getBookshelf).mockImplementation(async () => data)
    open('/', true)
    await tick()
    data = { ...data, inProgressTrip: completed }
    await tick(2100)
    expect(screen.queryByText('오늘 사진 올리기')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '완성된 이야기 보기' }))
    await tick(100)
    expect(vi.mocked(api.getChapter)).toHaveBeenCalledWith('1', 1)
    expect(screen.getByText('첫날 골목에서 남긴 이야기')).toBeTruthy()
    expect(screen.queryByText('2일차 사진 올리기')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '2일차 기록하기' }))
    await tick(100)
    expect(screen.getByText('2일차 사진 올리기')).toBeTruthy()
  })

  it('오늘 탭으로 다시 들어가도 다음 미완료 일차 대신 완성된 일차의 이야기를 연다', async () => {
    completedApis()
    vi.mocked(api.getBookshelf).mockResolvedValue({ nickname: '테스트', inProgressTrip: completed, books: [] })
    open('/today', true)
    await tick(150)
    await tick(100)
    expect(vi.mocked(api.getChapter)).toHaveBeenCalledWith('1', 1)
    expect(screen.getByText('첫날 골목에서 남긴 이야기')).toBeTruthy()
    expect(screen.queryByText('2일차 사진 올리기')).toBeNull()
  })

  it('다른 화면으로 들어가지 않아도 작성 완료 상태와 초안 버튼을 갱신한다', async () => {
    let data: BookshelfResponse = { nickname: '테스트', inProgressTrip: pending, books: [] }
    vi.mocked(api.getBookshelf).mockImplementation(async () => data)
    open()
    await tick()
    expect(screen.getByText('오늘의 이야기를 쓰고 있어요')).toBeTruthy()
    data = { ...data, inProgressTrip: { ...pending, phase: 'todayDone', nextStep: 'draft', jobStatus: undefined } }
    await tick(2100)
    expect(screen.getByText('오늘의 이야기가 완성됐어요')).toBeTruthy()
    fireEvent.click(screen.getByText('완성된 이야기 보기'))
    await tick()
    expect(screen.getByText('완성된 초안')).toBeTruthy()
  })

  it('책 엮기가 완료되면 책장에 새 책을 자동으로 표시하고 폴링을 멈춘다', async () => {
    let data: BookshelfResponse = { nickname: '테스트', inProgressTrip: { ...pending, phase: 'binding' }, books: [] }
    vi.mocked(api.getBookshelf).mockImplementation(async () => data)
    open()
    await tick()
    expect(screen.getByText('곧 책장에 꽂힐 거예요')).toBeTruthy()
    data = { ...data, inProgressTrip: null, books: [{ id: '1', title: '골목의 기록', place: '전주',
      dateLabel: '2026.10', days: 1, coverColor: 'red', shelfStyle: 'cover' }] }
    await tick(2100)
    expect(screen.getByRole('button', { name: '골목의 기록' })).toBeTruthy()
    const calls = vi.mocked(api.getBookshelf).mock.calls.length
    await tick(4100)
    expect(vi.mocked(api.getBookshelf).mock.calls.length).toBe(calls)
  })

  it('책 엮기 실패를 진행 중으로 표시하지 않고 재시도 진입 버튼을 제공한다', async () => {
    vi.mocked(api.getBookshelf).mockResolvedValue({ nickname: '테스트', inProgressTrip: {
      ...pending, phase: 'binding', jobStatus: 'failed' }, books: [] })
    open()
    await tick()
    expect(screen.queryByText('곧 책장에 꽂힐 거예요')).toBeNull()
    expect(screen.getByRole('button', { name: '책 엮기 다시 시도' })).toBeTruthy()
  })

  it('책장에서 숫자 없는 진행 막대를 표시하고 서버 진행률에 따라 갱신한다', async () => {
    let data: BookshelfResponse = { nickname: '테스트', inProgressTrip: {
      ...pending, phase: 'binding', bindingProgress: 0 }, books: [] }
    vi.mocked(api.getBookshelf).mockImplementation(async () => data)
    open()
    await tick()
    const bar = screen.getByRole('progressbar', { name: '책 엮기 진행' })
    expect(bar.textContent).toBe('')
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
    data = { ...data, inProgressTrip: { ...data.inProgressTrip!, bindingProgress: 0.67 } }
    await tick(2100)
    expect(bar.getAttribute('aria-valuenow')).toBe('67')
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('67%')
  })
})

describe('완성된 이야기 탐색과 마지막 일차', () => {
  const fullTrip: TripInfo = { ...trip, startDate: '2026-10-06', endDate: '2026-10-08', day: 3,
    totalDays: 3, currentDay: 3, days: [1, 2, 3].map(day => ({
      day, dateLabel: `10월 ${day + 5}일`, status: 'DONE', nextStep: 'draft' as const, photoCount: 1,
    })) }
  function stories() {
    vi.mocked(api.getTrip).mockResolvedValue(fullTrip)
    vi.mocked(api.getChapter).mockImplementation(async (_id, day) => ({
      label: `${day}일차 · 전주`, title: `${day}일차 제목`, body: `${day}일차에 남긴 이야기`, moments: [],
    }))
  }

  it('뒤로 가지 않아도 이야기 아래에서 이전·다음 일차의 본문으로 이동한다', async () => {
    stories()
    open('/trips/1/today/draft?day=2', true)
    await tick(100)
    fireEvent.click(screen.getByRole('button', { name: '1일차 이야기' }))
    await tick(100)
    expect(screen.getByText('1일차에 남긴 이야기')).toBeTruthy()
    expect((screen.getByRole('button', { name: '이전 일차' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '2일차 이야기' }))
    await tick(100)
    fireEvent.click(screen.getByRole('button', { name: '3일차 이야기' }))
    await tick(100)
    expect(screen.getByText('3일차에 남긴 이야기')).toBeTruthy()
    expect((screen.getByRole('button', { name: '다음 일차' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '2일차 이야기' }).textContent).toBe('') // 화살표만 보인다
    expect(screen.queryByText('포착 순간')).toBeNull() // 빈 순간 목록을 위한 공간을 만들지 않는다
  })

  it('빠르게 완성된 책도 책장에서 마무리 막대를 보여 준 뒤 표지로 전환한다', async () => {
    stories()
    const finished: BookshelfResponse = { nickname: '테스트', inProgressTrip: null, books: [{
      id: '1', title: '전주 여행책', place: '전주', dateLabel: '2026.10', days: 3,
      coverColor: 'red', shelfStyle: 'cover',
    }] }
    vi.mocked(api.getBookshelf).mockResolvedValue(finished)
    vi.mocked(api.getJob).mockResolvedValue({ status: 'done', progress: 1 })
    vi.mocked(api.finishTrip).mockResolvedValue({ jobId: 'fast-bind', bookId: '1' })
    vi.mocked(api.getBook).mockResolvedValue({ id: '1', title: '전주 여행책', place: '전주',
      dateRange: '2026.10.06–10.08', stats: { days: 3, chapters: 3, photos: 3, voiceMinutes: 1 },
      chapters: [1, 2, 3].map(n => ({ n, day: n, title: `${n}일차 제목` })),
    })
    open('/trips/1/today/draft?day=3', true, true)
    await tick(100)
    fireEvent.click(screen.getByRole('button', { name: '여행 마치고 책 만들기' }))
    await tick(100)
    await tick(100)
    await tick(100)
    fireEvent.click(screen.getByRole('button', { name: '책장에 꽂기' }))
    await tick(100)
    expect(screen.getByRole('progressbar', { name: '책 엮기 진행' })).toBeTruthy()
    expect(screen.getByText('책장에 꽂고 있어요')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '전주 여행책' })).toBeNull()
    await tick(900)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('button', { name: '전주 여행책' })).toBeTruthy()
  })

  it('이미 완료된 응답을 받으며 책장에서 기다려도 진행 카드가 바로 사라지지 않는다', async () => {
    const client = open('/')
    const preview: BindingPreview = { trip: { ...pending, phase: 'binding' }, jobId: 'fast', bookId: '1' }
    vi.mocked(api.getJob).mockResolvedValue({ status: 'done', progress: 1 })
    vi.mocked(api.getBookshelf).mockResolvedValue({ nickname: '테스트', inProgressTrip: null, books: [{
      id: '1', title: '완성 책', place: '전주', dateLabel: '2026.10', days: 3, coverColor: 'red', shelfStyle: 'cover',
    }] })
    await act(async () => { client.setQueryData(BINDING_PREVIEW_KEY, preview) })
    await tick(100)
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '완성 책' })).toBeNull()
    await tick(900)
    expect(screen.getByRole('button', { name: '완성 책' })).toBeTruthy()
  })

  it('마지막 이야기가 완성되면 추가 기록 대신 책 만들기와 책장 복귀를 안내한다', async () => {
    stories()
    open('/trips/1/today/draft?day=3', true)
    await tick(100)
    expect(screen.getByText('여행의 이야기가 모두 완성됐어요. 이제 한 권으로 엮어 보세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '여행 마치고 책 만들기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '책장으로 돌아가기' })).toBeTruthy()
    expect(screen.queryByText('하루 더 기록하기')).toBeNull()
    expect(screen.queryByText('책장에서 기다리기')).toBeNull()
  })

  it('마지막 일차 생성 중에도 다음 기록을 기다리는 버튼을 표시하지 않는다', async () => {
    vi.mocked(api.getTrip).mockResolvedValue({ ...fullTrip, days: fullTrip.days!.map(d => d.day === 3
      ? { ...d, status: 'WRITING', nextStep: 'writing', jobId: 'final' } : d) })
    vi.mocked(api.getJob).mockResolvedValue({ status: 'running', progress: 0.5 })
    open('/trips/1/today/writing?day=3')
    await tick(100)
    expect(screen.getByRole('button', { name: '책장으로 돌아가기' })).toBeTruthy()
    expect(screen.queryByText('책장에서 기다리기')).toBeNull()
  })

  it('책 만들기 요청부터 책장 캐시를 엮는 중으로 바꾸고 실패하면 복구한다', async () => {
    stories()
    const client = open('/trips/1/today/draft?day=3', true)
    const original: BookshelfResponse = { nickname: '테스트', inProgressTrip: {
      ...pending, day: 3, phase: 'todayDone', nextStep: 'draft', jobStatus: undefined }, books: [] }
    await act(async () => { client.setQueryData(['bookshelf'], original) })
    await tick(100)
    let reject!: (reason: Error) => void
    vi.mocked(api.finishTrip).mockImplementation(() => new Promise((_resolve, r) => { reject = r }))
    fireEvent.click(screen.getByRole('button', { name: '여행 마치고 책 만들기' }))
    await tick()
    expect(client.getQueryData<BookshelfResponse>(['bookshelf'])?.inProgressTrip?.phase).toBe('binding')
    expect(client.getQueryData<BookshelfResponse>(['bookshelf'])?.inProgressTrip?.bindingProgress).toBe(0)
    await act(async () => { reject(new Error('통신 오류')) })
    await tick()
    expect(client.getQueryData<BookshelfResponse>(['bookshelf'])?.inProgressTrip?.phase).toBe('todayDone')
  })
})

describe('책으로 엮은 뒤 일차 이동', () => {
  it('완성된 책에서도 보이는 화살표로 실제 다음·이전 이야기 본문을 읽는다', async () => {
    vi.mocked(api.getBookChapter).mockImplementation(async (_id, n) => ({
      n, total: 2, label: `${n === 1 ? 1 : 3}일차 · 전주`, title: `${n}번째 챕터`,
      paragraphs: [{ sentences: [{ text: `${n === 1 ? 1 : 3}일차 완성된 책의 본문` }] }],
      page: n, pages: 2, style: 'EMOTIONAL',
    }))
    open('/books/1/read?n=1')
    await tick(100)
    expect((screen.getByRole('button', { name: '이전 일차 이야기' }) as HTMLButtonElement).disabled).toBe(true)
    const next = screen.getByRole('button', { name: '다음 일차 이야기' })
    expect(next.querySelector('svg')).toBeTruthy()
    expect(next.textContent).toBe('')
    fireEvent.click(next)
    await tick(100)
    expect(vi.mocked(api.getBookChapter)).toHaveBeenCalledWith('1', 2)
    expect(screen.getByText('3일차 완성된 책의 본문')).toBeTruthy()
    expect((screen.getByRole('button', { name: '다음 일차 이야기' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '이전 일차 이야기' }))
    await tick(100)
    expect(screen.getByText('1일차 완성된 책의 본문')).toBeTruthy()
  })
})

describe('작업 시작과 재시도', () => {
  it('실패한 이야기를 재시도할 때 중복 시작 없이 새 작업을 추적한다', async () => {
    vi.mocked(api.getTrip).mockResolvedValue(trip)
    vi.mocked(api.getJob).mockImplementation(async id => ({ status: id === 'old' ? 'failed' : 'running', progress: 0 }))
    vi.mocked(api.createChapter).mockResolvedValueOnce({ jobId: 'old' })
    open('/trips/1/today/writing?day=1')
    await tick(100)
    expect(vi.mocked(api.createChapter)).toHaveBeenCalledTimes(1)
    expect(screen.getByText('이야기를 다 쓰지 못했어요')).toBeTruthy()
    let resolve!: (v: { jobId: string }) => void
    vi.mocked(api.createChapter).mockImplementation(() => new Promise(r => { resolve = r }))
    fireEvent.click(screen.getByRole('button', { name: '다시 쓰기' }))
    await tick()
    expect(vi.mocked(api.createChapter)).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('이야기를 다 쓰지 못했어요')).toBeNull()
    expect((screen.getByText('책장으로 돌아가기') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { resolve({ jobId: 'new' }) })
    await tick()
    expect(vi.mocked(api.getJob)).toHaveBeenCalledWith('new')
    expect(vi.mocked(api.createChapter)).toHaveBeenCalledTimes(2)
  })

  it('책 엮기 시작 응답을 기다린 뒤 책장으로 나가도 서버 완료를 자동 반영한다', async () => {
    let data: BookshelfResponse = { nickname: '테스트', inProgressTrip: { ...pending, phase: 'binding' }, books: [] }
    vi.mocked(api.getBookshelf).mockImplementation(async () => data)
    vi.mocked(api.getJob).mockResolvedValue({ status: 'running', progress: 0.3 })
    let resolve!: (v: { jobId: string; bookId: string }) => void
    vi.mocked(api.finishTrip).mockImplementation(() => new Promise(r => { resolve = r }))
    open('/trips/1/binding')
    await tick()
    expect(vi.mocked(api.finishTrip)).toHaveBeenCalledTimes(1)
    expect((screen.getByText('책장에서 기다리기') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { resolve({ jobId: 'bind', bookId: '1' }) })
    await tick()
    fireEvent.click(screen.getByText('책장에서 기다리기'))
    await tick()
    expect(screen.getByText('곧 책장에 꽂힐 거예요')).toBeTruthy()
    data = { ...data, inProgressTrip: null, books: [{ id: '1', title: '완성된 여행', place: '전주',
      dateLabel: '2026.10', days: 1, coverColor: 'red', shelfStyle: 'cover' }] }
    await tick(2100)
    expect(screen.getByText('책장에 꽂고 있어요')).toBeTruthy()
    await tick(900)
    expect(screen.getByRole('button', { name: '완성된 여행' })).toBeTruthy()
  })
})
