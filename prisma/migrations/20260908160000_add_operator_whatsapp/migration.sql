-- Numéro WhatsApp professionnel de l'opérateur.
--
-- Additif et nullable : aucune fiche existante n'en porte, et le back-office
-- désactive son bouton tant que la colonne est vide plutôt que de composer un
-- numéro par défaut. Rien à reprendre depuis "user"."phone" — c'est le numéro
-- personnel du titulaire du compte, pas la ligne de l'entreprise.

-- AlterTable
ALTER TABLE "operators" ADD COLUMN     "whatsapp" TEXT;
