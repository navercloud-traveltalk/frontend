import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Header, Screen, SceneCard } from '../components'
import s from './Scenes.module.css'
import { stepPath, useTripStep } from '../lib/steps'

export default function Scenes() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { trip, day } = useTripStep(id, ['scenes', 'call'])
  const q = useQuery({ queryKey: ['scenes', id, day], queryFn: () => api.getScenes(id, day), enabled: !!trip.data })
  const scenes = q.data?.scenes

  return (
    <Screen>
      <Header title={scenes ? `장면 ${scenes.length}개를 찾았어요` : '장면을 불러오는 중'} onBack={() => nav('/')} />
      {q.isError || trip.isError ? (
        <div className={s.state}>
          <p>장면을 불러오지 못했어요.<br />올린 사진은 그대로 저장돼 있어요.</p>
          <Button onClick={() => { trip.refetch(); q.refetch() }}>다시 시도</Button>
        </div>
      ) : !scenes ? (
        <div className={s.state}><p>장면을 불러오는 중이에요…</p></div>
      ) : (
        <>
          <div className={s.body}>
            <div className={s.timeline}>
              <span className={s.line} />
              {scenes.map((sc) => (
                <SceneCard key={sc.id} gap={sc.gap} head={sc.gap || !sc.place ? sc.time : `${sc.time} · ${sc.place}`} title={sc.title} note={sc.note} thumbs={sc.thumbs} />
              ))}
            </div>
          </div>
          <div className={s.actions}>
            <Button variant="teal" onClick={() => nav(stepPath(id, 'call', day))}>인터뷰 시작하기</Button>
            <Button variant="text" onClick={() => nav('/')}>나중에 할게요</Button>
          </div>
        </>
      )}
    </Screen>
  )
}
