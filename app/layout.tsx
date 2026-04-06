import type { Metadata, Viewport } from "next";
import { Pacifico, Poppins } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ServiceWorkerInit } from "@/components/layout/ServiceWorkerInit";

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

export const metadata: Metadata = {
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
        <main className="min-h-screen">{children}</main>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
