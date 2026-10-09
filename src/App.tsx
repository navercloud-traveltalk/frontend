import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ApiError } from './api/error'
import { Button, Screen } from './components'
import { useMe } from './lib/me'
import Binding from './pages/Binding'
import BookDetail from './pages/BookDetail'
import Call from './pages/call/Call'
import Complete from './pages/Complete'
import Draft from './pages/Draft'
import NewTrip from './pages/NewTrip'
import Reader from './pages/Reader'
import ResumeTrip from './pages/ResumeTrip'
import Settings from './pages/Settings'
import Shelf from './pages/Shelf'
import Scenes from './pages/Scenes'
import Start from './pages/Start'
import TodayRedirect from './pages/TodayRedirect'
import Upload from './pages/Upload'
import Writing from './pages/Writing'

const is401 = (e: unknown) => e instanceof ApiError && e.status === 401

const queryClient: QueryClient = new QueryClient({
  // 쿠키가 만료돼 어떤 요청이든 401 이 오면 사용자 확인을 다시 하게 해 /start 로 보낸다
  queryCache: new QueryCache({ onError: (e, q) => { if (is401(e) && q.queryKey[0] !== 'me') void queryClient.invalidateQueries({ queryKey: ['me'] }) } }),
  defaultOptions: { queries: { retry: (n, e) => !is401(e) && n < 1, refetchOnWindowFocus: false } },
})

function Loading() {
  return <Screen><p style={{ padding: 20, color: 'var(--ink-soft)' }}>잠깐만요…</p></Screen>
}

/** 쿠키로 확인된 사용자가 없으면 어느 경로로 들어와도 /start 로 보낸다 */
function RequireUser() {
  const me = useMe()
  if (me.isPending) return <Loading />
  if (me.isError) {
    if (is401(me.error)) return <Navigate to="/start" replace />
    return (
      <Screen>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', textAlign: 'center' }}>
          <p>서버에 연결하지 못했어요.<br />저장된 책은 그대로 있어요.</p>
          <Button onClick={() => me.refetch()}>다시 시도</Button>
        </div>
      </Screen>
    )
  }
  return <Outlet />
}

function StartGate() {
  const me = useMe()
  if (me.isPending) return <Loading />
  return me.isSuccess ? <Navigate to="/" replace /> : <Start />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/start" element={<StartGate />} />
            <Route element={<RequireUser />}>
              <Route path="/" element={<Shelf />} />
              <Route path="/today" element={<TodayRedirect />} />
              <Route path="/trips/new" element={<NewTrip />} />
              <Route path="/trips/:id/today" element={<ResumeTrip />} />
              <Route path="/trips/:id/today/upload" element={<Upload />} />
              <Route path="/trips/:id/today/scenes" element={<Scenes />} />
              <Route path="/trips/:id/today/call" element={<Call />} />
              <Route path="/trips/:id/today/writing" element={<Writing />} />
              <Route path="/trips/:id/today/draft" element={<Draft />} />
              <Route path="/trips/:id/binding" element={<Binding />} />
              <Route path="/books/:id/complete" element={<Complete />} />
              <Route path="/books/:id" element={<BookDetail />} />
              <Route path="/books/:id/read" element={<Reader />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
