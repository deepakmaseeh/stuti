import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { loadMeta, type MetaRow } from '../../lib/search';
import {
  getSet,
  hydrateSets,
  serviceLabel,
  songItems,
  type WorshipSet,
} from '../../lib/sets';
import { formatSetDate } from '../../lib/setlist';

export default function SetsPrint() {
  const [set, setSet] = useState<WorshipSet | null | undefined>(undefined);
  const [meta, setMeta] = useState<Record<string, MetaRow> | null>(null);

  useEffect(() => {
    hydrateSets();
    const id = new URLSearchParams(location.search).get('id');
    setSet(id ? getSet(id) ?? null : null);
    loadMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  if (set === undefined) return <div class="set-skeleton" aria-hidden="true" />;
  if (!set) {
    return (
      <div class="notice">
        <p>{t('set.notFound')}</p>
        <a href="/sets/">{t('sets.back')}</a>
      </div>
    );
  }

  const songs = songItems(set);

  return (
    <div class="sets-print">
      <header class="sets-print__head">
        <p class="sets-print__brand">Stuti</p>
        <h1>{set.title}</h1>
        <p>
          {formatSetDate(set.date)}
          {set.time ? ` · ${set.time}` : ''} · {serviceLabel(set.service)}
        </p>
        {set.leader ? <p>{set.leader}</p> : null}
      </header>

      <ol class="sets-print__list">
        {set.items.map((it) => {
          if (it.kind === 'heading') {
            return (
              <li class="sets-print__heading" key={it.uid}>
                {it.text}
              </li>
            );
          }
          const i = songs.findIndex((s) => s.uid === it.uid);
          const title = meta?.[it.songId]?.[0] ?? it.songId;
          const roman = meta?.[it.songId]?.[1];
          return (
            <li key={it.uid}>
              <strong>
                {i + 1}. {title}
              </strong>
              {roman ? <span class="sets-print__roman"> · {roman}</span> : null}
              {it.book ? <span> · {it.book}</span> : null}
              {it.key ? <span> · Key {it.key}</span> : null}
              {it.verses?.length ? (
                <span> · vv {it.verses.map((v) => v + 1).join(', ')}</span>
              ) : null}
              {it.note ? <div class="sets-print__note">{it.note}</div> : null}
            </li>
          );
        })}
      </ol>

      {set.notes ? <p class="sets-print__notes">{set.notes}</p> : null}

      <div class="sets-print__actions no-print">
        <button type="button" class="btn btn--primary" onClick={() => print()}>
          {t('set.print')}
        </button>
        <a class="btn btn--ghost" href={`/sets/edit/?id=${encodeURIComponent(set.id)}`}>
          {t('sets.back')}
        </a>
      </div>
    </div>
  );
}
