import {
  activityIdSchema,
  adminBookingsSchema,
  adminUsersSchema,
  moderationQueueSchema,
  createCategorySchema,
  moveCategorySchema,
  operatorIdSchema,
  resetFeatureSchema,
  setCategoryActiveSchema,
  setFeatureSchema,
  updateCategorySchema,
} from '@/lib/schemas/admin'
import {
  approveOperator,
  getOverview,
  listActivitiesForModeration,
  listBookingsForAdmin,
  listUsersForAdmin,
  listOperatorRequests,
  publishActivity,
  rejectActivity,
  revokeOperator,
} from '@/server/services/admin'
import {
  createCategory,
  listCategoriesForAdmin,
  moveCategory,
  setCategoryActive,
  updateCategory,
} from '@/server/services/category'
import {
  listFeatureFlags,
  resetFeatureFlag,
  setFeatureFlag,
} from '@/server/services/features'
import { adminProcedure, createTRPCRouter } from '@/server/trpc/init'

// Tout est en `adminProcedure`, sans exception.
//
// Ce router expose les brouillons de tous les opérateurs et l'identité derrière
// chaque nom commercial : une seule procédure laissée en `protectedProcedure`
// par distraction ouvrirait tout cela à n'importe quel compte connecté.

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(() => getOverview()),

  moderationQueue: adminProcedure
    .input(moderationQueueSchema)
    .query(({ input }) => listActivitiesForModeration(input.status)),

  publishActivity: adminProcedure
    .input(activityIdSchema)
    .mutation(({ input }) => publishActivity(input.activityId)),

  rejectActivity: adminProcedure
    .input(activityIdSchema)
    .mutation(({ input }) => rejectActivity(input.activityId)),

  operatorRequests: adminProcedure.query(() => listOperatorRequests()),

  approveOperator: adminProcedure
    .input(operatorIdSchema)
    .mutation(({ input }) => approveOperator(input.operatorId)),

  revokeOperator: adminProcedure
    .input(operatorIdSchema)
    .mutation(({ input }) => revokeOperator(input.operatorId)),

  features: adminProcedure.query(() => listFeatureFlags()),

  // `ctx.user.email` et jamais une valeur venue de la requête : un auteur que
  // l'appelant choisit lui-même ne journalise rien.
  setFeature: adminProcedure
    .input(setFeatureSchema)
    .mutation(({ ctx, input }) =>
      setFeatureFlag(input.key, input.enabled, ctx.user.email),
    ),

  resetFeature: adminProcedure
    .input(resetFeatureSchema)
    .mutation(({ input }) => resetFeatureFlag(input.key)),

  // Lecture seule, et volontairement : rien ici ne change un rôle.
  // `approveOperator` reste le seul chemin vers le rôle opérateur.
  bookings: adminProcedure
    .input(adminBookingsSchema)
    .query(({ input }) => listBookingsForAdmin(input)),

  users: adminProcedure
    .input(adminUsersSchema)
    .query(({ input }) => listUsersForAdmin(input)),

  categories: adminProcedure.query(() => listCategoriesForAdmin()),

  createCategory: adminProcedure
    .input(createCategorySchema)
    .mutation(({ input }) => createCategory(input)),

  updateCategory: adminProcedure
    .input(updateCategorySchema)
    .mutation(({ input }) =>
      updateCategory(input.categoryId, {
        label: input.label,
        emoji: input.emoji,
        imageUrl: input.imageUrl,
      }),
    ),

  setCategoryActive: adminProcedure
    .input(setCategoryActiveSchema)
    .mutation(({ input }) => setCategoryActive(input.categoryId, input.active)),

  moveCategory: adminProcedure
    .input(moveCategorySchema)
    .mutation(({ input }) => moveCategory(input.categoryId, input.direction)),
})
