import {
  adminActivitiesSchema,
  adminActivityStatusSchema,
  adminBookingsSchema,
  adminCreateActivitySchema,
  adminUpdateActivitySchema,
  createCategorySchema,
  createOperatorSchema,
  moveCategorySchema,
  resetFeatureSchema,
  setBookingStatusSchema,
  setCategoryActiveSchema,
  setFeatureSchema,
  setOperatorWhatsappSchema,
  updateCategorySchema,
} from '@/lib/schemas/admin'
import {
  activityIdSchema,
  createSlotsSchema,
  deleteSlotSchema,
} from '@/lib/schemas/operator'
import {
  createGuideCategorySchema,
  createGuideSchema,
  guideIdSchema,
  renameGuideCategorySchema,
  setGuideCategoryActiveSchema,
  updateGuideSchema,
} from '@/lib/schemas/guide'
import {
  createActivityForAdmin,
  createSlotsForAdmin,
  deleteSlotForAdmin,
  getActivityForAdmin,
  listActivitiesForAdmin,
  listOperatorOptions,
  setActivityStatusForAdmin,
  updateActivityForAdmin,
} from '@/server/services/admin-catalog'
import {
  createOperator,
  getOverview,
  listBookingsForAdmin,
  listOperators,
  setBookingStatus,
  setOperatorWhatsapp,
} from '@/server/services/admin'
import {
  createCategory,
  listCategoriesForAdmin,
  moveCategory,
  setCategoryActive,
  updateCategory,
} from '@/server/services/category'
import {
  createGuide,
  createGuideCategory,
  deleteGuide,
  getGuideForAdmin,
  listGuideCategoriesForAdmin,
  listGuidesForAdmin,
  renameGuideCategory,
  setGuideCategoryActive,
  updateGuide,
} from '@/server/services/guide'
import {
  listFeatureFlags,
  resetFeatureFlag,
  setFeatureFlag,
} from '@/server/services/features'
import {
  adminProcedure,
  createTRPCRouter,
  superAdminProcedure,
} from '@/server/trpc/init'

// Tout est en `adminProcedure` au minimum, sans exception.
//
// Ce router expose les brouillons de tous les opérateurs et l'identité derrière
// chaque nom commercial : une seule procédure laissée en `protectedProcedure`
// par distraction ouvrirait tout cela à n'importe quel compte connecté.
//
// Trois procédures montent d'un cran en `superAdminProcedure` — les
// interrupteurs de fonctionnalité, qui relèvent du prestataire et non du
// client.

