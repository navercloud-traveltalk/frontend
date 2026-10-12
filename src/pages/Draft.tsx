import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Screen, Tag } from '../components'
import { DayNavigation } from '../components/DayNavigation'
import s from './Draft.module.css'
import { nextOpenDay, resumePath, stepPath, useTripStep } from '../lib/steps'
import { useFinishTrip } from '../lib/useFinishTrip'

/** /trips/:id/today/draft — 오늘의 챕터 초안 (보통 날 / 마지막 날) */
export default function Draft() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { trip, day } = useTripStep(id, ['draft'])
  const q = useQuery({ queryKey: ['chapter', id, day], queryFn: () => api.getChapter(id, day), enabled: !!trip.data })
  const finish = useFinishTrip(id, ({ jobId, bookId }) => nav(`/trips/${id}/binding`, { replace: true, state: { jobId, bookId } }))
  const days = trip.data?.days
  // 책은 완료된 일차가 1개 이상이면 언제든 엮을 수 있다(서버 days 가 없으면 이전처럼 마지막 날에만)
  const canBind = days ? days.some((d) => d.status === 'DONE') : !!trip.data && trip.data.day >= trip.data.totalDays
  // 아직 기록하지 않은 일차(여행 중이면 오늘까지만)
  const nextDay = trip.data ? nextOpenDay(days, trip.data.day, day) : undefined
  const lastDay = canBind && !nextDay
  const allDone = days ? days.length === trip.data?.totalDays && days.every(d => d.status === 'DONE')
    : !!trip.data && day === trip.data.totalDays
  const completedDays = days?.filter(d => d.status === 'DONE').map(d => d.day).sort((a, b) => a - b) ?? []
  const previousDay = completedDays.findLast(n => n < day)
  const followingDay = completedDays.find(n => n > day)

  const back = () => nav('/')
  return (
    <Screen>
      <div className={s.head}>
        <button type="button" onClick={back} aria-label="책장으로"><img src="/img/chevron-left.svg" width={24} height={24} alt="" /></button>
        <h1>{day}일차 이야기</h1>
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
          {q.data.moments.length > 0 && <section className={s.moments}>
            <p className={s.momentsLabel}>포착 순간</p>
            <div className={s.chips}>{q.data.moments.map((m) => <Tag key={m} size="md">{m}</Tag>)}</div>
          </section>}
          <DayNavigation label={`${day}일차`}
            previousLabel={previousDay ? `${previousDay}일차 이야기` : '이전 일차'}
            nextLabel={followingDay ? `${followingDay}일차 이야기` : '다음 일차'}
            onPrevious={previousDay ? () => nav(stepPath(id, 'draft', previousDay)) : undefined}
            onNext={followingDay ? () => nav(stepPath(id, 'draft', followingDay)) : undefined} />
          <div className={s.bottom}>
            {nextDay ? (
              <>
                <p className={s.lastNote}>아직 {nextDay}일차 이야기가 남아 있어요</p>
                <div className={s.buttons}>
                  <Button onClick={() => nav(resumePath(id, nextDay))}>{nextDay}일차 기록하기</Button>
                  {canBind && <Button variant="text" disabled={finish.isPending} onClick={() => finish.mutate()}>{finish.isPending ? '책을 엮기 시작하는 중…' : '여기까지로 책 만들기'}</Button>}
                </div>
                {finish.isError && <p className={s.err}>책 만들기를 시작하지 못했어요. 기록은 그대로 저장돼 있어요.</p>}
              </>
            ) : lastDay ? (
              <>
                <p className={s.lastNote}>{allDone ? '여행의 이야기가 모두 완성됐어요. 이제 한 권으로 엮어 보세요.' : '지금까지의 이야기로 책을 만들 수 있어요'}</p>
                <div className={s.buttons}>
                  <Button disabled={finish.isPending} onClick={() => finish.mutate()}>{finish.isPending ? '책을 엮기 시작하는 중…' : finish.isError ? '다시 시도' : allDone ? '여행 마치고 책 만들기' : '여기까지로 책 만들기'}</Button>
                  <Button variant="text" onClick={back}>책장으로 돌아가기</Button>
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


