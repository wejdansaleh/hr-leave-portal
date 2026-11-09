import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { configureAuth } from './auth/authService'
import { loadRuntimeConfig, setConfig } from './config/runtimeConfig'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')
const root = createRoot(container)

function showFatal(message: string) {
  root.render(
    <main className="fullpage-error" data-testid="config-error">
      <div className="card" role="alert">
        <h1>Configuration problem</h1>
        <p>{message}</p>
      </div>
    </main>,
  )
}

loadRuntimeConfig()
  .then((config) => {
    setConfig(config)
    configureAuth(config)
    root.render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>,
    )
  })
  .catch((e: unknown) => {
    showFatal(e instanceof Error ? e.message : 'The application could not start.')
  })
