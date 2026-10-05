import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Button, Screen } from '../components'
import { useJob } from '../lib/useJob'
import s from './Binding.module.css'

type St = 'done' | 'now' | 'todo'
function Step({ state, children }: { state: St; children: string }) {
  return (
    <div className={s.step}>
      {state === 'done' && <span className={s.check}><img src="/img/check.svg" width={13} height={13} alt="" /></span>}
      {state === 'now' && <img src="/img/bind-cur.svg" width={22} height={22} alt="" className={s.pulse} />}
      {state === 'todo' && <img src="/img/bind-wait.svg" width={22} height={22} alt="" />}
      <p className={state === 'todo' ? s.todo : state === 'now' ? s.now : s.doneText}>{children}</p>
    </div>
  )
}

/** /trips/:id/binding — 책을 엮는 중. 2초마다 확인하고 끝나면 책 완성 화면으로. */
export default function Binding() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const st = loc.state as { jobId?: string; bookId?: string } | null
  const [jobId, setJobId] = useState<string | null>(st?.jobId ?? null)
  const [bookId, setBookId] = useState<string | null>(st?.bookId ?? null)
  const [startFailed, setStartFailed] = useState(false)
  const job = useJob(jobId)

  const start = async () => {
    setStartFailed(false)
    try {
      const r = await api.finishTrip(id)
      setJobId(r.jobId)
      setBookId(r.bookId)
    } catch {
      setStartFailed(true)
    }
  }
  useEffect(() => {
    if (!jobId) void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (job.data?.status === 'done') nav(bookId ? `/books/${bookId}/complete` : '/', { replace: true })
  }, [job.data?.status, bookId, nav])

  const failed = startFailed || job.data?.status === 'failed' || job.isError
  const p = job.data?.progress ?? 0
  const stage = p < 0.34 ? 0 : p < 0.67 ? 1 : 2
  const fill = 25 + p * 55

  return (
    <Screen>
      <div className={s.body}>
        <div className={s.hero}>
          <div className={s.art}>
            <img className={[s.knot, s.knotB].join(' ')} src="/img/knot.svg" alt="" />
            <img className={[s.knot, s.knotA].join(' ')} src="/img/knot.svg" alt="" />
            <span className={s.thread} />
            <div className={s.cover}>
              <span className={s.fill} style={{ height: `${fill}%` }} />
              <span className={s.band} />
              <p className={s.coverLabel}>전주 · 3일</p>
              <span className={s.amber} />
              <div className={s.lines}><i style={{ width: 66 }} /><i style={{ width: 52 }} /></div>
              <span className={s.brand}>여행말</span>
            </div>
            <div className={[s.paper, s.p1].join(' ')}><span /></div>
            <div className={[s.paper, s.p2].join(' ')}><span /></div>
            <div className={[s.paper, s.p3].join(' ')}><span /></div>
          </div>
          <div className={s.text}>
            <p className={s.title}>{failed ? '책을 엮지 못했어요' : '책을 엮고 있어요'}</p>
            <p className={s.sub}>{failed ? '기록한 이야기는 모두 저장돼 있어요' : '전주 · 3일의 이야기'}</p>
          </div>
        </div>

        <div className={s.card}>
          <Step state={stage > 0 ? 'done' : 'now'}>챕터를 순서대로 엮었어요</Step>
          <Step state={stage > 1 ? 'done' : stage === 1 ? 'now' : 'todo'}>표지를 고르고 있어요</Step>
          <Step state={stage === 2 ? 'now' : 'todo'}>문장마다 근거를 다시 확인할게요</Step>
        </div>

        <div className={s.bottom}>
          {failed ? (
            <Button onClick={() => { setJobId(null); void start() }}>다시 시도</Button>
          ) : (
            <p className={s.note}>1분쯤 걸려요. 화면을 닫아도 완성되면 책장에 꽂아 둘게요.</p>
          )}
          <button type="button" className={s.leave} onClick={() => nav('/')}>책장에서 기다리기</button>
        </div>
      </div>
    </Screen>
  )
}
