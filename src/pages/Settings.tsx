import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { MeResponse, VoiceCode } from '../api/types'
import { Button, Icon, Screen, TabBar } from '../components'
import { BottomSheet } from '../components/BottomSheet'
import { useMe } from '../lib/me'
import { VOICE_CODES, VOICE_LABELS } from '../lib/settings'
import s from './Settings.module.css'

/** /settings — 설정. 목소리·음성 보관은 서버(쿠키로 식별한 사용자)에 저장한다. */
export default function Settings() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe()
  const [sheet, setSheet] = useState<null | 'voice' | 'delete' | 'info'>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const [saveErr, setSaveErr] = useState(false)

  const save = useMutation({
    mutationFn: (patch: Partial<Pick<MeResponse, 'voice' | 'keepAudio'>>) => api.updateSettings({ voice: me.data!.voice, keepAudio: me.data!.keepAudio, ...patch }),
    onMutate: () => setSaveErr(false),
    onSuccess: (next) => qc.setQueryData(['me'], next),
    onError: () => setSaveErr(true),
  })
  const st = me.data
  if (!st) return <Screen><p style={{ padding: 20, color: 'var(--ink-soft)' }}>설정을 불러오는 중이에요…</p><TabBar active="/settings" /></Screen>

  const remove = async () => {
    setBusy(true); setErr(false)
    try {
      await api.deleteMyData()
      qc.clear() // 서버가 쿠키를 만료시켰으므로 화면 캐시도 비운다
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
            <span className={s.value}>{VOICE_LABELS[st.voice]}<Icon name="chevron-right" size={18} /></span>
          </button>
          <div className={s.row}>
            <span className={s.label}>원본 음성 보관</span>
            <button type="button" role="switch" aria-checked={st.keepAudio} aria-label="원본 음성 보관" className={[s.toggle, st.keepAudio && s.on].filter(Boolean).join(' ')} onClick={() => save.mutate({ keepAudio: !st.keepAudio })}><i /></button>
          </div>
          {saveErr && <p className={s.err}>설정을 저장하지 못했어요. 이전 값 그대로예요. 다시 눌러 주세요.</p>}
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
          {VOICE_CODES.map((v: VoiceCode) => (
            <button key={v} type="button" role="radio" aria-checked={st.voice === v} className={[s.option, st.voice === v && s.optionOn].filter(Boolean).join(' ')} onClick={() => { save.mutate({ voice: v }); setSheet(null) }}>
              {st.voice === v ? <img src="/img/radio-on.svg" width={20} height={20} alt="" /> : <span className={s.radio} />}
              {VOICE_LABELS[v]}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'delete'} onClose={() => !busy && setSheet(null)} title="내 데이터를 삭제할까요?">
        <p className={s.sheetText}>{st.nickname}님의 책과 사진, 목소리 기록이 모두 지워지고 되돌릴 수 없어요.</p>
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
