'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useLogin, useRegister } from '@/lib/hooks/useCart'

interface AuthFormProps {
  defaultTab: 'login' | 'register'
}

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  const levels = [
    { label: 'Weak', color: 'bg-red-500' },
    { label: 'Fair', color: 'bg-amber-500' },
    { label: 'Strong', color: 'bg-cyan-500' },
    { label: 'Very Strong', color: 'bg-green-500' },
  ]

  return { score, ...levels[Math.min(score, 3)] }
}

export function AuthForm({ defaultTab }: AuthFormProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const login = useLogin()

  // Register state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [role, setRole] = useState<'tourist' | 'operator'>('tourist')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const register = useRegister()

  const passwordStrength = getPasswordStrength(registerPassword)

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await login.mutateAsync({ email: loginEmail, password: loginPassword })
        router.push('/account')
      } catch {
        // Error is handled by the hook
      }
    },
    [login, loginEmail, loginPassword, router]
  )

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setRegisterError(null)

      if (registerPassword !== confirmPassword) {
        setRegisterError('Passwords do not match')
        return
      }

      if (!agreeTerms) {
        setRegisterError('You must agree to the Terms of Service')
        return
      }

      try {
        await register.mutateAsync({
          firstName,
          lastName,
          email: registerEmail,
          phone,
          password: registerPassword,
          role,
        })
        router.push('/account')
      } catch {
        // Error is handled by the hook
      }
    },
    [
      register,
      firstName,
      lastName,
      registerEmail,
      phone,
      registerPassword,
      confirmPassword,
      role,
      agreeTerms,
      router,
    ]
  )

  return (
    <div className="bg-white rounded-2xl shadow-card p-8 w-full max-w-md mx-auto">
      {/* Tab Switcher */}
      <div className="flex mb-6 bg-surface rounded-xl p-1">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'login'
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'register'
              ? 'bg-white text-ink shadow-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Login Form */}
      {tab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showLoginPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showLoginPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {login.error && (
            <p className="text-red-500 text-sm">{login.error}</p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {login.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      )}

      {/* Register Form */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="first-name"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                First Name
              </label>
              <input
                id="first-name"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="John"
              />
            </div>
            <div>
              <label
                htmlFor="last-name"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Last Name
              </label>
              <input
                id="last-name"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
              placeholder="+230 5XXX XXXX"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showRegisterPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showRegisterPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {/* Password Strength Indicator */}
            {registerPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-surface'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted">{passwordStrength.label}</p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              I am a...
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'tourist' | 'operator')}
              className="w-full px-4 py-3 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors bg-white"
            >
              <option value="tourist">Tourist</option>
              <option value="operator">Activity Operator</option>
            </select>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-surface text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted">
              I agree to the{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </span>
          </label>

          {(registerError || register.error) && (
            <p className="text-red-500 text-sm">
              {registerError || register.error}
            </p>
          )}

          <button
            type="submit"
            disabled={register.isPending}
            className="w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {register.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
