import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { submitHrRequest, submitTimeOffRequest } from '../api/hrRequests'
import { errorText, isValidDate } from './dates'

export default function HrRequestsPage() {
  const { user } = useAuth()
  const userId = user?.email || user?.sub || ''

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timeOffError, setTimeOffError] = useState<string | null>(null)
  const [timeOffDone, setTimeOffDone] = useState(false)
  const [timeOffBusy, setTimeOffBusy] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [inquiryError, setInquiryError] = useState<string | null>(null)
  const [inquiryDone, setInquiryDone] = useState(false)
  const [inquiryBusy, setInquiryBusy] = useState(false)

  async function onTimeOff(event: FormEvent) {
    event.preventDefault()
    setTimeOffDone(false)
    setTimeOffError(null)
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setTimeOffError('Enter a valid start date and end date.')
      return
    }
    if (endDate < startDate) {
      setTimeOffError('The end date must be on or after the start date.')
      return
    }
    setTimeOffBusy(true)
    try {
      await submitTimeOffRequest(userId, startDate, endDate)
      setTimeOffDone(true)
      setStartDate('')
      setEndDate('')
    } catch (e) {
      setTimeOffError(errorText(e))
    } finally {
      setTimeOffBusy(false)
    }
  }

  async function onInquiry(event: FormEvent) {
    event.preventDefault()
    setInquiryDone(false)
    setInquiryError(null)
    if (!prompt.trim()) {
      setInquiryError('Describe your request.')
      return
    }
    setInquiryBusy(true)
    try {
      await submitHrRequest(userId, prompt.trim())
      setInquiryDone(true)
      setPrompt('')
    } catch (e) {
      setInquiryError(errorText(e))
    } finally {
      setInquiryBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>HR requests</h1>

      <section className="card" aria-labelledby="timeoff-heading">
        <h2 id="timeoff-heading">Time-off request</h2>
        <form className="form" onSubmit={(e) => void onTimeOff(e)} noValidate data-testid="timeoff-form">
          <label className="field">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="timeoff-start"
            />
          </label>
          <label className="field">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="timeoff-end"
            />
          </label>
          <button type="submit" className="btn" disabled={timeOffBusy} data-testid="timeoff-submit">
            {timeOffBusy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
        <div aria-live="polite">
          {timeOffDone && (
            <p className="success" data-testid="timeoff-success">
              Your time-off request was submitted and sent to HR.
            </p>
          )}
          {timeOffError && (
            <p className="error" role="alert" data-testid="timeoff-error">
              {timeOffError}
            </p>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="inquiry-heading">
        <h2 id="inquiry-heading">Benefits or other question</h2>
        <form className="form" onSubmit={(e) => void onInquiry(e)} noValidate data-testid="inquiry-form">
          <label className="field wide">
            Your request
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              data-testid="inquiry-prompt"
            />
          </label>
          <button type="submit" className="btn" disabled={inquiryBusy} data-testid="inquiry-submit">
            {inquiryBusy ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
        <div aria-live="polite">
          {inquiryDone && (
            <p className="success" data-testid="inquiry-success">
              Your request was submitted and sent to HR.
            </p>
          )}
          {inquiryError && (
            <p className="error" role="alert" data-testid="inquiry-error">
              {inquiryError}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
