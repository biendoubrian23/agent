import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  // Récupérer le profil utilisateur
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Erreur fetch profile:', error)
        return null
      }
      return data as Profile
    } catch (err) {
      console.error('Exception fetch profile:', err)
      return null
    }
  }

  useEffect(() => {
    // Éviter les doubles initialisations (cause de boucles infinies)
    if (initialized.current) return
    initialized.current = true

    // Récupérer la session au chargement
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erreur getSession:', error)
          // En cas d'erreur, nettoyer le storage corrompu
          try {
            localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token')
          } catch {
            // Ignorer
          }
          setLoading(false)
          return
        }

        console.log('Session récupérée:', session ? 'Connecté' : 'Non connecté')
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id)
          setProfile(profileData)
        }
        
        setLoading(false)
      } catch (err) {
        console.error('Exception getSession:', err)
        setLoading(false)
      }
    }

    initSession()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        
        // Éviter de traiter les événements redondants
        if (event === 'INITIAL_SESSION') return
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id)
          setProfile(profileData)
        } else {
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Inscription
  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      })
      return { error: error as Error | null }
    } catch (err) {
      return { error: err as Error }
    }
  }

  // Connexion
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error as Error | null }
    } catch (err) {
      return { error: err as Error }
    }
  }

  // Déconnexion
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setProfile(null)
      setUser(null)
      setSession(null)
    } catch (err) {
      console.error('Erreur signOut:', err)
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
