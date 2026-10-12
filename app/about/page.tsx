import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us", // renders as "About Us — Omkar Samithi" via the template
  description:
    "Omkar Samithi is the Kannada community association of Muscat, Oman — annual programs in devotion, music and knowledge since 2001.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Omkar Samithi",
    description:
      "The Kannada community association of Muscat, Oman — culture, traditions and community kept alive through devotion, music and knowledge.",
    url: "https://omkarsamithi.com/about",
    siteName: "Omkar Samithi",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og/about.png", width: 1200, height: 630, alt: "Omkar Samithi — About" }],
  },
};

export default function AboutPage() {
  return (
    <main>
      <h1>About Omkar Samithi</h1>
      {/* page content */}
    </main>
  );
}