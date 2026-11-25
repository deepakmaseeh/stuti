import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { LANG_LABEL, LANG_NATIVE, LANG_TAG } from '../../lib/scripts';
import type { Lang } from '../../lib/schema';
import { decodeSet, encodeSet, getDraft, getSavedSets, saveSet, type SetList } from '../../lib/setlist';
import {
  DEFAULT_PREFS,
  SIZE_STEPS,
  clearAllData,
  storage,
  updatePrefs,
  type Prefs,
} from '../../lib/storage';
import { showToast } from '../../lib/toast';
import Sheet from './Sheet';
import { ThemeSegment } from './ThemeToggle';

type Props = { languages: Lang[]; samples: Partial<Record<Lang, string>> };

function applyHtml(p: Prefs) {
  const h = document.documentElement;
  h.dataset.theme = p.theme;
  h.dataset.size = String(p.size);
  h.dataset.layers = (['n', 'r', 'e'] as const).filter((k) => p.layers[k]).join(' ') || 'n';
}

/** Drop every cache this app made (downloaded books, search data, fonts). */
async function clearCaches() {
  if (!('caches' in self)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith('stuti-') || k.startsWith('workbox-')).map((k) => caches.delete(k)),
  );
}

export default function SettingsPanel({ languages, samples }: Props) {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setP(storage.prefs.get()), []);

  const save = (patch: Partial<Prefs>) => {
    const next = updatePrefs(patch);
    setP(next);
    applyHtml(next);
  };

  const toggleLayer = (k: 'n' | 'r' | 'e') => {
    const layers = { ...p.layers, [k]: !p.layers[k] };
    if (!layers.n && !layers.r && !layers.e) return;
    save({ layers });
  };

  const toggleLang = (l: Lang) => {
    const has = p.searchLangs.includes(l);
    const next = has ? p.searchLangs.filter((x) => x !== l) : [...p.searchLangs, l];
    if (next.length) save({ searchLangs: next });
  };

  const exportSets = () => {
    const data = {
      app: 'stuti',
      v: 1,
      exportedAt: new Date().toISOString(),
      draft: getDraft(),
      sets: getSavedSets(),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `stuti-sets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importSets = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { app?: unknown; sets?: unknown };
      if (data.app !== 'stuti' || !Array.isArray(data.sets)) throw new Error('not a stuti export');
      // Re-encode + decode so imported sets get exactly the same cleaning as shared links.
      const sets = (data.sets as SetList[])
        .map((s) => {
          try {
            return decodeSet(encodeSet(s));
          } catch {
            return null;
          }
        })
        .filter((s): s is SetList => !!s);
      sets.reverse().forEach(saveSet);
      showToast(t('settings.imported', { n: sets.length }));
    } catch {
      showToast(t('settings.importFailed'));
    }
  };

  const clearData = async () => {
    clearAllData();
    await clearCaches();
    setConfirming(false);
    const fresh = storage.prefs.get();
    setP(fresh);
    applyHtml(fresh);
    showToast(t('settings.clearDone'));
  };

  return (
    <div class="settings">
      <section class="settings__group" aria-labelledby="s-appearance">
        <h2 class="group-title" id="s-appearance">
          Appearance
        </h2>
        <p class="field__label">{t('settings.theme')}</p>
        <ThemeSegment />
      </section>
      <section class="settings__group" aria-labelledby="s-reading">
        <h2 class="group-title" id="s-reading">
          {t('settings.reading')}
        </h2>
        <fieldset class="fieldset">
          <legend>{t('settings.layers')}</legend>
          {(
            [
              ['n', t('settings.layers.native')],
              ['r', t('song.roman')],
              ['e', t('song.english')],
            ] as const
          ).map(([k, label]) => (
            <label class="check">
              <input type="checkbox" checked={p.layers[k]} onChange={() => toggleLayer(k)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <label class="field">
          <span class="field__label">
            {t('settings.size')}: {p.size + 1} / {SIZE_STEPS}
          </span>
          <input
            type="range"
            min={0}
            max={SIZE_STEPS - 1}
            step={1}
            value={p.size}
            onInput={(e) => save({ size: Number(e.currentTarget.value) })}
          />
        </label>
        <div class="size-preview" aria-hidden="true">
          {languages.map((l) =>
            samples[l] ? (
              <p class="size-preview__line" lang={LANG_TAG.n[l]}>
                {samples[l]}
              </p>
            ) : null,
          )}
        </div>

      </section>

      <section class="settings__group" aria-labelledby="s-singing">
        <h2 class="group-title" id="s-singing">
          {t('settings.singing')}
        </h2>
        <label class="check">
          <input type="checkbox" checked={p.keepAwake} onChange={() => save({ keepAwake: !p.keepAwake })} />
          <span>{t('settings.keepAwake')}</span>
        </label>
      </section>

      <section class="settings__group" aria-labelledby="s-search">
        <h2 class="group-title" id="s-search">
          {t('settings.search')}
        </h2>
        <fieldset class="fieldset">
          <legend>{t('settings.searchLangs')}</legend>
          {languages.map((l) => (
            <label class="check">
              <input type="checkbox" checked={p.searchLangs.includes(l)} onChange={() => toggleLang(l)} />
              <span lang={LANG_TAG.n[l]}>{LANG_NATIVE[l]}</span>
              {l !== 'en' && <span class="muted"> · {LANG_LABEL[l]}</span>}
            </label>
          ))}
        </fieldset>
      </section>

      <section class="settings__group" aria-labelledby="s-data">
        <h2 class="group-title" id="s-data">
          {t('settings.data')}
        </h2>
        <div class="stack">
          <button type="button" class="btn btn--secondary" onClick={exportSets}>
            {t('settings.export')}
          </button>
          <label class="btn btn--secondary file-btn">
            {t('settings.import')}
            <input
              type="file"
              accept="application/json,.json"
              class="visually-hidden"
              onChange={(e) => {
                void importSets(e.currentTarget.files?.[0]);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button type="button" class="btn btn--danger" onClick={() => setConfirming(true)}>
            {t('settings.clear')}
          </button>
        </div>
      </section>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={t('settings.clear')} id="clear">
        <p>{t('settings.clearConfirm')}</p>
        <div class="form__actions">
          <button type="button" class="btn btn--secondary" onClick={() => setConfirming(false)}>
            {t('settings.cancel')}
          </button>
          <button type="button" class="btn btn--danger" onClick={clearData}>
            {t('settings.clear')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
