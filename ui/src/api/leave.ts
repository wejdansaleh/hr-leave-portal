import { apiFetch, jsonBody } from './client'
import type { LeaveRecord, LeaveUpdate, NewLeave } from './types'

export async function listLeave(employeeId: string, month?: string): Promise<LeaveRecord[]> {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const result = await apiFetch<{ leave: LeaveRecord[] }>(
    `employees/${encodeURIComponent(employeeId)}/leave${query}`,
  )
  return result.leave
}

export function addLeave(employeeId: string, leave: NewLeave): Promise<LeaveRecord> {
  return apiFetch<LeaveRecord>(
    `employees/${encodeURIComponent(employeeId)}/leave`,
    jsonBody('POST', leave),
  )
}

export function updateLeave(
  employeeId: string,
  startDate: string,
  update: LeaveUpdate,
): Promise<LeaveRecord> {
  return apiFetch<LeaveRecord>(
    `employees/${encodeURIComponent(employeeId)}/leave/${encodeURIComponent(startDate)}`,
    jsonBody('PUT', update),
  )
}
