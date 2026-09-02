/** Catégorie telle que la consomment le catalogue et les filtres. */
export interface Category {
  id: string
  /** Ce qui voyage dans l'URL (`?category=sports-nautiques`). Immuable. */
  slug: string
  label: string
  emoji: string | null
  imageUrl: string | null
  position: number
}

/** Vue d'administration : ajoute ce qu'un admin doit voir pour décider. */
export interface CategoryAdmin extends Category {
  active: boolean
  /**
   * Nombre d'activités classées ici, tous statuts confondus.
   *
   * C'est ce qui permet à l'admin de comprendre pourquoi une catégorie ne se
   * supprime pas — et de mesurer ce qu'il retire du catalogue en la
   * désactivant.
   */
  activityCount: number
}
