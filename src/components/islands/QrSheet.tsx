import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { copyText, shareLink } from '../../lib/share';
import Sheet from './Sheet';

type Props = { open: boolean; onClose: () => void; url: string; title: string };

const QR_COLORS = { dark: '#3b1a1f', light: '#ffffff' };

/** SVG → PNG at print size, for church bulletins. */
async function downloadPng(svg: string, name: string) {
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

export default function QrSheet({ open, onClose, url, title }: Props) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // Loaded on demand so the QR library is not in the set page's first load.
    import('qrcode')
      .then((QR) => QR.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: QR_COLORS }))
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [open, url]);

  // The SVG comes from the qrcode library (not from content), as an <img> data URL so it is never parsed as HTML.
  const imgSrc = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';

  return (
    <Sheet open={open} onClose={onClose} title={t('qr.title')} id="qr">
      <div class="qr">
        <div class="qr__code">
          {imgSrc && <img src={imgSrc} width={180} height={180} alt={t('qr.alt')} />}
        </div>
        <p class="qr__scan">{t('set.scan')}</p>
        <p class="qr__url" data-testid="share-url">
          {url}
        </p>
        <div class="form__actions">
          <button type="button" class="btn btn--secondary" onClick={() => copyText(url)}>
            {t('qr.copy')}
          </button>
          <button type="button" class="btn btn--primary" onClick={() => shareLink({ title, url })}>
            {t('qr.shareVia')}
          </button>
        </div>
        <button type="button" class="btn btn--ghost" disabled={!svg} onClick={() => downloadPng(svg, title)}>
          {t('qr.download')}
        </button>
        <p class="muted">{t('qr.note')}</p>
      </div>
    </Sheet>
  );
}
