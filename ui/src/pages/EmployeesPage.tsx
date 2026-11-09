import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createEmployee, listEmployees } from '../api/employees'
import type { Employee } from '../api/types'
import { errorText, isValidDate } from './dates'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [startDate, setStartDate] = useState('')
  const [role, setRole] = useState('employee')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    listEmployees()
      .then((items) => {
        if (active) setEmployees(items)
      })
      .catch((e: unknown) => {
        if (active) setLoadError(errorText(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) =>
      [e.name, e.department, e.role].some((v) => v.toLowerCase().includes(q)),
    )
  }, [employees, filter])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!department.trim()) next.department = 'Department is required.'
    if (!isValidDate(startDate)) next.startDate = 'Enter a valid start date.'
    setErrors(next)
    setSubmitError(null)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const created = await createEmployee({
        name: name.trim(),
        department: department.trim(),
        startDate,
        role: role.trim() || 'employee',
      })
      setEmployees((prev) => [...prev, created])
      setName('')
      setDepartment('')
      setStartDate('')
      setRole('employee')
    } catch (e) {
      setSubmitError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1>Employees</h1>

      <section className="card" aria-labelledby="employees-list-heading">
        <h2 id="employees-list-heading">All employees</h2>
        <label className="field">
          Filter employees
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name, department or role"
            data-testid="employee-filter"
          />
        </label>
        <div aria-live="polite">
          {loading && (
            <p className="muted" data-testid="employees-loading">
              Loading employees…
            </p>
          )}
          {loadError && (
            <div role="alert" data-testid="employees-error">
              <p className="error">{loadError}</p>
              <button type="button" className="btn small" onClick={() => {
                  setLoading(true)
                  setLoadError(null)
                  setReloadKey((k) => k + 1)
                }}
                data-testid="employees-retry"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !loadError && visible.length === 0 && (
            <p className="muted" data-testid="employees-empty">
              No employees found.
            </p>
          )}
        </div>
        <ul className="list" data-testid="employee-list">
          {visible.map((e) => (
            <li key={e.employeeId} className="list-item" data-testid={`employee-row-${e.employeeId}`}>
              <div>
                <Link to={`/employees/${encodeURIComponent(e.employeeId)}`} data-testid={`employee-link-${e.employeeId}`}>
                  <strong>{e.name}</strong>
                </Link>
                <div className="muted">
                  {e.department} · {e.role}
                </div>
              </div>
              <span className="muted">Started {e.startDate}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="employee-create-heading">
        <h2 id="employee-create-heading">Add an employee</h2>
        <form className="form" onSubmit={(e) => void onCreate(e)} noValidate data-testid="employee-form">
          <label className="field">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              data-testid="employee-name"
            />
            {errors.name && (
              <span className="field-error" role="alert" data-testid="employee-name-error">
                {errors.name}
              </span>
            )}
          </label>
          <label className="field">
            Department
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-invalid={Boolean(errors.department)}
              data-testid="employee-department"
            />
            {errors.department && (
              <span className="field-error" role="alert" data-testid="employee-department-error">
                {errors.department}
              </span>
            )}
          </label>
          <label className="field">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-invalid={Boolean(errors.startDate)}
              data-testid="employee-start-date"
            />
            {errors.startDate && (
              <span className="field-error" role="alert" data-testid="employee-start-date-error">
                {errors.startDate}
              </span>
            )}
          </label>
          <label className="field">
            Role
            <input value={role} onChange={(e) => setRole(e.target.value)} data-testid="employee-role" />
          </label>
          <button type="submit" className="btn" disabled={saving} data-testid="employee-submit">
            {saving ? 'Saving…' : 'Add employee'}
          </button>
        </form>
        {submitError && (
          <p className="error" role="alert" data-testid="employee-submit-error">
            {submitError}
          </p>
        )}
      </section>
    </div>
  )
}
