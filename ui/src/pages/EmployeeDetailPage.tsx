import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getEmployee } from '../api/employees'
import { addLeave, listLeave, updateLeave } from '../api/leave'
import type { Employee, LeaveRecord } from '../api/types'
import { errorText, isValidDate } from './dates'

export default function EmployeeDetailPage() {
  const { employeeId = '' } = useParams()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [leave, setLeave] = useState<LeaveRecord[]>([])
  const [leaveLoading, setLeaveLoading] = useState(true)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [month, setMonth] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<string | null>(null)
  const [editEnd, setEditEnd] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [employeeKey, setEmployeeKey] = useState(0)
  const [leaveKey, setLeaveKey] = useState(0)

  useEffect(() => {
    let active = true
    getEmployee(employeeId)
      .then((found) => {
        if (!active) return
        setEmployee(found)
        setState('ready')
      })
      .catch((e: unknown) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 404) {
          setState('not-found')
        } else {
          setLoadError(errorText(e))
          setState('error')
        }
      })
    return () => {
      active = false
    }
  }, [employeeId, employeeKey])

  useEffect(() => {
    if (state !== 'ready') return
    let active = true
    listLeave(employeeId, month || undefined)
      .then((records) => {
        if (!active) return
        setLeave([...records].sort((a, b) => a.startDate.localeCompare(b.startDate)))
        setLeaveError(null)
      })
      .catch((e: unknown) => {
        if (active) setLeaveError(errorText(e))
      })
      .finally(() => {
        if (active) setLeaveLoading(false)
      })
    return () => {
      active = false
    }
  }, [state, employeeId, month, leaveKey])

  const loadLeave = () => {
    setLeaveKey((k) => k + 1)
    return Promise.resolve()
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setFormError('Enter a valid start date and end date.')
      return
    }
    if (endDate < startDate) {
      setFormError('The end date must be on or after the start date.')
      return
    }
    setSaving(true)
    try {
      await addLeave(employeeId, { startDate, endDate, note: note.trim() })
      setStartDate('')
      setEndDate('')
      setNote('')
      await loadLeave()
    } catch (e) {
      setFormError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(record: LeaveRecord) {
    setEditing(record.startDate)
    setEditEnd(record.endDate)
    setEditNote(record.note ?? '')
    setEditError(null)
  }

  async function onSaveEdit(event: FormEvent, record: LeaveRecord) {
    event.preventDefault()
    setEditError(null)
    if (!isValidDate(editEnd)) {
      setEditError('Enter a valid end date.')
      return
    }
    if (editEnd < record.startDate) {
      setEditError('The end date must be on or after the start date.')
      return
    }
    try {
      await updateLeave(employeeId, record.startDate, { endDate: editEnd, note: editNote.trim() })
      setEditing(null)
      await loadLeave()
    } catch (e) {
      setEditError(errorText(e))
    }
  }

  if (state === 'loading') {
    return (
      <div className="page" role="status" data-testid="employee-loading">
        Loading employee…
      </div>
    )
  }
  if (state === 'not-found') {
    return (
      <div className="page card" data-testid="employee-not-found">
        <h1>Employee not found</h1>
        <p className="muted">There is no employee with this id.</p>
        <Link to="/" data-testid="back-to-employees">
          Back to employees
        </Link>
      </div>
    )
  }
  if (state === 'error' || !employee) {
    return (
      <div className="page card" role="alert" data-testid="employee-error">
        <p className="error">{loadError}</p>
        <button type="button" className="btn small" onClick={() => {
            setState('loading')
            setEmployeeKey((k) => k + 1)
          }}
          data-testid="employee-retry"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <p>
        <Link to="/" data-testid="back-to-employees">
          ← Employees
        </Link>
      </p>
      <h1 data-testid="employee-name-heading">{employee.name}</h1>
      <section className="card" aria-label="Employee details">
        <p className="muted">
          {employee.department} · {employee.role} · Started {employee.startDate}
        </p>
      </section>

      <section className="card" aria-labelledby="leave-heading">
        <h2 id="leave-heading">Leave</h2>
        <label className="field">
          Filter by month
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setLeaveLoading(true)
              setMonth(e.target.value)
            }}
            data-testid="leave-month"
          />
        </label>
        <div aria-live="polite">
          {leaveLoading && (
            <p className="muted" data-testid="leave-loading">
              Loading leave…
            </p>
          )}
          {leaveError && (
            <div role="alert" data-testid="leave-error">
              <p className="error">{leaveError}</p>
              <button type="button" className="btn small" onClick={() => {
                  setLeaveLoading(true)
                  setLeaveKey((k) => k + 1)
                }}
                data-testid="leave-retry"
              >
                Retry
              </button>
            </div>
          )}
          {!leaveLoading && !leaveError && leave.length === 0 && (
            <p className="muted" data-testid="leave-empty">
              No leave recorded.
            </p>
          )}
        </div>
        <ul className="list" data-testid="leave-list">
          {leave.map((record) => (
            <li key={record.startDate} className="list-item" data-testid={`leave-row-${record.startDate}`}>
              {editing === record.startDate ? (
                <form className="form" onSubmit={(e) => void onSaveEdit(e, record)} noValidate style={{ width: '100%' }}>
                  <label className="field">
                    End date
                    <input
                      type="date"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      data-testid="leave-edit-end"
                    />
                  </label>
                  <label className="field">
                    Note
                    <input value={editNote} onChange={(e) => setEditNote(e.target.value)} data-testid="leave-edit-note" />
                  </label>
                  <div>
                    <button type="submit" className="btn small" data-testid="leave-edit-save">
                      Save
                    </button>{' '}
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setEditing(null)}
                      data-testid="leave-edit-cancel"
                    >
                      Cancel
                    </button>
                  </div>
                  {editError && (
                    <p className="error wide field-error" role="alert" data-testid="leave-edit-error">
                      {editError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <div>
                    <strong>
                      {record.startDate} → {record.endDate}
                    </strong>
                    {record.note && <div className="muted">{record.note}</div>}
                  </div>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => startEdit(record)}
                    data-testid={`leave-edit-${record.startDate}`}
                  >
                    Edit
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="leave-add-heading">
        <h2 id="leave-add-heading">Add leave</h2>
        <form className="form" onSubmit={(e) => void onAdd(e)} noValidate data-testid="leave-form">
          <label className="field">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="leave-start"
            />
          </label>
          <label className="field">
            End date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="leave-end" />
          </label>
          <label className="field">
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} data-testid="leave-note" />
          </label>
          <button type="submit" className="btn" disabled={saving} data-testid="leave-submit">
            {saving ? 'Saving…' : 'Add leave'}
          </button>
        </form>
        {formError && (
          <p className="error" role="alert" data-testid="leave-form-error">
            {formError}
          </p>
        )}
      </section>
    </div>
  )
}
