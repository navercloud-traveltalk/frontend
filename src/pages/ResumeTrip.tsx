import { Navigate, useParams } from 'react-router-dom'
import { Screen } from '../components'
import { stepPath, useTripStep } from '../lib/steps'

/** /trips/:id/today(?day=N) — 그 일차(없으면 지금 일차)에서 다음에 할 화면으로 보낸다(중단·뒤로 가기 뒤 재진입). */
export default function ResumeTrip() {
  const { id = '' } = useParams()
  const { trip, info, day, ready } = useTripStep(id)
  if (trip.isError) return <Navigate to="/" replace />
  if (!ready) return <Screen><p style={{ padding: 20, color: 'var(--ink-soft)' }}>이어서 할 일을 찾는 중이에요…</p></Screen>
  return <Navigate to={stepPath(id, info?.nextStep ?? 'upload', day)} replace />
}
