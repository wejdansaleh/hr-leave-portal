import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'

const SignInPage = lazy(() => import('./pages/SignInPage'))
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'))
const EmployeeDetailPage = lazy(() => import('./pages/EmployeeDetailPage'))
const HrRequestsPage = lazy(() => import('./pages/HrRequestsPage'))

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="fullpage-status" role="status" data-testid="page-loading">
          Loading…
        </div>
      }
    >
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<EmployeesPage />} />
            <Route path="/employees/:employeeId" element={<EmployeeDetailPage />} />
            <Route path="/hr-requests" element={<HrRequestsPage />} />
            <Route path="*" element={<EmployeesPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
