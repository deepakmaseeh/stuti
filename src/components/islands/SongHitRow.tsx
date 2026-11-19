import { LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import type { Hit } from '../../lib/search';
import { songUrl } from '../../lib/songs';

/** Preact twin of SongRow.astro + NumberBadge.astro for client-rendered lists. */
export default function SongHitRow({ hit, href }: { hit: Hit; href?: string }) {
  const [book = '', number = ''] = hit.badge.split(' ');
  const lang = hit.lang as Lang;
  return (
    <a class="song-row" href={href ?? songUrl(hit.id)}>
      <span class="badge badge--list" role="img" aria-label={hit.badge}>
        <span class="badge__book" aria-hidden="true">
          {book}
        </span>
        <span class="badge__num" aria-hidden="true">
          {number}
        </span>
      </span>
      <span class="song-row__text">
        <span class="song-row__title" lang={LANG_TAG.n[lang]}>
          {hit.title}
        </span>
        {hit.roman && hit.roman !== hit.title && (
          <span class="song-row__sub" lang={LANG_TAG.r[lang]}>
            {hit.roman}
          </span>
        )}
      </span>
    </a>
  );
}
