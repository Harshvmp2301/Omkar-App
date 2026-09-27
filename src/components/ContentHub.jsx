import { Play, BookOpen, ExternalLink } from "lucide-react";

export default function ContentHub({ t }) {
  const videos = t.videos;
  const blogPosts = t.blogPosts;
  const festivalPosts = t.festivalPosts;

  return (
    <div className="section">
      <div className="section-head">
        <h2 className="section-title display">{t.programsRecordings}</h2>
        <span className="note">{t.sampleLayout}</span>
      </div>

      <div className="video-grid">
        {videos.map((v) => (
          <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="video-card">
            <div
              className="video-thumb"
              style={{
                backgroundImage: `url(${v.thumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
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

      <h2 className="section-title display" style={{ marginBottom: 14 }}>
        {t.fromBlog}
      </h2>
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

      <h2 className="section-title display" style={{ marginBottom: 14, marginTop: 32 }}>
        {t.festivalNotes}
      </h2>
      <div className="fest-grid">
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
