import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

// Route Handler nu, pas tRPC : Better Auth gère lui-même ses redirections
// OAuth, ses cookies et ses callbacks. L'envelopper dans tRPC n'apporterait
// rien et casserait le flux de redirection.
export const runtime = 'nodejs'

export const { GET, POST } = toNextJsHandler(auth)
