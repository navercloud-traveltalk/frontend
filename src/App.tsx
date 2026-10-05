import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { getSession } from './lib/session'
import Binding from './pages/Binding'
import BookDetail from './pages/BookDetail'
import Call from './pages/call/Call'
import Complete from './pages/Complete'
import Draft from './pages/Draft'
import NewTrip from './pages/NewTrip'
import Reader from './pages/Reader'
import Settings from './pages/Settings'
import Shelf from './pages/Shelf'
import Scenes from './pages/Scenes'
import Start from './pages/Start'
import TodayRedirect from './pages/TodayRedirect'
import Upload from './pages/Upload'
import Writing from './pages/Writing'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

/** 사용자 ID가 없으면 어느 경로로 들어와도 /start 로 보낸다 */
function RequireUser() {
  return getSession() ? <Outlet /> : <Navigate to="/start" replace />
}

function StartGate() {
  return getSession() ? <Navigate to="/" replace /> : <Start />
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
