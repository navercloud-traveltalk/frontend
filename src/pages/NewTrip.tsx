import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import type { Companion, InProgressTrip } from '../api/types'
import { BottomSheet, Button, Chip, Header, Icon, Screen } from '../components'
import { stepPath } from '../lib/steps'
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

/** 진행 중인 여행이 있을 때: 새 여행을 못 만드는 이유와 할 수 있는 일(이어 쓰기·책으로 엮기) */
function InProgressNotice({ trip }: { trip: InProgressTrip }) {
  const nav = useNavigate()
  const binding = trip.phase === 'binding'
  const detail = useQuery({ queryKey: ['trip', trip.id], queryFn: () => api.getTrip(trip.id), enabled: !binding })
  const canBind = !!detail.data?.days?.some((d) => d.status === 'DONE')
  const finish = useMutation({
    mutationFn: () => api.finishTrip(trip.id),
    onSuccess: ({ jobId, bookId }) => nav(`/trips/${trip.id}/binding`, { replace: true, state: { jobId, bookId } }),
  })
  return (
    <div className={s.form}>
      <div className={s.notice}>
        <p className={s.noticeTitle}>‘{trip.place}’ 여행을 쓰고 있어요</p>
        <p className={s.noticeText}>
          {binding
            ? '지금 이 여행을 책으로 엮고 있어요. 책이 완성되면 바로 새 여행을 시작할 수 있어요.'
            : '여행은 한 번에 하나씩 쓸 수 있어요. 지금 여행을 이어 쓰거나, 쓴 데까지 책으로 엮으면 새 여행을 시작할 수 있어요.'}
        </p>
      </div>
      <div className={s.bottom}>
        {finish.isError && <p className={s.error}>책 만들기를 시작하지 못했어요. 기록은 그대로 저장돼 있어요.</p>}
        {!binding && detail.data && !canBind && <p className={s.hint}>아직 완성한 일차가 없어 책으로 엮을 수 없어요. 하루라도 기록을 마치면 엮을 수 있어요.</p>}
        {binding ? (
          <Button onClick={() => nav(`/trips/${trip.id}/binding`)}>책 엮는 화면 보기</Button>
        ) : (
          <>
            <Button onClick={() => nav(stepPath(trip.id, trip.nextStep ?? 'upload'))}>{trip.day}일차 이어서 쓰기</Button>
            {canBind && (
              <Button variant="outline" disabled={finish.isPending} onClick={() => finish.mutate()}>
                {finish.isPending ? '책을 엮기 시작하는 중…' : '쓴 데까지 책으로 엮기'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function NewTrip() {
  const nav = useNavigate()
  const qc = useQueryClient()
  // 진행 중 여행이 있으면 만들 수 없다(서버 409 TRIP_IN_PROGRESS) — 미리 알아보고 안내한다
  const shelf = useQuery({ queryKey: ['bookshelf'], queryFn: api.getBookshelf })
  const busy = shelf.data?.inProgressTrip
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
      nav(`/trips/${tripId}/today`, { replace: true })
    },
    // 그 사이 다른 기기에서 여행을 시작했으면 책장을 다시 받아 안내 화면을 보여 준다
    onError: (e) => { if (e instanceof ApiError && e.code === 'TRIP_IN_PROGRESS') void qc.invalidateQueries({ queryKey: ['bookshelf'] }) },
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
      {busy ? <InProgressNotice trip={busy} /> : (
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
      )}

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
