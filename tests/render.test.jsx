import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeAll } from "vitest";
import { translations } from "../src/data/content.js";
import AboutView from "../src/components/AboutView.jsx";
import Contact from "../src/components/Contact.jsx";
import ContactView from "../src/components/ContactView.jsx";
import ContentHub from "../src/components/ContentHub.jsx";
import EventsView from "../src/components/EventsView.jsx";
import GalleryView from "../src/components/GalleryView.jsx";
import Hero from "../src/components/Hero.jsx";
import SevaView from "../src/components/SevaView.jsx";

/**
 * Every view, rendered for real — server-side, in both languages.
 *
 * There is no browser in this environment, so a DOM test is not available;
 * what IS available is React's own renderer. That catches the failures a grep
 * cannot: a component crashing on missing data, a raw `undefined` or `NaN`
 * reaching the page, a heading level that never got promoted, or a Kannada
 * string that renders as the literal key. Effects do not run here, so this is
 * the markup a reader would receive, not the animated result.
 */

beforeAll(() => {
  // The components read these in state initialisers; effects never run under
  // renderToStaticMarkup. Kept deliberately minimal and obvious.
  globalThis.document = {
    documentElement: {
      lang: "en",
      getAttribute: () => "dark",
      setAttribute() {},
      style: { setProperty() {} },
    },
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window = {
    location: { hash: "" },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  };
  // `navigator` already exists in Node and is read-only — leave it alone.
});

const noop = () => {};
const locales = [
  ["en", translations.en],
  ["kn", translations.kn],
];

function render(element) {
  return renderToStaticMarkup(element);
}

function headings(html) {
  return {
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]*>/g, "").trim()),
    h2: [...html.matchAll(/<h2[^>]*>/g)].length,
  };
}

describe.each(locales)("rendering the %s views", (lang, t) => {
  const events = t.eventsList;

  const views = {
    Hero: <Hero t={t} events={events} onGoToEvents={noop} onGoToAbout={noop} />,
    ContentHub: <ContentHub t={t} lang={lang} events={events} onTab={noop} flash={noop} />,
    EventsView: (
      <EventsView
        t={t}
        lang={lang}
        events={events}
        notify={{}}
        onToggleNotify={noop}
        flash={noop}
      />
    ),
    GalleryView: <GalleryView t={t} lang={lang} />,
    SevaView: <SevaView t={t} lang={lang} flash={noop} />,
    AboutView: <AboutView t={t} />,
    ContactView: <ContactView t={t} lang={lang} flash={noop} />,
    Contact: <Contact t={t} />,
  };

  it.each(Object.keys(views))("%s renders without throwing", (name) => {
    expect(() => render(views[name])).not.toThrow();
  });

  it.each(Object.keys(views))("%s leaks no raw value", (name) => {
    const html = render(views[name]);
    expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
    // a bare translation key reaching the DOM ("someLabel" with no spaces)
    expect(html).not.toMatch(/>\s*[a-z][A-Za-z]+[A-Z][A-Za-z]+\s*</);
    expect(html.trim().length).toBeGreaterThan(80);
  });

  it("gives the homepage exactly one h1, in the hero", () => {
    const { h1 } = headings(render(views.Hero));
    expect(h1).toEqual(["Oman Karnataka Aradhana Samithi"]);
  });

  it.each([
    ["EventsView", "EventsView"],
    ["GalleryView", "GalleryView"],
    ["SevaView", "SevaView"],
    ["AboutView", "AboutView"],
  ])("%s presents its own heading as the page h1", (_label, name) => {
    const { h1 } = headings(render(views[name]));
    expect(h1.length, "exactly one h1 per view").toBe(1);
    expect(h1[0].length).toBeGreaterThan(2);
  });

  it("keeps the About tab to a single h1 across its three sections", () => {
    const html = render(
      <>
        {views.AboutView}
        {views.ContactView}
        {views.Contact}
      </>
    );
    expect(headings(html).h1.length).toBe(1);
  });

  it("says who and where on the first screen", () => {
    const html = render(views.Hero);
    expect(html).toContain(t.appName);
    expect(html).toContain("Oman Karnataka Aradhana Samithi");
    expect(html).toContain(t.heroLine);
    expect(html).toContain(t.heroCtaPrograms);
    expect(html).toContain(t.heroCtaAbout);
  });

  it("names the venue in the next-program card", () => {
    const html = render(views.ContentHub);
    // The venue is localized, so compare against the data, not a literal.
    const venue = (t.eventsList.find((e) => e.venue) || {}).venue || "";
    expect(venue).not.toBe("");
    expect(html).toContain(venue.split(",")[0].trim());
  });
});
