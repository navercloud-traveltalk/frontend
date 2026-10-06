export class ApiError extends Error {
  status?: number
  /** 서버 오류 응답의 error.code (예: AUDIO_INVALID, SCENE_NOT_READY). 없으면 undefined */
  code?: string
  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** 서버 오류 응답 { "error": { "code", "message" } } 에서 code·message 를 꺼낸다. 형식이 다르면 기본 문구 */
export async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    return new ApiError(body.error?.message ?? fallback, res.status, body.error?.code)
  } catch {
    return new ApiError(fallback, res.status)
  }
}
