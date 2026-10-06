import type { Question } from '../../api/types'

/** 통화 한 판의 상태 순서: incoming → aiSpeaking → listening → thinking → aiSpeaking … → wrapUp */
export type CallPhase = 'incoming' | 'aiSpeaking' | 'listening' | 'thinking' | 'wrapUp'

export interface CallState {
  phase: CallPhase
  question: Question | null
  /** 답한 질문 수 (건너뛴 질문·빈 답변은 세지 않는다) */
  answered: number
  elapsed: number
  starting: boolean
  startError: boolean
  /** 시작 실패 안내 문구(서버가 준 이유). 없으면 기본 문구 */
  startErrorMessage: string | null
  /** 오늘 인터뷰를 이미 마친 날이라 다시 시작할 수 없음(서버 409 INTERVIEW_ENDED) */
  alreadyEnded: boolean
  /** 마이크 권한을 못 받았을 때 안내 문구 */
  micError: string | null
  sheetOpen: boolean
  /** 답변 전송 실패 (녹음은 기기에 남아 있다) */
  sendError: boolean
  /** 녹음을 서버가 읽지 못해 다시 녹음 중 (다시 보내도 같은 결과라 녹음을 버렸다) */
  recordError: string | null
  /** 말소리가 한 번이라도 잡혔는지 */
  heard: boolean
  moments: string[]
}

export const initialCall: CallState = {
  phase: 'incoming', question: null, answered: 0, elapsed: 0,
  starting: false, startError: false, startErrorMessage: null, alreadyEnded: false, micError: null,
  sheetOpen: false, sendError: false, recordError: null, heard: false, moments: [],
}

export type CallAction =
  | { type: 'START' }
  | { type: 'START_ERROR'; message?: string }
  | { type: 'ALREADY_ENDED' }
  | { type: 'MIC_ERROR'; message: string }
  | { type: 'AI_SPEAKING'; question: Question }
  | { type: 'LISTENING' }
  | { type: 'HEARD' }
  | { type: 'THINKING' }
  | { type: 'ANSWERED' }
  | { type: 'SET_ANSWERED'; count: number }
  | { type: 'SEND_ERROR' }
  | { type: 'RECORD_AGAIN'; message: string }
  | { type: 'WRAP_UP'; moments: string[] }
  | { type: 'TICK' }
  | { type: 'SHEET'; open: boolean }

export function callReducer(s: CallState, a: CallAction): CallState {
  switch (a.type) {
    case 'START':
      return { ...s, starting: true, startError: false, startErrorMessage: null, micError: null }
    case 'START_ERROR':
      return { ...s, starting: false, startError: true, startErrorMessage: a.message ?? null }
    case 'ALREADY_ENDED':
      return { ...s, starting: false, alreadyEnded: true, phase: 'wrapUp', sheetOpen: false, moments: [] }
    case 'MIC_ERROR':
      return { ...s, starting: false, micError: a.message }
    case 'AI_SPEAKING':
      return { ...s, phase: 'aiSpeaking', question: a.question, starting: false, sendError: false, recordError: null, heard: false }
    case 'LISTENING':
      return { ...s, phase: 'listening', heard: false }
    case 'HEARD':
      return s.heard ? s : { ...s, heard: true }
    case 'THINKING':
      return { ...s, phase: 'thinking', sendError: false, recordError: null }
    case 'ANSWERED':
      return { ...s, answered: s.answered + 1 }
    case 'SET_ANSWERED':
      return { ...s, answered: a.count }
    case 'SEND_ERROR':
      return { ...s, sendError: true }
    case 'RECORD_AGAIN':
      return { ...s, sendError: false, recordError: a.message }
    case 'WRAP_UP':
      return { ...s, phase: 'wrapUp', sheetOpen: false, moments: a.moments }
    case 'TICK':
      return s.phase === 'incoming' || s.phase === 'wrapUp' ? s : { ...s, elapsed: s.elapsed + 1 }
    case 'SHEET':
      return { ...s, sheetOpen: a.open }
  }
}
