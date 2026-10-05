import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Companion } from '../api/types'
import { BottomSheet, Button, Chip, Header, Icon, Screen } from '../components'
import s from './NewTrip.module.css'

const COMPANIONS: { code: Companion; label: string }[] = [
  { code: 'ALONE', label: '혼자' }, { code: 'FRIEND', label: '친구' }, { code: 'FAMILY', label: '가족' }, { code: 'LOVER', label: '연인' },
]

const dot = (iso: string) => iso.replaceAll('-', '.')
/** 2026-07-13, 2026-07-15 → "2026.07.13–07.15" */
function rangeLabel(a: string, b: string) {
  if (!a || !b) return '날짜를 골라 주세요'
  const [ya, ...ra] = dot(a).split('.')
  const [yb, ...rb] = dot(b).split('.')
  return ya === yb ? `${ya}.${ra.join('.')}–${rb.join('.')}` : `${dot(a)}–${dot(b)}`
}

export default function NewTrip() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [place, setPlace] = useState('전주')
  const [start, setStart] = useState('2026-07-13')
  const [end, setEnd] = useState('2026-07-15')
  const [who, setWho] = useState<Companion>('FRIEND')
  const [sheet, setSheet] = useState(false)
  const [draft, setDraft] = useState({ start, end })

  const create = useMutation({
    mutationFn: () => api.createTrip({ place: place.trim(), startDate: start, endDate: end, companions: who }),
    onSuccess: ({ tripId }) => {
      qc.invalidateQueries({ queryKey: ['bookshelf'] })
      nav(`/trips/${tripId}/today/upload`, { replace: true })
    },
  })

  const ready = place.trim().length > 0 && !!start && !!end && end >= start
  const openSheet = () => {
    setDraft({ start, end })
    setSheet(true)
  }
  const draftOk = !!draft.start && !!draft.end && draft.end >= draft.start

  return (
    <Screen>
      <Header title="새 책을 시작할게요" onBack={() => nav(-1)} />
      <div className={s.form}>
        <div className={s.field}>
          <label className={s.label} htmlFor="place">어디로 가나요?</label>
          <div className={s.box}>
            <Icon name="map-pin" size={19} className={s.pin} />
            <input id="place" className={s.input} value={place} placeholder="여행지" maxLength={20} onChange={(e) => setPlace(e.target.value)} />
          </div>
        </div>

        <div className={s.field}>
          <span className={s.label}>언제부터 언제까지</span>
          <button type="button" className={s.box} onClick={openSheet}>
            <Icon name="calendar-days" size={19} className={s.pin} />
            <span className={s.value}>{rangeLabel(start, end)}</span>
          </button>
        </div>

        <div className={s.group}>
          <span className={s.label}>누구와 함께</span>
          <div className={s.chips}>
            {COMPANIONS.map((c) => (
              <Chip key={c.code} selected={who === c.code} onClick={() => setWho(c.code)}>{c.label}</Chip>
            ))}
          </div>
        </div>

        <div className={s.bottom}>
          {create.isError && <p className={s.error}>여행을 만들지 못했어요. 입력한 내용은 그대로 있어요.</p>}
          <Button disabled={!ready || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? '책을 준비하는 중…' : create.isError ? '다시 시도' : '여행 시작'}
          </Button>
        </div>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="여행 날짜">
        <div className={s.sheetBody}>
          <label className={s.sheetField}>
            <span className={s.label}>시작일</span>
            <input type="date" className={s.date} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value, end: draft.end < e.target.value ? e.target.value : draft.end })} />
          </label>
          <label className={s.sheetField}>
            <span className={s.label}>종료일</span>
            <input type="date" className={s.date} value={draft.end} min={draft.start} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </label>
          <Button
            disabled={!draftOk}
            onClick={() => {
              setStart(draft.start)
              setEnd(draft.end)
              setSheet(false)
            }}
          >
            확인
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  )
}
