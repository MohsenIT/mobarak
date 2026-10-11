import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مصحف عثمان‌طه",
  description: "قرآن کریم به خط عثمان‌طه، با تحلیل ریشه‌ای و فهرست کلیدواژه‌ها",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased" style={{ background: "var(--paper)", color: "var(--ink)" }}>
        {children}
      </body>
    </html>
  );
}
