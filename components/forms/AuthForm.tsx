'use client'

import { Suspense, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

interface AuthFormProps {
  defaultTab: 'login' | 'register'
  /**
   * `bare` quand le conteneur parent fournit déjà la carte — c'est le cas du
   * layout `(auth)`. Sinon on empilerait deux cartes l'une dans l'autre.
   */
  variant?: 'card' | 'bare'
}

const CARD_CLASSNAME = 'bg-white rounded-2xl shadow-card p-8 w-full max-w-md mx-auto'

/**
 * `useSearchParams` impose une frontière Suspense : sans elle, le prérendu
 * statique de `/login` et `/register` échoue au build. La poser ici plutôt que
 * chez chaque appelant évite qu'un futur appelant l'oublie.
 */
export function AuthForm(props: AuthFormProps) {
  return (
    <Suspense
      fallback={
        <div className={props.variant === 'bare' ? 'w-full' : CARD_CLASSNAME}>
          <div className="animate-pulse space-y-4">
            <div className="h-11 bg-surface rounded-xl" />
            <div className="h-12 bg-surface rounded-2xl" />
            <div className="h-12 bg-surface rounded-2xl" />
            <div className="h-12 bg-surface/70 rounded-2xl" />
          </div>
        </div>
      }
    >
      <AuthFormInner {...props} />
    </Suspense>
  )
}

// Aligné sur `minPasswordLength` de lib/auth.ts. Une jauge plus permissive que
// le serveur promettrait un mot de passe que l'inscription refuserait ensuite.
const MIN_PASSWORD_LENGTH = 12

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
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

/**
 * Destination après connexion, posée par le middleware. Elle vient de l'URL,
 * donc d'une source non fiable : seul un chemin interne est accepté, sans quoi
 * `?redirect=//evil.com` renverrait l'utilisateur hors du site juste après
 * s'être authentifié.
 */
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/account'
  }
  return target
}

function AuthFormInner({ defaultTab, variant = 'card' }: AuthFormProps) {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirect'))
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Register state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [registerPending, setRegisterPending] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const passwordStrength = getPasswordStrength(registerPassword)

  /**
   * Navigation dure, volontairement.
   *
   * La session vit dans un cookie : tous les composants serveur déjà rendus
   * l'ignorent. Un `router.refresh()` les réinvaliderait, mais il rafraîchit la
   * route *courante* — ici `/login`, où le proxy voit maintenant une session et
   * applique sa règle « déjà connecté → /account ». Cette redirection gagnait
   * la course contre le `push`, et `?redirect=/bookings` était perdu.
   *
   * Recharger la page évite la course et garantit que tout est re-rendu avec le
   * nouveau cookie. Le coût d'un chargement complet est acceptable ici : ça
   * n'arrive qu'une fois, au moment de l'authentification.
   */
  const goAfterAuth = useCallback(() => {
    window.location.assign(redirectTo)
  }, [redirectTo])

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLoginError(null)
      setLoginPending(true)

      const { error } = await authClient.signIn.email({
        email: loginEmail,
        password: loginPassword,
      })

      setLoginPending(false)

      if (error) {
        // Message volontairement identique pour un email inconnu et un mot de
        // passe faux : distinguer les deux permettrait d'énumérer les comptes.
        setLoginError(error.message ?? 'Invalid email or password')
        return
      }

      goAfterAuth()
    },
    [loginEmail, loginPassword, goAfterAuth]
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

      setRegisterPending(true)

      // Le rôle n'est pas envoyé : il est en `input: false` côté Better Auth et
      // serait ignoré. Tout le monde s'inscrit en `tourist`, le statut
      // opérateur se demande ensuite et se valide par un admin (lots 7 et 8).
      const { error } = await authClient.signUp.email({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: registerEmail,
        password: registerPassword,
      })

      setRegisterPending(false)

      if (error) {
        setRegisterError(error.message ?? 'Could not create your account')
        return
      }

      goAfterAuth()
    },
    [
      firstName,
      lastName,
      registerEmail,
      registerPassword,
      confirmPassword,
      agreeTerms,
      goAfterAuth,
    ]
  )

  return (
    <div className={variant === 'bare' ? 'w-full' : CARD_CLASSNAME}>
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

          {loginError && (
            <p className="text-red-500 text-sm">{loginError}</p>
          )}

          <button
            type="submit"
            disabled={loginPending}
            className="w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loginPending ? (
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
                minLength={MIN_PASSWORD_LENGTH}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-surface focus:border-primary focus:outline-none transition-colors"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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

          <p className="text-sm text-muted">
            Running activities in Mauritius? Create your account first — operator
            access is requested from your account and approved by our team.
          </p>

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

          {registerError && (
            <p className="text-red-500 text-sm">{registerError}</p>
          )}

          <button
            type="submit"
            disabled={registerPending}
            className="w-full bg-primary text-white font-semibold py-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {registerPending ? (
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
