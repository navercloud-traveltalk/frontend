import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

/** 서버가 발급한 쿠키로 현재 사용자를 확인한다. 쿠키가 없거나 만료되면 401 → /start 로 보낸다. */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.getMe, staleTime: 5 * 60_000 })
}
