import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

// Replace with your real data access (CMS, Supabase, etc.)
async function getEvent(id: string) {
  const events: Record<string, { name: string; date: string; summary: string; image: string }> = {
    "naadamrutha-2026": {
      name: "Naadamrutha 2026",
      date: "2026-10-02",
      summary: "Omkar Samithi's annual evening of Karnataka music in Muscat.",
      image: "/og/naadamrutha.png",
    },
  };
  return events[id] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    return { title: "Event Not Found", robots: { index: false, follow: false } };
  }

  const title = `${event.name} — ${new Date(event.date).getFullYear()}`;

  return {
    title,
    description: event.summary,
    alternates: { canonical: `/events/${id}` },
    openGraph: {
      title,
      description: event.summary,
      url: `https://omkarsamithi.com/events/${id}`,
      siteName: "Omkar Samithi",
      locale: "en_IN",
      type: "article",
      publishedTime: event.date,
      images: [{ url: event.image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: event.summary,
      images: [event.image],
    },
  };
}

// Optional: pre-render known event slugs at build time
export async function generateStaticParams() {
  return [{ id: "naadamrutha-2026" }];
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <main>
      <h1>{event.name}</h1>
      <p>{event.summary}</p>
    </main>
  );
}