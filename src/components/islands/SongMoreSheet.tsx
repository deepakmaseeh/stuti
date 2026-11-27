import { useEffect, useState } from 'preact/hooks';
import { FileText, Flag, Info, Presentation, Settings, Share2, X } from 'lucide-preact';
import { shareLink } from '../../lib/share';

export type SongInfoProps = {
  id: string;
  title: string;
  book: string;
  number: string;
  numbers: { book: string; number: string }[];
  author: string;
  year?: number;
  bibleRefs: string[];
  rightsStatus: string;
  share: { title: string; text: string; url: string };
};

export default function SongMoreSheet({ info }: { info: SongInfoProps }) {
  const [mode, setMode] = useState<'none' | 'more' | 'info'>('none');

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-open-song-more]')) {
        e.preventDefault();
        setMode('more');
      }
    };
    const onOpenMore = () => setMode('more');
    const onOpenInfo = () => setMode('info');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('none');
    };
    document.addEventListener('click', onDocClick);
    addEventListener('stuti:open-song-more', onOpenMore);
    addEventListener('stuti:open-song-info', onOpenInfo);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      removeEventListener('stuti:open-song-more', onOpenMore);
      removeEventListener('stuti:open-song-info', onOpenInfo);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (mode === 'none') return null;

  const others = info.numbers.filter(
    (n) => !(n.book === info.book && String(n.number) === String(info.number)),
  );

  return (
    <>
      <div class="v3-scrim" onClick={() => setMode('none')} />
      {mode === 'more' ? (
        <div class="v3-sheet v3-drawer" role="dialog" aria-modal="true" aria-label="Song options">
          <div class="grab" />
          <div class="sh">
            <h2>
              {info.book} {info.number}
            </h2>
            <button type="button" class="ib ink" aria-label="Close" onClick={() => setMode('none')}>
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div class="sb">
            <button
              type="button"
              class="row-v3"
              data-feature="pdf"
              onClick={() => {
                setMode('none');
                window.print();
              }}
            >
              <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">Lyrics PDF</span>
            </button>
            <button
              type="button"
              class="row-v3"
              data-feature="ppt"
              onClick={() => {
                setMode('none');
                dispatchEvent(new Event('stuti:song-ppt'));
              }}
            >
              <Presentation size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">PowerPoint</span>
            </button>
            <button
              type="button"
              class="row-v3"
              data-feature="share"
              onClick={() => {
                setMode('none');
                void shareLink(info.share);
              }}
            >
              <Share2 size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">Share</span>
            </button>
            <button type="button" class="row-v3" onClick={() => setMode('info')}>
              <Info size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">Song info</span>
            </button>
            <button
              type="button"
              class="row-v3"
              data-feature="report"
              onClick={() => {
                setMode('none');
                dispatchEvent(new CustomEvent('stuti:open-report'));
              }}
            >
              <Flag size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">Report a mistake</span>
            </button>
            <button
              type="button"
              class="row-v3"
              data-feature="settings"
              onClick={() => {
                setMode('none');
                dispatchEvent(new Event('stuti:open-settings'));
              }}
            >
              <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
              <span class="t">Settings</span>
            </button>
          </div>
        </div>
      ) : (
        <div class="v3-sheet v3-drawer" role="dialog" aria-modal="true" aria-label="Song info">
          <div class="grab" />
          <div class="sh">
            <h2>Song info</h2>
            <button type="button" class="ib ink" aria-label="Close" onClick={() => setMode('none')}>
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div class="sb">
            <div class="setrow">
              <span class="muted">Book</span>
              <span>
                {info.book} {info.number}
              </span>
            </div>
            {others.length > 0 ? (
              <div class="setrow">
                <span class="muted">Also in</span>
                <span>{others.map((n) => `${n.book} ${n.number}`).join(' · ')}</span>
              </div>
            ) : null}
            <div class="setrow">
              <span class="muted">Author</span>
              <span>{info.author || 'Traditional'}</span>
            </div>
            {info.year ? (
              <div class="setrow">
                <span class="muted">Year</span>
                <span>{info.year}</span>
              </div>
            ) : null}
            {info.bibleRefs.length > 0 ? (
              <div class="setrow">
                <span class="muted">Scripture</span>
                <span>{info.bibleRefs.join(' · ')}</span>
              </div>
            ) : null}
            <div class="setrow">
              <span class="muted">Rights</span>
              <span>{info.rightsStatus.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
