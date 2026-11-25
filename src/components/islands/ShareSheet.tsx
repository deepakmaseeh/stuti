import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  CalendarPlus,
  Check,
  FileText,
  Link,
  MonitorPlay,
  Presentation,
  Printer,
  QrCode,
  Share2,
} from 'lucide-preact';
import { t } from '../../i18n';
import type { BookBundle, BookBundleSong } from '../../lib/book-bundle';
import { downloadIcs } from '../../lib/ics';
import { downloadSetPptx } from '../../lib/export/pptx';
import { copyText, shareLink } from '../../lib/share';
import {
  encodeWorshipSet,
  MAX_SHARE_URL,
  setShareUrl,
  songItems,
  type WorshipSet,
} from '../../lib/sets';
import { showToast } from '../../lib/toast';
import { worshipSetWhatsAppText, whatsappShareUrl } from '../../lib/whatsapp-text';
import { site } from '../../site.config';
import Sheet from './Sheet';

type Props = {
  open: boolean;
  onClose: () => void;
  set: WorshipSet;
  titles?: Record<string, string>;
};

const QR_COLORS = { dark: '#3b1a1f', light: '#ffffff' };

async function downloadQrPng(svg: string, name: string) {
  const img = new Image();
  const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = QR_COLORS.light;
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(src);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'stuti-set'}-qr.png`;
  a.click();
}

/** One share sheet: WhatsApp, link, Share…, QR, OOS, PPT, lyrics PDF, calendar (MASTER §11). */
export default function ShareSheet({ open, onClose, set, titles = {} }: Props) {
  const [svg, setSvg] = useState('');
  const [qrFull, setQrFull] = useState(false);
  const [building, setBuilding] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const code = encodeWorshipSet(set);
  const shareUrl = setShareUrl(code);
  const songs = songItems(set);
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(set.date + 'T12:00:00'));

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    import('qrcode')
      .then((QR) =>
        QR.toString(shareUrl, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          color: QR_COLORS,
        }),
      )
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [open, shareUrl]);

  const imgSrc = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
  const waText = worshipSetWhatsAppText(set, { titles, url: shareUrl });

  const exportPpt = async () => {
    if (building) return;
    setBuilding(true);
    showToast(t('set.pptBuilding'));
    try {
      const bookIds = [...new Set(songs.map((s) => s.book || site.defaultBookId))];
      const bundles = await Promise.all(
        bookIds.map((b) =>
          fetch(`/data/books/${b}.json`)
            .then((r) => (r.ok ? (r.json() as Promise<BookBundle>) : null))
            .catch(() => null),
        ),
      );
      const byId: Record<string, BookBundleSong | undefined> = {};
      for (const bundle of bundles) {
        if (!bundle) continue;
        Object.assign(byId, bundle.songs);
      }
      await downloadSetPptx(set, byId, {
        layers: { n: true, r: true, e: false },
        onProgress: (msg) => showToast(msg),
      });
      showToast(t('set.pptDone'));
    } catch {
      showToast(t('desktop.previewError'));
    } finally {
      setBuilding(false);
    }
  };

  const Tile = ({
    label,
    onClick,
    href,
    external,
    disabled,
    children,
  }: {
    label: string;
    onClick?: () => void;
    href?: string;
    external?: boolean;
    disabled?: boolean;
    children: ComponentChildren;
  }) => {
    const className = disabled ? 'share-tile is-disabled' : 'share-tile';
    if (href) {
      return (
        <a
          class={className}
          href={disabled ? undefined : href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          aria-disabled={disabled}
          onClick={disabled ? (e) => e.preventDefault() : undefined}
        >
          <span class="share-tile__icon" aria-hidden="true">
            {children}
          </span>
          <span class="share-tile__label">{label}</span>
        </a>
      );
    }
    return (
      <button type="button" class={className} disabled={disabled} onClick={onClick}>
        <span class="share-tile__icon" aria-hidden="true">
          {children}
        </span>
        <span class="share-tile__label">{label}</span>
      </button>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Share · ${set.title} · ${dateLabel}`}
      id="share-set"
    >
      <div class="share-sheet">
        <button
          type="button"
          class="share-sheet__qr"
          onClick={() => setQrFull(true)}
          aria-label="Show QR full screen"
        >
          {imgSrc ? <img src={imgSrc} width={140} height={140} alt="" /> : <QrCode size={48} />}
        </button>
        <p class="share-sheet__scan muted">Scan to follow this set</p>
        {shareUrl.length > MAX_SHARE_URL ? <p class="notice">{t('set.tooLong')}</p> : null}

        <div class="share-sheet__tiles">
          <Tile label="WhatsApp" href={whatsappShareUrl(waText)} external>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                fill="#25D366"
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
              />
            </svg>
          </Tile>
          <Tile
            label="Copy link"
            onClick={() => void copyText(shareUrl, 'Link copied')}
          >
            <Link size={24} strokeWidth={1.75} />
          </Tile>
          {canNativeShare ? (
            <Tile
              label="Share…"
              onClick={() => void shareLink({ title: set.title, text: waText, url: shareUrl })}
            >
              <Share2 size={24} strokeWidth={1.75} />
            </Tile>
          ) : null}
          <Tile
            label="QR image"
            disabled={!svg}
            onClick={() => void downloadQrPng(svg, set.title)}
          >
            <QrCode size={24} strokeWidth={1.75} />
          </Tile>
          <Tile label="Order of service" href={`/sets/print/?id=${encodeURIComponent(set.id)}`}>
            <Printer size={24} strokeWidth={1.75} />
          </Tile>
          <Tile label="PowerPoint" disabled={building} onClick={() => void exportPpt()}>
            {building ? <Check size={24} strokeWidth={1.75} /> : <Presentation size={24} strokeWidth={1.75} />}
          </Tile>
          <Tile
            label="Lyrics PDF"
            href={`/sets/print/?id=${encodeURIComponent(set.id)}&copy=cong&lyrics=1`}
          >
            <FileText size={24} strokeWidth={1.75} />
          </Tile>
          <Tile label="Calendar" onClick={() => downloadIcs(set, shareUrl)}>
            <CalendarPlus size={24} strokeWidth={1.75} />
          </Tile>
          <Tile
            label="Open in Present"
            href={
              songs[0] ? `/present/?id=${encodeURIComponent(set.id)}&i=0` : undefined
            }
            disabled={!songs[0]}
          >
            <MonitorPlay size={24} strokeWidth={1.75} />
          </Tile>
        </div>
      </div>

      {qrFull && imgSrc ? (
        <div class="share-qr-full" role="dialog" aria-modal="true" onClick={() => setQrFull(false)}>
          <img src={imgSrc} alt="QR code" width={280} height={280} />
          <p class="muted">Tap to close</p>
        </div>
      ) : null}
    </Sheet>
  );
}