export const adminRouter = createTRPCRouter({
  overview: adminProcedure.query(() => getOverview()),

  operators: adminProcedure.query(() => listOperators()),

  // Le seul chemin vers le rôle `operator` depuis que l'auto-inscription a
  // disparu. Il vit ici, en `adminProcedure`, et nulle part ailleurs.
  createOperator: adminProcedure
    .input(createOperatorSchema)
    .mutation(({ input }) => createOperator(input)),

  // Réservé à l'admin, et pas seulement par commodité : c'est le numéro que le
  // back-office compose pour joindre le prestataire. Ouvert à l'espace
  // opérateur, il donnerait à celui-ci le moyen de se rendre injoignable.
  setOperatorWhatsapp: adminProcedure
    .input(setOperatorWhatsappSchema)
    .mutation(({ input }) =>
      setOperatorWhatsapp({
        operatorId: input.operatorId,
        whatsapp: input.whatsapp ?? null,
      }),
    ),

  // Les interrupteurs sont réservés au super admin (Kled), pas à
  // l'administrateur Trip4mauritius : ils commandent ce que le client voit,
  // c'est un réglage de prestataire, pas d'exploitation courante.
  //
  // La garde est ici, pas seulement dans la barre de navigation : cacher
  // l'onglet ne ferme rien, la procédure resterait appelable.
  features: superAdminProcedure.query(() => listFeatureFlags()),

  // `ctx.user.email` et jamais une valeur venue de la requête : un auteur que
  // l'appelant choisit lui-même ne journalise rien.
  setFeature: superAdminProcedure
    .input(setFeatureSchema)
    .mutation(({ ctx, input }) =>
      setFeatureFlag(input.key, input.enabled, ctx.user.email),
    ),

  resetFeature: superAdminProcedure
    .input(resetFeatureSchema)
    .mutation(({ input }) => resetFeatureFlag(input.key)),

  bookings: adminProcedure
    .input(adminBookingsSchema)
    .query(({ input }) => listBookingsForAdmin(input)),

  // Fait avancer une réservation : Créée → Validée → Terminée, ou annulation.
  // Le service revalide la transition à partir de l'état LU en base — l'écran
  // ne propose que le permis, mais la procédure reste appelable directement.
  setBookingStatus: adminProcedure
    .input(setBookingStatusSchema)
    .mutation(({ input }) => setBookingStatus(input)),

  // Catalogue.
  //
  // Ces procédures ÉCRIVENT le catalogue de n'importe quel opérateur — c'est
  // leur raison d'être, et c'est pourquoi elles n'existent qu'ici. La même
  // fonctionnalité sans `adminProcedure` serait un droit d'édition universel.
  activities: adminProcedure
    .input(adminActivitiesSchema)
    .query(({ input }) => listActivitiesForAdmin(input)),

  activity: adminProcedure
    .input(activityIdSchema)
    .query(({ input }) => getActivityForAdmin(input.activityId)),

  operatorOptions: adminProcedure.query(() => listOperatorOptions()),

  createActivity: adminProcedure
    .input(adminCreateActivitySchema)
    .mutation(({ input }) =>
      createActivityForAdmin(input.operatorId, input.data),
    ),

  updateActivity: adminProcedure
    .input(adminUpdateActivitySchema)
    .mutation(({ input }) =>
      updateActivityForAdmin(input.activityId, input.data),
    ),

  setActivityStatus: adminProcedure
    .input(adminActivityStatusSchema)
    .mutation(({ input }) =>
      setActivityStatusForAdmin(input.activityId, input.status),
    ),

  createSlots: adminProcedure
    .input(createSlotsSchema)
    .mutation(({ input }) => createSlotsForAdmin(input.activityId, input.slots)),

  deleteSlot: adminProcedure
    .input(deleteSlotSchema)
    .mutation(({ input }) => deleteSlotForAdmin(input.slotId)),

  // Guides éditoriaux. Écriture réservée à l'admin : il n'y a pas de
  // contribution extérieure, donc pas de cloisonnement par auteur à prévoir.
  guides: adminProcedure.query(() => listGuidesForAdmin()),

  guide: adminProcedure
    .input(guideIdSchema)
    .query(({ input }) => getGuideForAdmin(input.guideId)),

  createGuide: adminProcedure
    .input(createGuideSchema)
    .mutation(({ input }) => createGuide(input)),

  updateGuide: adminProcedure
    .input(updateGuideSchema)
    .mutation(({ input }) => updateGuide(input.guideId, input.data)),

  deleteGuide: adminProcedure
    .input(guideIdSchema)
    .mutation(({ input }) => deleteGuide(input.guideId)),

  guideCategories: adminProcedure.query(() => listGuideCategoriesForAdmin()),

  createGuideCategory: adminProcedure
    .input(createGuideCategorySchema)
    .mutation(({ input }) => createGuideCategory(input.label)),

  renameGuideCategory: adminProcedure
    .input(renameGuideCategorySchema)
    .mutation(({ input }) => renameGuideCategory(input.categoryId, input.label)),

  setGuideCategoryActive: adminProcedure
    .input(setGuideCategoryActiveSchema)
    .mutation(({ input }) =>
      setGuideCategoryActive(input.categoryId, input.active),
    ),

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
