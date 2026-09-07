/// Contrat de sortie des guides éditoriaux.

export type GuideStatus = 'draft' | 'published'

export interface GuideCategory {
  id: string
  /** Ce qui voyage dans l'URL (`/guide?categorie=gastronomie`). Immuable. */
  slug: string
  label: string
  position: number
}

export interface GuideCategoryAdmin extends GuideCategory {
  active: boolean
  /**
   * Nombre d'articles classés ici, tous statuts confondus.
   *
   * C'est ce qui permet à l'admin de comprendre pourquoi une catégorie ne se
   * désactive pas sans conséquence — et de mesurer ce qu'il retire du site.
   */
  guideCount: number
}

/** Ce que voit une liste : assez pour une vignette, pas le corps de l'article. */
export interface GuideSummary {
  id: string
  slug: string
  title: string
  excerpt: string
  imageUrl: string | null
  /** Libellé affiché. Le front filtre sur `categorySlug`, jamais sur celui-ci. */
  category: string
  categorySlug: string
  updatedAt: string
}

export interface GuideDetail extends GuideSummary {
  /** Markdown. */
  content: string
  imageUrls: string[]
}

/** Vue admin : le statut en plus, et les brouillons visibles. */
export interface GuideAdminRow extends GuideSummary {
  status: GuideStatus
}

export interface GuideAdminDetail extends GuideDetail {
  status: GuideStatus
  categoryId: string
}
