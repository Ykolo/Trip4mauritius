import { publicGuidesSchema } from '@/lib/schemas/guide'
import {
  listActiveGuideCategories,
  listPublishedGuides,
} from '@/server/services/guide'
import { createTRPCRouter, publicProcedure } from '@/server/trpc/init'

// Lecture publique des guides.
//
// Ce router ne renvoie QUE les articles `published` — le filtre est dans la
// requête du service, pas dans un tri après coup. L'écriture vit entièrement
// dans le router admin : il n'y a pas de contribution extérieure.

export const guideRouter = createTRPCRouter({
  categories: publicProcedure.query(() => listActiveGuideCategories()),

  list: publicProcedure
    .input(publicGuidesSchema)
    .query(({ input }) => listPublishedGuides(input.category)),
})
