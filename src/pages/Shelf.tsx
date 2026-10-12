import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { STEP_LABEL, stepPath } from '../lib/steps'
import { api } from '../api'
import type { BookSummary, InProgressTrip } from '../api/types'
import { BookCover, BookSpine, Button, Header, Icon, Screen, TabBar } from '../components'
import { spineWidth } from '../components/BookSpine'
import s from './Shelf.module.css'
import { BINDING_PREVIEW_KEY, useBindingPreview } from '../lib/useBindingPreview'
import { useJob } from '../lib/useJob'

function Book({ b, onOpen }: { b: BookSummary; onOpen: () => void }) {
  if (b.shelfStyle === 'spine') {
    return <BookSpine title={b.title} label={`${b.place} · ${b.dateLabel.slice(0, 4)}`} width={b.spineWidth ?? spineWidth(b.days)} height={132} color={b.coverColor} onClick={onOpen} />
  }
  const sub = `${b.place} · ${b.dateLabel}`
  return (
    <button type="button" className={s.bookBtn} onClick={onOpen} aria-label={b.title}>
      {b.shelfStyle === 'cover' ? (
        <BookCover type="photo" title={b.title} subtitle={sub} photoUrl={b.coverPhotoUrl} width={92} height={132} titleSize={12} />
      ) : (
        <BookCover type="photo" title={b.title} subtitle={sub} photoUrl={b.coverPhotoUrl} width={76} height={104} titleSize={12} />
      )}
    </button>
  )
}

function OpenBook({ trip }: { trip: InProgressTrip }) {
  if (trip.phase === 'binding') {
    return (
      <div className={s.openBook}>
        <div className={s.page}>
          <div className={s.coverPage}>
            <p className={s.pageLabel}>{trip.jobStatus === 'done' ? '표지 완성' : '표지 고르는 중'}</p>
            <span className={s.coverLine} />
            <span className={s.coverSlot} />
          </div>
          <div className={s.blank}>
            <p className={s.pageLabel}>{trip.jobStatus === 'done' ? '책장에 꽂는 중' : '책을 엮는 중'}</p>
            <span className={s.rule} />
            <span className={s.rule} />
            <span className={s.rule} style={{ width: 56 }} />
            <span className={s.ribbon} />
          </div>
        </div>
        <div className={s.stand} />
      </div>
    )
  }
  return (
    <div className={s.openBook}>
      <div className={s.page}>
        <div className={s.photo} style={{ backgroundImage: trip.latestPhotoUrl ? `url(${trip.latestPhotoUrl})` : undefined }} />
        <div className={s.blank}>
          <p className={s.pageLabel}>집필 중</p>
          <span className={s.rule} />
          <span className={s.rule} />
          <span className={s.rule} />
          <span className={s.rule} />
          <span className={s.ribbon} />
        </div>
      </div>
      <div className={s.stand} />
    </div>
  )
}

