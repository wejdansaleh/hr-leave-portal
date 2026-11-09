import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const submitTimeOffRequest = vi.fn()
const submitHrRequest = vi.fn()
vi.mock('../api/hrRequests', () => ({
  submitTimeOffRequest: (...a: unknown[]) => submitTimeOffRequest(...a),
  submitHrRequest: (...a: unknown[]) => submitHrRequest(...a),
}))
vi.mock('../auth/context', () => ({
  useAuth: () => ({ user: { sub: 'sub-1', email: 'ada@example.com' } }),
}))

import HrRequestsPage from './HrRequestsPage'

describe('HrRequestsPage', () => {
  beforeEach(() => {
    submitTimeOffRequest.mockReset()
    submitHrRequest.mockReset()
  })

  it('confirms a time-off request as submitted, never as approved', async () => {
    submitTimeOffRequest.mockResolvedValue({ executionArn: 'arn:exec' })
    const user = userEvent.setup()
    render(<HrRequestsPage />)

    await user.type(screen.getByTestId('timeoff-start'), '2025-05-05')
    await user.type(screen.getByTestId('timeoff-end'), '2025-05-07')
    await user.click(screen.getByTestId('timeoff-submit'))

    const success = await screen.findByTestId('timeoff-success')
    expect(success).toHaveTextContent(/submitted/i)
    expect(success).toHaveTextContent(/sent to HR/i)
    expect(success.textContent).not.toMatch(/approved|completed/i)
    expect(submitTimeOffRequest).toHaveBeenCalledWith('ada@example.com', '2025-05-05', '2025-05-07')
  })

  it('submits a free-text HR request and confirms it as submitted', async () => {
    submitHrRequest.mockResolvedValue({ executionArn: 'arn:exec' })
    const user = userEvent.setup()
    render(<HrRequestsPage />)

    await user.type(screen.getByTestId('inquiry-prompt'), 'What dental plans are offered?')
    await user.click(screen.getByTestId('inquiry-submit'))

    await waitFor(() => expect(screen.getByTestId('inquiry-success')).toHaveTextContent(/submitted/i))
    expect(submitHrRequest).toHaveBeenCalledWith('ada@example.com', 'What dental plans are offered?')
  })

  it('does not submit when the dates are out of order', async () => {
    const user = userEvent.setup()
    render(<HrRequestsPage />)

    await user.type(screen.getByTestId('timeoff-start'), '2025-05-10')
    await user.type(screen.getByTestId('timeoff-end'), '2025-05-01')
    await user.click(screen.getByTestId('timeoff-submit'))

    expect(screen.getByTestId('timeoff-error')).toBeInTheDocument()
    expect(submitTimeOffRequest).not.toHaveBeenCalled()
  })
})
