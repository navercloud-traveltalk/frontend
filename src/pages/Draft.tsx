import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Screen, Tag } from '../components'
import s from './Draft.module.css'
import { useTripStep } from '../lib/steps'

/** /trips/:id/today/draft — 오늘의 챕터 초안 (보통 날 / 마지막 날) */
export default function Draft() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { trip } = useTripStep(id, ['draft'])
  const day = trip.data?.day ?? 1
  const q = useQuery({ queryKey: ['chapter', id, day], queryFn: () => api.getChapter(id, day), enabled: !!trip.data })
  const finish = useMutation({
    mutationFn: () => api.finishTrip(id),
    onSuccess: ({ jobId, bookId }) => nav(`/trips/${id}/binding`, { replace: true, state: { jobId, bookId } }),
  })
  const lastDay = !!trip.data && trip.data.day >= trip.data.totalDays

  const back = () => nav('/')
  return (
    <Screen>
      <div className={s.head}>
        <button type="button" onClick={back} aria-label="책장으로"><img src="/img/chevron-left.svg" width={24} height={24} alt="" /></button>
        <h1>오늘의 이야기가 기록됐어요</h1>
      </div>
      {trip.isError || q.isError ? (
        <div className={s.state}>
          <p>챕터를 불러오지 못했어요.<br />오늘의 대화는 그대로 저장돼 있어요.</p>
          <Button onClick={() => { trip.refetch(); q.refetch() }}>다시 시도</Button>
        </div>
      ) : !q.data ? (
        <div className={s.state}><p>챕터를 불러오는 중이에요…</p></div>
      ) : (
        <div className={[s.content, lastDay && s.contentLast].filter(Boolean).join(' ')}>
          <article className={s.card}>
            <p className={s.label}>{q.data.label}</p>
            <h2 className={s.title}>{q.data.title}</h2>
            <span className={s.rule} />
            <div className={s.bodyText}>{q.data.body.split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
          </article>
          <section className={s.moments}>
            <p className={s.momentsLabel}>포착 순간</p>
            <div className={s.chips}>{q.data.moments.map((m) => <Tag key={m} size="md">{m}</Tag>)}</div>
          </section>
          <div className={s.bottom}>
            {lastDay ? (
              <>
                <p className={s.lastNote}>여행의 마지막 날이에요</p>
                <div className={s.buttons}>
                  <Button disabled={finish.isPending} onClick={() => finish.mutate()}>{finish.isPending ? '책을 엮기 시작하는 중…' : finish.isError ? '다시 시도' : '여행 마치고 책 만들기'}</Button>
                  <Button variant="text" onClick={back}>하루 더 기록하기</Button>
                </div>
                {finish.isError && <p className={s.err}>책 만들기를 시작하지 못했어요. 기록은 그대로 저장돼 있어요.</p>}
              </>
            ) : (
              <>
                <p className={s.note}>책은 여행이 끝나면 완성돼요</p>
                <Button onClick={back}>책장으로 돌아가기</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Screen>
  )
}