function Writing({ trip }: { trip: InProgressTrip }) {
  const nav = useNavigate()
  // 일차 대신 처음 입력한 여행 기간을 보여 준다(지난 여행은 일차가 마지막 날로 고정돼 보이므로)
  const period = trip.periodLabel ?? `${trip.day}일차`
  return (
    <div className={[s.writing, trip.phase === 'binding' && s.writingBinding].filter(Boolean).join(' ')}>
      <OpenBook trip={trip} />
      <div className={s.info}>
        {trip.phase === 'writing' && (
          <>
            <p className={s.kicker}>집필 중 · {trip.place} {period}</p>
            <p className={s.lead}>{trip.jobStatus === 'failed' ? '이야기를 다 쓰지 못했어요' : trip.jobStatus === 'running' && trip.nextStep === 'writing' ? '오늘의 이야기를 쓰고 있어요' : '오늘 밤 이야기를 기다리고 있어요'}</p>
            <button type="button" className={s.infoBtn} onClick={() => nav(stepPath(trip.id, trip.nextStep ?? 'upload', trip.day))}>{trip.jobStatus === 'failed' && trip.nextStep === 'writing' ? '이야기 다시 쓰기' : STEP_LABEL[trip.nextStep ?? 'upload']}</button>
          </>
        )}
        {trip.phase === 'todayDone' && (
          <>
            <p className={s.kicker}>집필 중 · {trip.place} {period}</p>
            <p className={s.lead}>오늘의 이야기가 완성됐어요</p>
            <button type="button" className={[s.infoBtn, s.infoOutline].join(' ')} onClick={() => nav(stepPath(trip.id, 'draft', trip.day))}>완성된 이야기 보기</button>
          </>
        )}
        {trip.phase === 'binding' && (
          <>
            <p className={s.kicker}>{trip.jobStatus === 'failed' ? '책 엮기 다시 시도' : trip.jobStatus === 'done' ? '완성된 책' : '책을 엮는 중'} · {trip.place}</p>
            <p className={s.lead}>{trip.jobStatus === 'failed' ? '기록한 이야기는 저장돼 있어요' : trip.jobStatus === 'done' ? '책장에 꽂고 있어요' : '곧 책장에 꽂힐 거예요'}</p>
            {trip.jobStatus !== 'failed' && <div className={[s.progress, trip.jobStatus === 'done' && s.progressFinished].filter(Boolean).join(' ')} role="progressbar" aria-label="책 엮기 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((trip.bindingProgress ?? 0) * 100)}><span style={{ width: `${Math.round((trip.bindingProgress ?? 0) * 100)}%` }} /></div>}
            <button type="button" className={s.infoBtn} onClick={() => nav(`/trips/${trip.id}/binding`)}>{trip.jobStatus === 'failed' ? '책 엮기 다시 시도' : '책 엮는 과정 보기'}</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Shelf() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const binding = useBindingPreview()
  const preview = binding.data
  const trackedJob = useJob(preview?.jobId ?? null)
  const q = useQuery({
    queryKey: ['bookshelf'], queryFn: api.getBookshelf,
    refetchOnMount: 'always', refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const trip = query.state.data?.inProgressTrip
      return trip && (trip.phase === 'binding' || trip.nextStep === 'writing' || trip.nextStep === 'analyzing') ? 2000 : false
    },
    refetchIntervalInBackground: true,
  })
  const previewFits = !q.data?.inProgressTrip || q.data.inProgressTrip.id === preview?.trip.id
  const previewFailed = trackedJob.data?.status === 'failed'
    || (q.data?.inProgressTrip?.id === preview?.trip.id && q.data?.inProgressTrip?.jobStatus === 'failed')
  const completed = trackedJob.data?.status === 'done'
    || !!q.data?.books.some(b => b.id === (preview?.bookId ?? preview?.trip.id))
  useEffect(() => {
    if (!preview || !q.data) return
    if (!previewFits || previewFailed) { qc.setQueryData(BINDING_PREVIEW_KEY, null); return }
    if (!completed) return
    // 서버는 이미 완료됐다. 책을 꽂는 짧은 전환을 보여 준 뒤 완성된 표지로 바꾼다.
    const timer = window.setTimeout(() => { qc.setQueryData(BINDING_PREVIEW_KEY, null); void qc.invalidateQueries({ queryKey: ['bookshelf'] }) }, 800)
    return () => window.clearTimeout(timer)
  }, [preview, q.data, previewFits, previewFailed, completed, qc])

  if (q.isPending || q.isError) {
    return (
      <Screen>
        <Header title="내 책장" />
        <div className={s.state}>
          {q.isPending ? (
            <p className={s.stateText}>책장을 불러오는 중이에요…</p>
          ) : (
            <>
              <p className={s.stateText}>책장을 불러오지 못했어요.<br />저장된 책은 그대로 있어요.</p>
              <Button onClick={() => q.refetch()}>다시 시도</Button>
            </>
          )}
        </div>
        <TabBar active="/" />
      </Screen>
    )
  }

  const { nickname, inProgressTrip, books: storedBooks } = q.data
  const presenting = !!preview && previewFits && !previewFailed
  const trip: InProgressTrip | null = presenting ? { ...preview.trip,
    jobStatus: completed ? 'done' : 'running',
    bindingProgress: completed ? 1 : trackedJob.data?.progress ?? inProgressTrip?.bindingProgress ?? 0,
  } : inProgressTrip
  const books = presenting ? storedBooks.filter(b => b.id !== (preview.bookId ?? preview.trip.id)) : storedBooks
  const header = <Header title={`${nickname}님의 책장`} sub={`여행 ${books.length}권`} height={trip?.phase === 'binding' ? 88 : undefined} />
  const open = (b: BookSummary) => () => nav(`/books/${b.id}`)

  if (!trip && books.length === 0) {
    return (
      <Screen>
        {header}
        <div className={s.empty}>
          <div className={s.emptyShelf}>
            <div className={s.slot}>
              <Icon name="book-open" size={32} />
              <p>첫 번째 책이 꽂힐 자리</p>
            </div>
            <div className={s.board16} />
          </div>
          <div className={s.emptyInfo}>
            <p>여행을 시작하면 이곳에 책이 생겨요</p>
            <Button onClick={() => nav('/trips/new')}>새 여행 시작하기</Button>
          </div>
        </div>
        <TabBar active="/" />
      </Screen>
    )
  }

  const tall = books.filter((b) => b.shelfStyle !== 'mini')
  const mini = books.filter((b) => b.shelfStyle === 'mini')

  return (
    <Screen>
      {header}
      <div className={s.body}>
        {trip && <Writing trip={trip} />}
        <div className={s.shelves}>
          {tall.length > 0 && (
            <div className={[s.row, s.rowTall].join(' ')}>
              {tall.map((b) => <Book key={b.id} b={b} onOpen={open(b)} />)}
              <div className={s.board} />
            </div>
          )}
          <div className={[s.row, s.rowMini].join(' ')}>
            {mini.map((b) => <Book key={b.id} b={b} onOpen={open(b)} />)}
            <button type="button" className={s.newTrip} onClick={() => nav('/trips/new')}>
              <Icon name="plus" size={22} />
              <span>새 여행 시작하기</span>
            </button>
            <div className={s.board} />
          </div>
        </div>
      </div>
      <TabBar active="/" />
    </Screen>
  )
}
