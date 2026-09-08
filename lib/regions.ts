/**
 * Les 5 régions de l'île — source unique.
 *
 * Même bug que les catégories avant le lot 10, et même correctif : le tiroir de
 * filtres et le formulaire de l'accueil portaient chacun sa liste en dur, en
 * FRANÇAIS (`Nord`, `Sud`, `Est`, `Ouest`), alors que la colonne `region` de la
 * base contient de l'ANGLAIS (`North`, `South`, `East`, `West`). Quatre régions
 * sur cinq ne renvoyaient donc aucun résultat — seule « Centre », identique
 * dans les deux langues, fonctionnait.
 *
 * On AFFICHE `label`, on FILTRE sur `value`. Ne jamais intervertir les deux.
 *
 * `value` est figé, exactement comme le slug d'une catégorie : il vit dans
 * l'URL des recherches partagées et indexées (`/activities?region=North`, liens
 * posés par les articles du guide). Le renommer casserait ces liens en
 * silence — la page s'afficherait vide, sans erreur.
 *
 * Contrairement aux catégories, les régions ne sont PAS une table : leur liste
 * est celle de la géographie mauricienne, personne n'en ajoutera une sixième
 * depuis le back-office.
 */
export const REGIONS = [
  { value: 'North', label: 'Nord' },
  { value: 'West', label: 'Ouest' },
  { value: 'South', label: 'Sud' },
  { value: 'East', label: 'Est' },
  { value: 'Centre', label: 'Centre' },
] as const

export type RegionValue = (typeof REGIONS)[number]['value']

/**
 * Les seules valeurs stockables, en tuple — `z.enum` exige une liste non vide
 * connue à la compilation, qu'un `.map()` ne lui donne pas.
 */
export const REGION_VALUES = [
  'North',
  'West',
  'South',
  'East',
  'Centre',
] as const satisfies readonly RegionValue[]

/** Le libellé français d'une région ; la valeur brute si elle est inconnue. */
export function regionLabel(value: string): string {
  return REGIONS.find((r) => r.value === value)?.label ?? value
}
