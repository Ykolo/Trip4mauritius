import type { Metadata, Viewport } from "next";
import { Pacifico, Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ServiceWorkerInit } from "@/components/layout/ServiceWorkerInit";
import { TRPCReactProvider } from "@/lib/trpc/client";

const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pacifico",
  display: "swap",
});

const poppins = Poppins({
  weight: ["300", "400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

// Sans metadataBase, les images Open Graph se résolvent sur localhost:3000 —
// donc aucun aperçu au partage d'un lien, ce qui compte pour une PWA dont
// l'acquisition passe par le partage et la recherche.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Trip4mauritius - Discover Mauritius",
  description:
    "Luxury tourism marketplace for Mauritius. Discover and book amazing activities, tours, and experiences on the beautiful island of Mauritius.",
  generator: "Next.js",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/logopen.jpg", type: "image/jpeg" },
    ],
    apple: "/images/logopen.jpg",
  },
  openGraph: {
    images: ["/images/logopen.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trip4mauritius",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#06B6D4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pacifico.variable} ${poppins.variable}`}>
      <body className="font-sans antialiased bg-base text-ink">
        <ServiceWorkerInit />
        <TRPCReactProvider>
          <main className="min-h-screen">{children}</main>
        </TRPCReactProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
