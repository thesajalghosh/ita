import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/Toast'
import { Loader2, Building2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!email || !password) {
      toast('Please enter email and password', 'warning')
      return
    }

    if (!isLogin && !fullName) {
      toast('Please enter your name', 'warning')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast('Invalid email or password', 'error')
          } else {
            toast(error.message, 'error')
          }
        } else {
          toast('Logged in successfully', 'success')
        }
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          toast(error.message, 'error')
        } else {
          toast('Account created! Please verify your email.', 'success')
          setIsLogin(true)
        }
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 flex flex-col items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-primary-300/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Brick Kiln Hisab</h1>
          <p className="text-primary-200 text-sm">Brick Kiln Management System</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 fade-in">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isLogin ? 'Sign in to view your accounts' : 'Create a new account'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all pr-12"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Please wait...
                </>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary-600 font-medium"
            >
              {isLogin ? 'Create a new account' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
