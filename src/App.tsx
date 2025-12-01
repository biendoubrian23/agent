import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import Dashboard from './components/Dashboard'
import Sidebar from './components/Sidebar'
import './App.css'

// Composant pour protéger les routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

// Layout du Dashboard
function DashboardLayout() {
  const { profile, signOut } = useAuth()
  
  return (
    <div className="app-container">
      <Sidebar onSignOut={signOut} />
      <main className="main-content">
        <Dashboard userName={profile?.first_name || 'Utilisateur'} />
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  }
  
  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
