/** @type {import('next').NextConfig} */
const nextConfig = {
  // `typescript.ignoreBuildErrors` était activé : les erreurs de types
  // partaient en production sans bruit. Adopter tRPC pour la sûreté de typage
  // bout-en-bout tout en désactivant la vérification au build est
  // contradictoire — le filet est débranché. Le projet typecheck proprement,
  // donc la vérification est réactivée.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
