import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { Button, Icon, Screen, TabBar } from '../components'
import { BottomSheet } from '../components/BottomSheet'
import { clearSession, getSession } from '../lib/session'
import { getSettings, saveSettings, VOICES, type Voice } from '../lib/settings'
import s from './Settings.module.css'

/** /settings — 설정 */
export default function Settings() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [st, setSt] = useState(getSettings())
  const [sheet, setSheet] = useState<null | 'voice' | 'delete' | 'info'>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const update = (p: Parameters<typeof saveSettings>[0]) => setSt(saveSettings(p))

  const remove = async () => {
    setBusy(true); setErr(false)
    try {
      await api.deleteMyData()
      clearSession()
      qc.clear()
      nav('/start', { replace: true })
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <h1 className={s.head}>설정</h1>
      <div className={s.content}>
        <div className={s.group}>
          <button type="button" className={s.row} onClick={() => setSheet('voice')}>
            <span className={s.label}>인터뷰어 목소리</span>
            <span className={s.value}>{st.voice}<Icon name="chevron-right" size={18} /></span>
          </button>
          <div className={s.row}>
            <span className={s.label}>원본 음성 보관</span>
            <button type="button" role="switch" aria-checked={st.keepAudio} aria-label="원본 음성 보관" className={[s.toggle, st.keepAudio && s.on].filter(Boolean).join(' ')} onClick={() => update({ keepAudio: !st.keepAudio })}><i /></button>
          </div>
        </div>
        <div className={s.group}>
          <button type="button" className={s.row} onClick={() => { setErr(false); setSheet('delete') }}>
            <span className={[s.label, s.danger].join(' ')}>내 데이터 삭제</span>
            <Icon name="chevron-right" size={18} style={{ color: 'var(--ink-mute)' }} />
          </button>
          <button type="button" className={s.row} onClick={() => setSheet('info')}>
            <span className={s.label}>서비스 정보</span>
            <Icon name="chevron-right" size={18} style={{ color: 'var(--ink-mute)' }} />
          </button>
        </div>
      </div>
      <TabBar active="/settings" />

      <BottomSheet open={sheet === 'voice'} onClose={() => setSheet(null)} title="인터뷰어 목소리">
        <div className={s.options}>
          {VOICES.map((v: Voice) => (
            <button key={v} type="button" role="radio" aria-checked={st.voice === v} className={[s.option, st.voice === v && s.optionOn].filter(Boolean).join(' ')} onClick={() => { update({ voice: v }); setSheet(null) }}>
              {st.voice === v ? <img src="/img/radio-on.svg" width={20} height={20} alt="" /> : <span className={s.radio} />}
              {v}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'delete'} onClose={() => !busy && setSheet(null)} title="내 데이터를 삭제할까요?">
        <p className={s.sheetText}>{getSession()?.nickname}님의 책과 사진, 목소리 기록이 모두 지워지고 되돌릴 수 없어요.</p>
        {err && <p className={s.err}>삭제하지 못했어요. 데이터는 그대로 있어요. 다시 시도해 주세요.</p>}
        <Button disabled={busy} onClick={remove}>{busy ? '삭제하는 중…' : err ? '다시 시도' : '모두 삭제하기'}</Button>
        <Button variant="outline" disabled={busy} onClick={() => setSheet(null)}>취소</Button>
      </BottomSheet>

      <BottomSheet open={sheet === 'info'} onClose={() => setSheet(null)} title="서비스 정보">
        <p className={s.sheetText}>여행말 0.1<br />여행 사진과 밤마다 하는 AI 음성 인터뷰로 만드는 여행 이야기책.</p>
        <p className={s.sheetText}>이야기는 사진과 내가 한 말에 있는 내용만 씁니다.</p>
      </BottomSheet>
    </Screen>
  )
}
