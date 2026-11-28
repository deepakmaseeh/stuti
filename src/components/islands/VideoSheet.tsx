import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Play, Share2, ThumbsUp, WifiOff, X } from 'lucide-preact';
import type { MediaItem } from '../../lib/schema';
import { shareLink } from '../../lib/share';

type Props = {
  open: boolean;
  onClose: () => void;
  videos: MediaItem[];
  songTitle: string;
};

export default function VideoSheet({ open, onClose, videos, songTitle }: Props) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    return () => {
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!open) setPlaying(false);
    if (typeof document !== 'undefined') {
      if (open) document.documentElement.setAttribute('data-video-open', '1');
      else document.documentElement.removeAttribute('data-video-open');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-video-open');
      }
    };
  }, [open]);

  if (!open || videos.length === 0) return null;
  const active = videos[cur] ?? videos[0]!;
  const ytUrl = `https://youtu.be/${active.youtubeId}${active.start ? `?t=${active.start}` : ''}`;

  const content = (
    <>
      <div class="v3-scrim" onClick={onClose} />
      <div class="v3-sheet v3-drawer" role="dialog" aria-modal="true" aria-label="Videos">
        <div class="grab" />
        <div class="sh">
          <h2>Videos</h2>
          <button type="button" class="ib ink" aria-label="Close videos" onClick={onClose}>
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div class="sb">
          {!online ? (
            <div class="poster" style={{ cursor: 'default' }}>
              <div style={{ textAlign: 'center', padding: 16 }}>
                <WifiOff size={28} strokeWidth={1.75} aria-hidden="true" style={{ margin: '0 auto 8px' }} />
                <div>Videos need internet</div>
              </div>
            </div>
          ) : playing ? (
            <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${active.youtubeId}?autoplay=1&playsinline=1&rel=0&start=${active.start || 0}`}
                title={active.title || songTitle}
                style={{ width: '100%', height: '100%', border: 0 }}
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              type="button"
              class="poster"
              style={{ width: '100%', border: 0, textAlign: 'left' }}
              aria-label={`Play ${active.title}`}
              onClick={() => setPlaying(true)}
            >
              <span class="play">
                <Play size={28} fill="#fff" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span class="cap">{active.title}</span>
            </button>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <a
              href={ytUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn-v3 sec sm"
              style={{ flex: 1 }}
            >
              <ThumbsUp size={16} strokeWidth={1.75} aria-hidden="true" />
              Like / comment on YouTube
            </a>
            <button
              type="button"
              class="btn-v3 sec sm icon"
              aria-label="Share video"
              onClick={() => void shareLink({ title: active.title || songTitle, text: active.title, url: ytUrl })}
            >
              <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div class="lbl" style={{ margin: '18px 0 4px' }}>
            {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          </div>
          {videos.map((v, i) => (
            <button
              type="button"
              key={`${v.youtubeId}-${i}`}
              class="vrow"
              style={{
                width: '100%',
                background: 'none',
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                textAlign: 'left',
                color: 'inherit',
                opacity: i === cur ? 1 : 0.8,
              }}
              onClick={() => {
                setCur(i);
                setPlaying(false);
              }}
            >
              <span class="vthumb">
                <Play size={18} fill="#fff" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{v.title}</div>
                <div class="muted sm">
                  {v.kind}
                  {i === cur ? ' · selected' : ''}
                </div>
              </div>
            </button>
          ))}
          <p class="muted sm" style={{ marginTop: 12 }}>
            Needs internet. Closing this stops the video.
          </p>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
