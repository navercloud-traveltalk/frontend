import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Screen } from '../components'
import { useJob } from '../lib/useJob'
import s from './Writing.module.css'
import { useTripStep } from '../lib/steps'

function Step({ state, children }: { state: 'done' | 'now' | 'todo'; children: string }) {
  return (
    <div className={s.step}>
      <span className={s.mark}>
        {state === 'done' && <img src="/img/step-done.svg" width={20} height={20} alt="" />}
        {state === 'now' && (<><img className={s.ripple} src="/img/step-ripple.svg" width={20} height={20} alt="" /><img className={s.dot} src="/img/step-dot.svg" width={8} height={8} alt="" /></>)}
        {state === 'todo' && <img src="/img/step-todo.svg" width={20} height={20} alt="" />}
      </span>
      <p className={state === 'now' ? s.now : state === 'todo' ? s.todo : s.done}>{children}</p>
    </div>
  )
}

function Book({ label, pen, muted }: { label: string; pen: 39 | 57; muted?: boolean }) {
  return (
    <div className={s.book}>
      <div className={s.page}>
        <div className={s.photo} />
        <div className={s.blank}>
          <p className={[s.pageLabel, muted && s.muted].filter(Boolean).join(' ')}>{label}</p>
          <span className={s.rule} /><span className={s.rule} /><span className={s.rule} /><span className={s.rule} />
          <span className={s.ribbon} />
          <img className={s.pen} src={`/img/pen-${pen}.svg`} style={{ width: pen === 57 ? 57 : 39 }} alt="" />
        </div>
      </div>
      <div className={s.stand} />
    </div>
  )
}

/** /trips/:id/today/writing — 이야기를 쓰는 중. 2초마다 작업 상태를 확인하고 끝나면 초안으로 간다. */
export default function Writing() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const [jobId, setJobId] = useState<string | null>((loc.state as { jobId?: string } | null)?.jobId ?? null)
  const [startFailed, setStartFailed] = useState(false)
  const { trip, info, ready } = useTripStep(id, ['writing'])
  const day = trip.data?.day ?? 1
  const job = useJob(jobId)

  const start = async () => {
    setStartFailed(false)
    try {
      const { jobId } = await api.createChapter(id, day)
      setJobId(jobId)
    } catch {
      setStartFailed(true)
    }
  }

  // 새로고침·재진입으로 jobId를 잃었으면: 진행 중 작업이 있으면 그것을, 없으면 작성을 시작(이미 끝난 일차면 가드가 초안으로 보낸다)
  useEffect(() => {
    if (jobId || !ready || (info && info.nextStep !== 'writing')) return
    if (info?.jobId) setJobId(info.jobId)
    else void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, info])

  useEffect(() => {
    if (job.data?.status === 'done') nav(`/trips/${id}/today/draft`, { replace: true })
  }, [job.data?.status, id, nav])

  const failed = startFailed || job.data?.status === 'failed' || job.isError
  const p = job.data?.progress ?? 0
  const stage = p < 0.5 ? 0 : 1
  const place = trip.data?.place ?? '전주'

  const retry = () => { setJobId(null); void start() }
  const leave = <button type="button" className={s.leave} onClick={() => nav('/')}>책장에서 기다리기</button>

  if (failed) {
    return (
      <Screen>
        <h1 className={s.head}>오늘의 이야기</h1>
        <div className={s.body}>
          <div className={s.top}>
            <div className={s.group}>
              <Book label={`${place} ${day}일차`} pen={39} muted />
              <div className={s.text}>
                <p className={s.title}>이야기를 다 쓰지 못했어요</p>
                <p className={s.sub}>대화는 저장돼 있어요. 다시 시도해 주세요.</p>
              </div>
            </div>
            <div className={s.retry}>
              <div className={[s.card, s.cardSm].join(' ')}><Step state="done">대화를 정리했어요</Step></div>
              <Button onClick={retry}>다시 쓰기</Button>
            </div>
          </div>
          {leave}
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <h1 className={s.head}>오늘의 이야기를 쓰는 중</h1>
      <div className={s.body}>
        <div className={s.top}>
          <div className={s.group}>
            <Book label="집필 중" pen={stage === 0 ? 39 : 57} />
            <div className={s.text}>
              <p className={s.title}>오늘의 이야기를 쓰고 있어요</p>
              <p className={s.sub}>{place} {day}일차 · 질문 5개의 답으로 쓰는 중</p>
            </div>
          </div>
          <div className={s.progress}>
            <div className={s.card}>
              <Step state="done">대화를 정리했어요</Step>
              <Step state={stage === 0 ? 'now' : 'done'}>이야기를 쓰고 있어요</Step>
              <Step state={stage === 0 ? 'todo' : 'now'}>사진과 말에 없는 내용을 걸러낼게요</Step>
            </div>
            <p className={s.wait}>30초쯤 걸려요</p>
          </div>
        </div>
        {leave}
      </div>
    </Screen>
  )
}
