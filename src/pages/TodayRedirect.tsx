import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { Screen } from '../components'

/** 하단 "오늘" 탭: 진행 중인 여행이 있으면 오늘 화면으로, 없으면 새 여행으로 */
export default function TodayRedirect() {
  const q = useQuery({ queryKey: ['bookshelf'], queryFn: api.getBookshelf })
  if (q.isPending) return <Screen><p style={{ padding: 20, color: 'var(--ink-soft)' }}>오늘을 불러오는 중이에요…</p></Screen>
  const trip = q.data?.inProgressTrip
  if (!trip) return <Navigate to="/trips/new" replace />
  return <Navigate to={trip.phase === 'todayDone' ? `/trips/${trip.id}/today/draft` : trip.phase === 'binding' ? `/trips/${trip.id}/binding` : `/trips/${trip.id}/today/upload`} replace />
}
