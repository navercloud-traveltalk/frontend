import { useEffect, useState } from 'react'
import { api } from '../api'
import type { StyleName } from '../api/types'
import { useJob } from '../lib/useJob'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import s from './RestyleSheet.module.css'

const STYLES: { name: StyleName; sample: string }[] = [
  { name: '에세이', sample: '오후 두 시쯤, 비가 갑자기 쏟아졌다.' },
  { name: '감성', sample: '비는 예고도 없이, 우리를 골목 끝으로 데려갔다.' },
  { name: '동화', sample: '비가 톡톡 내리던 날, 두 친구는 작은 카페로 쏙 들어갔어요.' },
]

/** 문체 바꾸기 바텀시트. 다시 쓰기는 서버 작업이라 진행·실패 상태를 시트 안에서 보여 준다. */
export function RestyleSheet({ open, bookId, current = '에세이', onClose, onDone }: { open: boolean; bookId: string; current?: StyleName; onClose: () => void; onDone: (style: StyleName) => void }) {
  const [picked, setPicked] = useState<StyleName>(current)
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [failed, setFailed] = useState(false)
  const job = useJob(jobId)

  useEffect(() => { if (open) { setPicked(current); setJobId(null); setFailed(false) } }, [open, current])
  useEffect(() => {
    if (job.data?.status === 'done') { setJobId(null); onDone(picked) }
    if (job.data?.status === 'failed' || job.isError) { setJobId(null); setFailed(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data?.status, job.isError])

  const busy = starting || !!jobId
  const go = async () => {
    setFailed(false)
    setStarting(true)
    try {
      const r = await api.restyle(bookId, picked)
      setJobId(r.jobId)
    } catch {
      setFailed(true)
    } finally {
      setStarting(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={() => !busy && onClose()} title="문체 바꾸기" minHeight={570}>
      <div className={s.list} role="radiogroup" aria-label="문체">
        {STYLES.map(({ name, sample }) => (
          <button key={name} type="button" role="radio" aria-checked={picked === name} disabled={busy} className={[s.card, picked === name && s.on].filter(Boolean).join(' ')} onClick={() => setPicked(name)}>
            {picked === name ? <img src="/img/radio-on.svg" width={20} height={20} alt="" /> : <span className={s.radio} />}
            <span className={s.text}>
              <span className={s.name}>{name}</span>
              <span className={s.sample}>{sample}</span>
            </span>
          </button>
        ))}
      </div>
      <div className={s.bottom}>
        {failed && <p className={s.err}>다시 쓰지 못했어요. 지금 책은 그대로 있어요.</p>}
        <Button disabled={busy} onClick={go}>{busy ? '이야기를 다시 쓰는 중…' : failed ? '다시 시도' : '이 문체로 다시 쓰기'}</Button>
      </div>
    </BottomSheet>
  )
}
