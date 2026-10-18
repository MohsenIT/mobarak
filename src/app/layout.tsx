import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/components/quran/PwaRegistration";

export const metadata: Metadata = {
  title: "مصحف عثمان‌طه",
  applicationName: "قرآن واژه",
  appleWebApp: { capable: true, title: "قرآن واژه", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/quran-vajeh.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  description: "قرآن کریم به خط عثمان‌طه، با تحلیل ریشه‌ای و فهرست کلیدواژه‌ها",
};

export const viewport: Viewport = { themeColor: "#0e2a22", viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
