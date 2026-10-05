import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { SAMPLE_PHOTOS } from '../api/mock'
import { Button, Header, Icon, Screen, TabBar } from '../components'
import s from './Upload.module.css'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

interface Pick { id: string; src: string; file?: File; selected: boolean; done: boolean }
type Phase = 'pick' | 'uploading' | 'failed' | 'analyzing'

export default function Upload() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [phase, setPhase] = useState<Phase>('pick')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trip = useQuery({ queryKey: ['trip', id], queryFn: () => api.getTrip(id) })
  const day = trip.data?.day ?? 1

  // 사진 읽는 중: 2초마다 작업 상태 확인, 끝나면 장면 화면으로
  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data?.status === 'running' || !q.state.data ? 2000 : false),
    refetchIntervalInBackground: true,
  })
  useEffect(() => {
    if (job.data?.status === 'done') nav(`/trips/${id}/today/scenes`, { replace: true })
    // 사진은 모두 저장됐지만 장면 묶기가 실패한 경우: 멈추지 않고 안내 + 다시 시도
    if (job.data?.status === 'failed' || job.isError) {
      setJobId(null)
      setError('사진은 모두 저장됐어요. 장면을 묶지 못했어요.')
      setPhase('failed')
    }
  }, [job.data?.status, job.isError, id, nav])

  useEffect(() => () => picks.forEach((p) => p.file && URL.revokeObjectURL(p.src)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = picks.filter((p) => p.selected)
  const total = selected.length
  const failedCount = selected.filter((p) => !p.done).length

  const onFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    picks.forEach((p) => p.file && URL.revokeObjectURL(p.src))
    setPicks(Array.from(list).map((f, i) => ({ id: `${Date.now()}_${i}`, src: URL.createObjectURL(f), file: f, selected: true, done: false })))
    setPhase('pick')
    setError(null)
  }
  const useSamples = () => {
    setPicks(Array.from({ length: 42 }, (_, i) => ({ id: `sample_${i}`, src: SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length], selected: true, done: false })))
    setPhase('pick')
  }
  const toggle = (pid: string) => phase === 'pick' && setPicks((ps) => ps.map((p) => (p.id === pid ? { ...p, selected: !p.selected } : p)))
  const toggleAll = () => {
    const all = picks.every((p) => p.selected)
    setPicks((ps) => ps.map((p) => ({ ...p, selected: !all })))
  }

  /** 아직 올라가지 않은 선택 사진만 올린다 (실패한 것만 다시 시도할 때도 같은 함수) */
  const startUpload = async () => {
    const todo = picks.map((p, index) => ({ p, index })).filter(({ p }) => p.selected && !p.done)
    if (todo.length === 0) return startAnalyze()
    setPhase('uploading')
    setError(null)
    const ok = new Set<string>()
    try {
      const { urls } = await api.getUploadUrls(id, day, todo.length)
      let cursor = 0
      const worker = async () => {
        while (cursor < todo.length) {
          const k = cursor++
          const { p, index } = todo[k]
          try {
            await api.putPhoto(urls[k], p.file, index)
            setPicks((ps) => ps.map((x) => (x.id === p.id ? { ...x, done: true } : x)))
            ok.add(p.id)
          } catch {
            /* 실패한 사진은 done=false 로 남는다 */
          }
        }
      }
      await Promise.all([worker(), worker(), worker()])
    } catch {
      setError('업로드 주소를 받지 못했어요. 이미 올라간 사진은 그대로 있어요.')
      setPhase('failed')
      return
    }
    if (todo.some(({ p }) => !ok.has(p.id))) setPhase('failed')
    else void startAnalyze()
  }

  const startAnalyze = async () => {
    setPhase('analyzing')
    setError(null)
    try {
      const { jobId } = await api.analyze(id, day)
      setJobId(jobId)
    } catch {
      setError('사진은 모두 저장됐어요. 장면을 묶는 일을 시작하지 못했어요.')
      setPhase('failed')
    }
  }

  const doneCount = selected.filter((p) => p.done).length
  const uploading = phase === 'uploading'
  const analyzing = phase === 'analyzing'
  const busy = uploading || analyzing
  const pct = uploading ? (total ? doneCount / total : 0) : Math.min(1, job.data?.progress ?? 0)
  const readCount = Math.round(pct * total)

  return (
    <Screen>
      <Header title={trip.data ? `${trip.data.dateLabel} · 여행 ${trip.data.day}일차` : '오늘 사진 올리기'} onBack={() => nav('/')} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      {busy || phase === 'failed' ? (
        <div className={s.progressBody}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <p className={s.cardTitle}>
                {phase === 'failed' ? `${failedCount}장을 올리지 못했어요` : uploading ? `사진을 올리고 있어요 · ${doneCount} / ${total}` : `사진을 읽고 있어요 · ${readCount} / ${total}`}
              </p>
              <Icon name="image" size={22} className={s.cardIcon} />
            </div>
            <div className={s.bar}><span style={{ width: `${(phase === 'failed' ? doneCount / (total || 1) : pct) * 100}%` }} /></div>
            <p className={s.cardNote}>
              {phase === 'failed'
                ? error ?? `나머지 ${doneCount}장은 안전하게 담겼어요. 실패한 사진만 다시 올릴 수 있어요.`
                : uploading ? '화면을 닫지 말고 잠깐만 기다려 주세요' : '시간과 장소를 살펴 장면을 묶고 있어요'}
            </p>
            {phase === 'failed' && (
              <div className={s.cardActions}>
                <Button onClick={startUpload}>{failedCount > 0 ? `실패한 ${failedCount}장 다시 올리기` : '다시 시도'}</Button>
                {failedCount > 0 && doneCount > 0 && <Button variant="outline" onClick={startAnalyze}>올라간 {doneCount}장으로 계속하기</Button>}
              </div>
            )}
          </div>
          <div className={s.grid}>
            {selected.map((p) => <span key={p.id} className={[s.photo, phase === 'failed' && !p.done && s.photoFail].filter(Boolean).join(' ')} style={{ backgroundImage: `url(${p.src})` }} />)}
          </div>
        </div>
      ) : (
        <div className={s.body}>
          <p className={s.intro}>오늘 찍은 사진을 한 번에 올려 주세요. 시간과 장소는 자동으로 정리돼요.</p>
          {picks.length === 0 ? (
            <div className={s.empty}>
              <button type="button" className={s.pickBox} onClick={() => fileRef.current?.click()}>
                <Icon name="image" size={32} />
                <span>오늘 찍은 사진 고르기</span>
              </button>
              {USE_MOCK && <button type="button" className={s.sample} onClick={useSamples}>예시 사진 42장으로 해 볼게요</button>}
            </div>
          ) : (
            <>
              <div className={s.count}>
                <p>{total}장 선택됨</p>
                <button type="button" onClick={toggleAll} aria-label="전체 선택 또는 해제"><Icon name="sliders-horizontal" size={19} style={{ color: 'var(--teal)' }} /></button>
              </div>
              <div className={s.grid}>
                {picks.map((p) => (
                  <button type="button" key={p.id} className={[s.photo, !p.selected && s.dim].filter(Boolean).join(' ')} style={{ backgroundImage: `url(${p.src})` }} onClick={() => toggle(p.id)} aria-pressed={p.selected}>
                    {p.selected && <span className={s.check}><Icon name="check" size={14} /></span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'pick' && (
        <div className={s.fixed}>
          {picks.length === 0 ? (
            <Button onClick={() => fileRef.current?.click()}>사진 고르기</Button>
          ) : (
            <Button disabled={total === 0} onClick={startUpload}>사진 {total}장 올리기</Button>
          )}
        </div>
      )}
      <TabBar active="/today" />
    </Screen>
  )
}
