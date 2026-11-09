import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { Employee, LeaveRecord } from '../api/types'

const getEmployee = vi.fn()
const listLeave = vi.fn()
const addLeave = vi.fn()
const updateLeave = vi.fn()
vi.mock('../api/employees', () => ({ getEmployee: (...a: unknown[]) => getEmployee(...a) }))
vi.mock('../api/leave', () => ({
  listLeave: (...a: unknown[]) => listLeave(...a),
  addLeave: (...a: unknown[]) => addLeave(...a),
  updateLeave: (...a: unknown[]) => updateLeave(...a),
}))
vi.mock('../auth/authService', () => ({ getIdToken: vi.fn() }))

import EmployeeDetailPage from './EmployeeDetailPage'

const ada: Employee = {
  employeeId: 'e1',
  name: 'Ada Lovelace',
  department: 'Engineering',
  role: 'employee',
  startDate: '2024-06-03',
}
const record: LeaveRecord = { employeeId: 'e1', startDate: '2025-03-10', endDate: '2025-03-12', note: 'Trip' }

function renderPage(id = 'e1') {
  return render(
    <MemoryRouter initialEntries={[`/employees/${id}`]}>
      <Routes>
        <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EmployeeDetailPage', () => {
  beforeEach(() => {
    getEmployee.mockReset()
    listLeave.mockReset()
    addLeave.mockReset()
    updateLeave.mockReset()
    getEmployee.mockResolvedValue(ada)
    listLeave.mockResolvedValue([record])
  })

  it('shows a not-found state for an unknown employee', async () => {
    getEmployee.mockRejectedValue(new ApiError(404, 'Employee not found'))
    renderPage('nope')

    expect(await screen.findByTestId('employee-not-found')).toHaveTextContent('Employee not found')
    expect(listLeave).not.toHaveBeenCalled()
  })

  it('shows an empty state when the employee has no leave', async () => {
    listLeave.mockResolvedValue([])
    renderPage()

    expect(await screen.findByTestId('leave-empty')).toHaveTextContent('No leave recorded')
  })

  it('shows the employee and their leave', async () => {
    renderPage()

    expect(await screen.findByTestId('employee-name-heading')).toHaveTextContent('Ada Lovelace')
    expect(await screen.findByTestId('leave-row-2025-03-10')).toHaveTextContent('2025-03-12')
  })

  it('blocks leave whose end date is before the start date', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('leave-row-2025-03-10')

    await user.type(screen.getByTestId('leave-start'), '2025-04-10')
    await user.type(screen.getByTestId('leave-end'), '2025-04-05')
    await user.click(screen.getByTestId('leave-submit'))

    expect(screen.getByTestId('leave-form-error')).toHaveTextContent('end date must be on or after')
    expect(addLeave).not.toHaveBeenCalled()
  })

  it('adds valid leave', async () => {
    addLeave.mockResolvedValue({ ...record, startDate: '2025-04-10', endDate: '2025-04-11', note: '' })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('leave-row-2025-03-10')

    await user.type(screen.getByTestId('leave-start'), '2025-04-10')
    await user.type(screen.getByTestId('leave-end'), '2025-04-11')
    await user.click(screen.getByTestId('leave-submit'))

    await waitFor(() =>
      expect(addLeave).toHaveBeenCalledWith('e1', { startDate: '2025-04-10', endDate: '2025-04-11', note: '' }),
    )
  })

  it('reloads leave when a month is chosen', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('leave-row-2025-03-10')

    await user.type(screen.getByTestId('leave-month'), '2025-03')

    await waitFor(() => expect(listLeave).toHaveBeenLastCalledWith('e1', '2025-03'))
  })

  it('sends the edited end date and note for an existing record', async () => {
    updateLeave.mockResolvedValue({ ...record, endDate: '2025-03-14', note: 'Longer trip' })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByTestId('leave-edit-2025-03-10'))
    const end = screen.getByTestId('leave-edit-end')
    await user.clear(end)
    await user.type(end, '2025-03-14')
    const note = screen.getByTestId('leave-edit-note')
    await user.clear(note)
    await user.type(note, 'Longer trip')
    await user.click(screen.getByTestId('leave-edit-save'))

    await waitFor(() =>
      expect(updateLeave).toHaveBeenCalledWith('e1', '2025-03-10', { endDate: '2025-03-14', note: 'Longer trip' }),
    )
  })
})
