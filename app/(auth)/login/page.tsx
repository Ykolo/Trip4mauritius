import { AuthForm } from '@/components/forms/AuthForm'

export const metadata = {
  title: 'Sign In | Trip4mauritius',
  description: 'Sign in to your Trip4mauritius account to manage your bookings.',
}

// Le layout `(auth)` fournit déjà le logo et la carte : `variant="bare"` évite
// de les empiler une seconde fois.
export default function LoginPage() {
  return <AuthForm defaultTab="login" variant="bare" />
}
