import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "underbar — מערכת ניהול",
  description: "מערכת CRM לניהול לקוחות, לידים ומכירות",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}


