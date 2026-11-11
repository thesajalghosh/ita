import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import Toast from './components/Toast'
import LoadingSpinner from './components/LoadingSpinner'
import DatabaseNotice from './components/DatabaseNotice'
import { supabaseMissing } from './lib/supabase'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CategoryPage from './pages/CategoryPage'
import PersonPage from './pages/PersonPage'
import AddPersonPage from './pages/AddPersonPage'
import SettingsPage from './pages/SettingsPage'
import SearchPage from './pages/SearchPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Please wait..." />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/category/:categoryId"
        element={
          <ProtectedRoute>
            <CategoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/category/:categoryId/person/:personId"
        element={
          <ProtectedRoute>
            <PersonPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/person/:personId"
        element={
          <ProtectedRoute>
            <PersonPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-person"
        element={
          <ProtectedRoute>
            <AddPersonPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function SetupScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 mb-4">
            <span className="text-3xl">⚙️</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Setup Required</h1>
          <p className="text-sm text-gray-500">Supabase connection is not configured</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Step 1 — Create <code className="bg-gray-200 px-1 rounded">.env</code> file</p>
          <p className="text-xs text-gray-600 mb-3">Create a <strong>.env</strong> file in the project root folder and paste the following:</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-3 overflow-auto leading-5">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
          </pre>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 mb-5 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Step 2 — Supabase Credentials</p>
          <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
            <li>Log in to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline">supabase.com</a></li>
            <li>Go to your project → <strong>Settings → API</strong></li>
            <li>Copy <strong>Project URL</strong> and <strong>anon public</strong> key</li>
            <li>Paste into the .env file</li>
          </ol>
        </div>

        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Step 3 — Database Setup</p>
          <p className="text-xs text-amber-800">Sign in with a Supabase account that has access to the configured project, then use <strong>Settings → Copy SQL</strong> and run the script in the Supabase SQL Editor.</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          After creating the .env file, <strong>restart dev server</strong>: <code className="bg-gray-100 px-1 rounded">npm run dev</code>
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (supabaseMissing) {
    return <SetupScreen />
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <div className="max-w-lg mx-auto min-h-screen bg-neutral-50/70 text-neutral-900 relative shadow-sm">
            <Toast />
            <DatabaseNotice />
            <AppRoutes />
          </div>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
