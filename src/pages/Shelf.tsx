import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { STEP_LABEL, stepPath } from '../lib/steps'
import { api } from '../api'
import type { BookSummary, InProgressTrip } from '../api/types'
import { BookCover, BookSpine, Button, Header, Icon, Screen, TabBar } from '../components'
import { spineWidth } from '../components/BookSpine'
import s from './Shelf.module.css'

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
            <p className={s.pageLabel}>표지 고르는 중</p>
            <span className={s.coverLine} />
            <span className={s.coverSlot} />
          </div>
          <div className={s.blank}>
            <p className={s.pageLabel}>책을 엮는 중</p>
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
            <p className={s.lead}>오늘 밤 이야기를 기다리고 있어요</p>
            <button type="button" className={s.infoBtn} onClick={() => nav(stepPath(trip.id, trip.nextStep ?? 'upload'))}>{STEP_LABEL[trip.nextStep ?? 'upload']}</button>
          </>
        )}
        {trip.phase === 'todayDone' && (
          <>
            <p className={s.kicker}>집필 중 · {trip.place} {period}</p>
            <p className={s.lead}>내일 밤에 다시 만나요</p>
            <button type="button" className={[s.infoBtn, s.infoOutline].join(' ')} onClick={() => nav(`/trips/${trip.id}/today/draft`)}>오늘의 챕터 다시 보기</button>
          </>
        )}
        {trip.phase === 'binding' && (
          <>
            <p className={s.kicker}>책을 엮는 중 · {trip.place}</p>
            <p className={s.lead}>곧 책장에 꽂힐 거예요</p>
            <div className={s.progress}><span style={{ width: `${Math.round((trip.bindingProgress ?? 0.6) * 100)}%` }} /></div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Shelf() {
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['bookshelf'], queryFn: api.getBookshelf })

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

  const { nickname, inProgressTrip: trip, books } = q.data
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
