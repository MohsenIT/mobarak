import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/branding";
import { ReadingScreenProvider } from "@/components/quran/ReadingScreen";
import { AppearanceProvider } from "@/components/quran/Appearance";
import PwaRegistration from "@/components/quran/PwaRegistration";

export const metadata: Metadata = {
  title: APP_NAME,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/logo-5-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/logo-5-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/logo-5-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
  description: "قرآن کریم به خط عثمان‌طه، با تحلیل ریشه‌ای و فهرست کلیدواژه‌ها",
};

export const viewport: Viewport = { themeColor: "#faf4df", viewportFit: "auto" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        <AppearanceProvider><ReadingScreenProvider>
          {children}
          <PwaRegistration />
        </ReadingScreenProvider></AppearanceProvider>
      </body>
    </html>
  );
}
