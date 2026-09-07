'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { GuideEditor } from '../GuideEditor'

// `nouveau` est une route sœur, pas un id : Next choisit la route statique
// avant le segment dynamique, donc /admin/guides/nouveau n'arrive jamais ici.

export default function EditGuidePage({
  params,
}: {
  params: Promise<{ guideId: string }>
}) {
  const { guideId } = use(params)
  const trpc = useTRPC()
  const { data: guide, isLoading, error } = useQuery(
    trpc.admin.guide.queryOptions({ guideId }),
  )

  if (isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !guide) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <p className="text-muted">Cet article n&apos;existe pas ou plus.</p>
      </div>
    )
  }

  return <GuideEditor guide={guide} />
}
