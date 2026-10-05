import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Header, Screen, SceneCard } from '../components'
import s from './Scenes.module.css'

const PINS = [[36, 72], [128, 42], [228, 58], [312, 86]]

export default function Scenes() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const trip = useQuery({ queryKey: ['trip', id], queryFn: () => api.getTrip(id) })
  const day = trip.data?.day ?? 1
  const q = useQuery({ queryKey: ['scenes', id, day], queryFn: () => api.getScenes(id, day), enabled: !!trip.data })
  const scenes = q.data?.scenes

  return (
    <Screen>
      <Header title={scenes ? `장면 ${scenes.length}개를 찾았어요` : '장면을 불러오는 중'} onBack={() => nav(`/trips/${id}/today/upload`)} />
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
            <div className={s.map}>
              <img className={s.mapImg} src="/img/map.png" alt="" />
              <img className={s.route} src="/img/route.png" alt="" />
              {PINS.map(([x, y], i) => <img key={i} className={s.pin} src="/img/pin.svg" alt="" style={{ left: x, top: y }} />)}
            </div>
            <div className={s.timeline}>
              <span className={s.line} />
              {scenes.map((sc) => (
                <SceneCard key={sc.id} gap={sc.gap} head={sc.gap ? sc.time : `${sc.time} · ${sc.place}`} title={sc.title} note={sc.note} thumbs={sc.thumbs} />
              ))}
            </div>
          </div>
          <div className={s.actions}>
            <Button variant="teal" onClick={() => nav(`/trips/${id}/today/call`)}>인터뷰 시작하기</Button>
            <Button variant="text" onClick={() => nav('/')}>나중에 할게요</Button>
          </div>
        </>
      )}
    </Screen>
  )
}
