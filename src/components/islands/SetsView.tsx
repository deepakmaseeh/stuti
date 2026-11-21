import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, type MetaRow } from '../../lib/search';
import {
  createSet,
  decodeWorshipSet,
  songInWorshipSetUrl,
  songItems,
  uid,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';
import { showToast } from '../../lib/toast';

function readCode(): string | null {
  return new URLSearchParams(location.hash.slice(1)).get('s');
}

export default function SetsView() {
  const [set, setSet] = useState<WorshipSet | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);

  useEffect(() => {
    const apply = () => {
      const c = readCode();
      if (!c) {
        setSet(null);
        setCode('');
        return;
      }
      setCode(c);
      setSet(decodeWorshipSet(c));
    };
    apply();
    const onHash = () => apply();
    addEventListener('hashchange', onHash);
    document.addEventListener('astro:page-load', onHash);
    loadMeta()
      .then(setMeta)
      .catch(() => {});
    return () => {
      removeEventListener('hashchange', onHash);
      document.removeEventListener('astro:page-load', onHash);
    };
  }, []);

  if (set === undefined) return <div class="set-skeleton" aria-hidden="true" />;

  if (!set) {
    return (
      <div class="page-block notice">
        <p>{t('set.invalid')}</p>
        <a class="btn btn--secondary" href="/sets/">
          {t('sets.back')}
        </a>
      </div>
    );
  }

  const songs = songItems(set);

  const saveCopy = () => {
    const copy = createSet({
      title: set.title,
      date: set.date,
      time: set.time,
      service: set.service,
      items: set.items.map((it) => ({ ...it, uid: uid() })),
      source: 'mine',
      sharedFrom: code.slice(0, 32),
      makeActive: true,
    });
    showToast(t('set.editedToast'));
    location.href = `/sets/edit/?id=${encodeURIComponent(copy.id)}`;
  };

  return (
    <div class="sets-view page-block">
      <p class="eyebrow">{t('set.sharedFrom', { title: set.title })}</p>
      <h1 class="page-title">{set.title}</h1>
      <p class="page-sub">
        {formatSetDate(set.date)}
        {set.time ? ` · ${set.time}` : ''}
        {songs.length ? ` · ${t('desktop.songCount', { n: songs.length })}` : ''}
      </p>

      <ol class="sets-view__list song-list">
        {set.items.map((it) => {
          if (it.kind === 'heading') {
            return (
              <li class="sets-view__heading group-title" key={it.uid}>
                {it.text}
              </li>
            );
          }
          const i = songs.findIndex((s) => s.uid === it.uid);
          const title = meta?.[it.songId]?.[0] ?? it.songId;
          const badge = meta?.[it.songId]?.[3];
          return (
            <li class="sets-view__row" key={it.uid}>
              <a class="song-row sets-view__link" href={songInWorshipSetUrl(set, i, code)} data-astro-reload>
                <span class="sets-view__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span class="song-row__text">
                  <span class="song-row__title">{title}</span>
                  <span class="song-row__sub">
                    {badge || it.songId}
                    {it.key ? ` · ${it.key}` : ''}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <div class="sets-view__actions form__actions">
        <a
          class="btn btn--primary"
          href={songs[0] ? songInWorshipSetUrl(set, 0, code) : undefined}
          data-astro-reload
        >
          {t('set.start')}
        </a>
        <button type="button" class="btn btn--secondary" onClick={saveCopy}>
          {t('set.saveCopy')}
        </button>
        <a class="btn btn--ghost" href="/sets/">
          {t('sets.back')}
        </a>
      </div>
    </div>
  );
}
