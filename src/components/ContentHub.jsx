import { useEffect, useState } from "react";
import { Play, BookOpen, ExternalLink } from "lucide-react";
import { fetchLatestVideos, youtubeEnabled } from "../utils/youtube.js";

export default function ContentHub({ t, lang }) {
  const blogPosts = t.blogPosts;
  const festivalPosts = t.festivalPosts;
  const [videos, setVideos] = useState(t.videos);

  // Language/content switch → fall back to the curated list first…
  useEffect(() => {
    setVideos(t.videos);
  }, [t]);

  // …then overlay the live channel uploads when the owner has configured
  // API keys (.env.example). Without keys — or on any failure — the curated
  // list simply stays; the feed can never break the page.
  useEffect(() => {
    let alive = true;
    if (!youtubeEnabled) return undefined;
    fetchLatestVideos(lang).then((live) => {
      if (alive && Array.isArray(live) && live.length) setVideos(live);
    });
    return () => {
      alive = false;
    };
  }, [lang, t]);

  return (
    <div className="section">
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
                  <Play size={20} color="#170B10" fill="#170B10" aria-hidden="true" />
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

      <div className="section-head section-head--gap reveal">
        <h2 className="section-title display">{t.fromBlog}</h2>
      </div>
      <div className="blog-list reveal">
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

      <div className="section-head section-head--gap reveal">
        <h2 className="section-title display">{t.festivalNotes}</h2>
      </div>
      <div className="fest-grid reveal">
        {festivalPosts.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="fest-card">
            <p className="fest-title">{f.title}</p>
            <p className="fest-snippet">{f.snippet}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
