import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { Screen } from '../components'
import { stepPath } from '../lib/steps'

/** 하단 "오늘" 탭: 진행 중인 여행이 있으면 그 일차의 다음 단계 화면으로, 없으면 새 여행으로 */
export default function TodayRedirect() {
  const q = useQuery({ queryKey: ['bookshelf'], queryFn: api.getBookshelf })
  if (q.isPending) return <Screen><p style={{ padding: 20, color: 'var(--ink-soft)' }}>오늘을 불러오는 중이에요…</p></Screen>
  const trip = q.data?.inProgressTrip
  if (!trip) return <Navigate to="/trips/new" replace />
  if (trip.phase === 'binding') return <Navigate to={`/trips/${trip.id}/binding`} replace />
  // 서버가 정한 다음 단계로(이미 끝낸 단계를 다시 하지 않게). 값이 없으면 이전 동작
  if (trip.nextStep) return <Navigate to={stepPath(trip.id, trip.nextStep)} replace />
  return <Navigate to={trip.phase === 'todayDone' ? `/trips/${trip.id}/today/draft` : `/trips/${trip.id}/today/upload`} replace />
}
