import Link from 'next/link'
import { AuthForm } from '@/components/forms/AuthForm'

export const metadata = {
  title: 'Create Account | Trip4mauritius',
  description: 'Create your Trip4mauritius account to book amazing activities in Mauritius.',
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <h1 className="font-display text-primary text-3xl">Trip4mauritius</h1>
      </Link>
      <AuthForm defaultTab="register" />
    </div>
  )
}
