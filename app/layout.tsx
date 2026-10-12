import type { Metadata } from "next";
import { GoogleAnalytics } from '@next/third-parties/google';
// import "./globals.css"; (keep your existing CSS imports)

export const metadata: Metadata = {
  metadataBase: new URL("https://omkarsamithi.com"),
  title: {
    default: "Omkar Samithi — Karnataka Culture",
    template: "%s — Omkar Samithi", 
  },
  description: "Preserving Karnataka's culture, traditions and community.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXXXXXXX" />
    </html>
  );
}