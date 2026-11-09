import { apiFetch, jsonBody } from './client'
import type { Employee, NewEmployee } from './types'

export function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('employees')
}

export function createEmployee(employee: NewEmployee): Promise<Employee> {
  return apiFetch<Employee>('employees', jsonBody('POST', employee))
}

export function getEmployee(employeeId: string): Promise<Employee> {
  return apiFetch<Employee>(`employees/${encodeURIComponent(employeeId)}`)
}
