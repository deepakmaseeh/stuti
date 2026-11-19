import { t } from '../i18n';
import { showToast } from './toast';

/** Web Share with a copy-link fallback (spec §8 F9). */
export async function shareLink(data: { title: string; text?: string; url: string }): Promise<void> {
  const url = new URL(data.url, location.origin).href;
  if (navigator.share) {
    try {
      await navigator.share({ ...data, url });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  await copyText(url);
}

export async function copyText(text: string, message = t('toast.copied')): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    window.prompt('Copy this:', text);
  }
}
