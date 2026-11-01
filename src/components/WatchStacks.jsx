import { useEffect, useState } from "react";
import {
  PROGRAM_PLAYLISTS,
  fetchPlaylistItems,
  playlistUrl,
} from "../utils/youtube.js";
import { EVENT_TITLES } from "../utils/events.js";

/**
 * Round 70, final ruling — the showcase the owner pointed at: a fan of
 * stacked photo-cards, one per standing program, overlapping like scattered
 * prints. Each card fans the three NEWEST thumbnails of that program's
 * playlist (newest added to the playlist on top, sorted by the date YouTube
 * recorded the add), and on hover the fan springs open with a stagger while
 * the card lifts — the same motion as the reference component, rebuilt in
 * pure CSS springs so the bundle gains no animation library.
 *
 * The whole card is a door: one click takes the visitor straight to that
 * program's YouTube playlist in a new tab. No pills, no arrows, no player
 * dialog, no click-maze — three cards, three playlists, everything visible.
 *
 * Without the API key, or on any failure, the cards still stand and still
 * lead to their playlists; the fan simply rests empty with a quiet note.
 */

const nameOf = (i, lang) => (lang === "kn" ? EVENT_TITLES[i].kn : EVENT_TITLES[i].en);

export default function WatchStacks({ t, lang }) {
  const [shelves, setShelves] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.allSettled(
      PROGRAM_PLAYLISTS.map((p) => fetchPlaylistItems(p.playlistId)),
    ).then((results) => {
      if (!alive) return;
      const next = {};
      results.forEach((r, i) => {
        next[PROGRAM_PLAYLISTS[i].playlistId] =
          r.status === "fulfilled" && r.value ? r.value : [];
      });
      setShelves(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="section section--watch" id="watch">
      <div className="section-head reveal">
        <h2 className="section-title display">{t.watchTitle}</h2>
        <span className="note">{t.watchSub}</span>
      </div>

      <div className="watch-stacks reveal">
        {PROGRAM_PLAYLISTS.map((p, i) => {
          const videos = shelves[p.playlistId];
          // newest ADDED to the playlist first — the top of the fan is the
          // freshest video, exactly as the owner asked.
          const newest = videos && videos.length
            ? [...videos].sort((a, b) =>
                String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
            : [];
          const fan = newest.slice(0, 3);
          return (
            <a
              key={p.id}
              className="stack-card"
              href={playlistUrl(p.playlistId)}
              target="_blank"
              rel="noreferrer"
              aria-label={`${nameOf(i, lang)} — ${t.stackKicker}`}
            >
              <p className="stack-kicker display">{t.stackKicker}</p>
              <h3 className="stack-title display">{nameOf(i, lang)}</h3>
              <p className="stack-sub">
                {!videos ? t.shelfLoading : newest.length ? newest[0].title : t.shelfFail}
              </p>
              <div className="stack-fan">
                {!videos
                  ? [0, 1, 2].map((k) => (
                      <span key={k} className="stack-photo stack-skeleton" aria-hidden="true" />
                    ))
                  : fan.map((v, k) => (
                      <img
                        key={v.id}
                        className={`stack-photo${k === 0 ? " stack-photo--top" : ""}`}
                        src={v.thumbnail}
                        alt=""
                        width={320}
                        height={180}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.retried) {
                            img.dataset.retried = "1";
                            img.src = img.src
                              .replace("i.ytimg.com/vi_webp/", "img.youtube.com/vi/")
                              .replace(".webp", ".jpg");
                          } else {
                            img.style.display = "none";
                          }
                        }}
                      />
                    ))}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
