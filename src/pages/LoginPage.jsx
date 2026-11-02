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
      toast('Please enter your full name', 'warning')
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
          toast('Account created! Please check your email to verify.', 'success')
          setIsLogin(true)
        }
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 relative">
      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700/80 mb-3 shadow-md">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Brick Kiln Hisab</h1>
          <p className="text-neutral-400 text-xs mt-0.5">Management & Daily Ledger</p>
        </div>

        {/* Minimalist Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-neutral-100">
          <h2 className="text-base font-bold text-neutral-900 mb-0.5">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-xs text-neutral-500 mb-5">
            {isLogin ? 'Enter credentials to manage your kiln hisab' : 'Register your admin profile'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sajal Ghosh"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isLogin ? (
                'Sign In to Account'
              ) : (
                'Create Kiln Account'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-neutral-100 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
