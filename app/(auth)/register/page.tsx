import { AuthForm } from '@/components/forms/AuthForm'

export const metadata = {
  title: 'Create Account | Trip4mauritius',
  description: 'Create your Trip4mauritius account to book amazing activities in Mauritius.',
}

// Idem `/login` : le layout `(auth)` porte le logo et la carte. La version
// précédente rouvrait un `min-h-screen` et un second logo à l'intérieur.
export default function RegisterPage() {
  return <AuthForm defaultTab="register" variant="bare" />
}
