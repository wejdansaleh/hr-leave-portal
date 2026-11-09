import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Employee } from '../api/types'

const listEmployees = vi.fn()
const createEmployee = vi.fn()
vi.mock('../api/employees', () => ({
  listEmployees: () => listEmployees(),
  createEmployee: (...a: unknown[]) => createEmployee(...a),
}))

import EmployeesPage from './EmployeesPage'

const ada: Employee = {
  employeeId: 'e1',
  name: 'Ada Lovelace',
  department: 'Engineering',
  role: 'employee',
  startDate: '2024-06-03',
}
const grace: Employee = { ...ada, employeeId: 'e2', name: 'Grace Hopper', department: 'Research' }

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployeesPage />
    </MemoryRouter>,
  )
}

describe('EmployeesPage', () => {
  beforeEach(() => {
    listEmployees.mockReset()
    createEmployee.mockReset()
    listEmployees.mockResolvedValue([ada, grace])
  })

  it('lists employees and filters them by text', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByTestId('employee-row-e1')).toHaveTextContent('Ada Lovelace')
    expect(screen.getByTestId('employee-row-e2')).toBeInTheDocument()

    await user.type(screen.getByTestId('employee-filter'), 'research')

    expect(screen.queryByTestId('employee-row-e1')).not.toBeInTheDocument()
    expect(screen.getByTestId('employee-row-e2')).toBeInTheDocument()
  })

  it('blocks creation when the name is empty and does not call the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('employee-row-e1')

    await user.type(screen.getByTestId('employee-department'), 'Sales')
    await user.type(screen.getByTestId('employee-start-date'), '2025-01-15')
    await user.click(screen.getByTestId('employee-submit'))

    expect(screen.getByTestId('employee-name-error')).toHaveTextContent('Name is required.')
    expect(createEmployee).not.toHaveBeenCalled()
  })

  it('creates an employee with role defaulting to "employee" and shows it in the list', async () => {
    const created: Employee = {
      employeeId: 'e3',
      name: 'Alan Turing',
      department: 'Math',
      role: 'employee',
      startDate: '2025-02-01',
    }
    createEmployee.mockResolvedValue(created)
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('employee-row-e1')

    expect(screen.getByTestId('employee-role')).toHaveValue('employee')
    await user.type(screen.getByTestId('employee-name'), 'Alan Turing')
    await user.type(screen.getByTestId('employee-department'), 'Math')
    await user.type(screen.getByTestId('employee-start-date'), '2025-02-01')
    await user.click(screen.getByTestId('employee-submit'))

    const row = await screen.findByTestId('employee-row-e3')
    expect(within(row).getByText('Alan Turing')).toBeInTheDocument()
    expect(createEmployee).toHaveBeenCalledWith({
      name: 'Alan Turing',
      department: 'Math',
      startDate: '2025-02-01',
      role: 'employee',
    })
  })

  it('shows an error with retry when loading fails', async () => {
    listEmployees.mockRejectedValueOnce(new Error('Network error. Please try again.'))
    renderPage()

    expect(await screen.findByTestId('employees-error')).toHaveTextContent('Network error')
    expect(screen.getByTestId('employees-retry')).toBeInTheDocument()
  })
})
