import { apiFetch, jsonBody } from './client'
import type { HrRequestResponse } from './types'

export function submitTimeOffRequest(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<HrRequestResponse> {
  return apiFetch<HrRequestResponse>(
    'hr-requests/time-off',
    jsonBody('POST', { user_id: userId, start_date: startDate, end_date: endDate }),
  )
}

export function submitHrRequest(userId: string, prompt: string): Promise<HrRequestResponse> {
  return apiFetch<HrRequestResponse>(
    'hr-requests',
    jsonBody('POST', { user_id: userId, prompt }),
  )
}
