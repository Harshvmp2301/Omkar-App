import { useEffect, useState } from "react";
import { Play, BookOpen, ExternalLink } from "lucide-react";
import NextProgram from "./NextProgram.jsx";
import WhatWeDo from "./WhatWeDo.jsx";
import GalleryStrip from "./GalleryStrip.jsx";
import SevaInvite from "./SevaInvite.jsx";
import { fetchLatestVideos, youtubeEnabled } from "../utils/youtube.js";
import { fetchLatestPosts, bloggerEnabled } from "../utils/blogger.js";

/**
 * The homepage, in the order a visitor needs it:
 *
 *   who we are (the hero above) → what is happening next → what we do →
 *   the community in photographs → seva → the recordings, writing and festival
 *   notes that are worth browsing once the first four have been read.
 *
 * The programs lead because that is what people come for; the recordings and
 * the blog are genuinely useful but they are the archive, so they sit lower
 * and read more quietly.
 */
export default function ContentHub({ t, lang, events = [], onTab, flash }) {
  const festivalPosts = t.festivalPosts;
  // Live uploads remember WHICH language they belong to; any other language
  // falls back to the curated list by pure derivation — no reset-effect.
  const [liveFeed, setLiveFeed] = useState({ lang: null, videos: [] });
  const [liveBlog, setLiveBlog] = useState({ lang: null, posts: [] });

  // Overlay the live channel uploads when the owner has configured API keys
  // (config/README.md). Without keys — or on any failure — the curated list
  // simply stays; the feed can never break the page.
  useEffect(() => {
    if (!youtubeEnabled) return undefined;
    let alive = true;
    fetchLatestVideos(lang).then((live) => {
      if (alive && Array.isArray(live) && live.length) setLiveFeed({ lang, videos: live });
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  // Same contract for the blog: newest posts from the Blogger feed when the
  // owner has set VITE_BLOGGER_BLOG_URL, curated list otherwise.
  useEffect(() => {
    if (!bloggerEnabled) return undefined;
    let alive = true;
    fetchLatestPosts(lang).then((live) => {
      if (alive && Array.isArray(live) && live.length) setLiveBlog({ lang, posts: live });
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  const videos =
    liveFeed.lang === lang && liveFeed.videos.length ? liveFeed.videos : t.videos;

  const blogPosts =
    liveBlog.lang === lang && liveBlog.posts.length ? liveBlog.posts : t.blogPosts;

  return (
    <>
      <NextProgram
        t={t}
        lang={lang}
        events={events}
        onViewAll={() => onTab("events")}
        flash={flash}
      />

      <WhatWeDo t={t} />

      <GalleryStrip t={t} onOpenGallery={() => onTab("gallery")} />

      <SevaInvite t={t} lang={lang} events={events} onOpenSeva={() => onTab("seva")} />

      {/* ---- the archive: recordings, writing, festival notes ---------------- */}
      <div className="section section--archive">
        <div className="section-head reveal">
          <h2 className="section-title display">{t.programsRecordings}</h2>
          <span className="note">{t.sampleLayout}</span>
        </div>

        <div className="video-grid reveal">
          {videos.map((v) => (
            <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="video-card">
              <div className="video-thumb">
                <img
                  src={v.thumbnail}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    // maxresdefault is occasionally missing — fall back to hq,
                    // then hide the image so the gradient shows through.
                    const img = e.currentTarget;
                    if (!img.dataset.retried) {
                      img.dataset.retried = "1";
                      img.src = v.thumbnail.replace("maxresdefault", "hqdefault");
                    } else {
                      img.style.display = "none";
                    }
                  }}
                />
                <div className="play-overlay">
                  <div className="play-circle">
                    <Play size={20} color="var(--on-gold)" fill="var(--on-gold)" aria-hidden="true" />
                  </div>
                </div>
              </div>
              <div className="video-body">
                <p className="video-title">{v.title}</p>
                <div className="video-meta">
                  <span className="video-date">{v.date}</span>
                  <span className="video-tag">{v.tag}</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Blog + festival notes share ONE heading and sit side by side from
            900px up. Three equal section heads in a row read as a CMS listing
            its content types; recordings lead as the featured resource and
            these two read as the secondary material they are. */}
        <div className="section-head section-head--gap reveal">
          <h2 className="section-title display">{t.archiveReading}</h2>
        </div>
        <div className="archive-columns">
          <div className="archive-col reveal">
            <h3 className="archive-label">{t.fromBlog}</h3>
            <div className="blog-list">
              {blogPosts.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="blog-card">
                  <BookOpen size={16} className="blog-icon" aria-hidden="true" />
                  <div className="blog-text">
                    <p className="blog-title">{p.title}</p>
                    <p className="blog-snippet">{p.snippet}</p>
                  </div>
                  <ExternalLink size={12} className="blog-arrow" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="archive-col reveal">
            <h3 className="archive-label">{t.festivalNotes}</h3>
            <div className="fest-grid">
              {festivalPosts.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="fest-card">
                  <p className="fest-title">{f.title}</p>
                  <p className="fest-snippet">{f.snippet}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
