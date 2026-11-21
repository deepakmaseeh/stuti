import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  createSet,
  defaultDateForService,
  isoDate,
  nextSunday,
  serviceLabel,
  templateHeadings,
  type ServiceType,
} from '../../lib/sets';

type TemplateId = 'sunday_morning' | 'christmas' | 'wedding' | 'funeral';

const TEMPLATES: Array<{ id: TemplateId; time: string; blurb: string }> = [
  { id: 'sunday_morning', time: '10:00', blurb: 'Opening · Praise · Sermon · Closing' },
  { id: 'christmas', time: '19:00', blurb: 'Carols · Reading · Closing' },
  { id: 'wedding', time: '11:00', blurb: 'Entrance · Worship · Closing' },
  { id: 'funeral', time: '10:30', blurb: 'Opening · Tribute · Closing' },
];

function sundayIso(which: 'this' | 'next'): string {
  const today = new Date();
  const sun = nextSunday(today);
  if (which === 'next') {
    const [y, m, d] = sun.split('-').map(Number);
    const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
    dt.setDate(dt.getDate() + 7);
    return isoDate(dt);
  }
  // If today is Sunday, nextSunday may already be today or next — defaultDate uses nextSunday
  return sun;
}

export default function NewSetDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [service, setService] = useState<ServiceType>('sunday_morning');
  const [date, setDate] = useState(() => defaultDateForService('sunday_morning'));
  const [time, setTime] = useState('10:00');
  const [title, setTitle] = useState(() => serviceLabel('sunday_morning'));
  const [leader, setLeader] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);

  useEffect(() => {
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  if (!open) return null;

  const pickTemplate = (id: TemplateId) => {
    setService(id);
    const tpl = TEMPLATES.find((x) => x.id === id)!;
    setTime(tpl.time);
    setDate(defaultDateForService(id));
    setTitle(serviceLabel(id));
    setUseTemplate(true);
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const items =
      useTemplate && TEMPLATES.some((x) => x.id === service)
        ? templateHeadings(service as TemplateId)
        : [];
    const set = createSet({
      title: title.trim() || serviceLabel(service),
      date,
      time,
      service,
      leader: leader.trim() || undefined,
      items,
      makeActive: true,
    });
    onCreated(set.id);
    onClose();
  };

  return (
    <div class="modal modal--center" role="dialog" aria-modal="true" aria-labelledby="new-set-title">
      <div class="modal__backdrop" onClick={onClose} />
      <form class="modal__card" onSubmit={submit}>
        <header class="modal__head">
          <h2 id="new-set-title">{t('set.newSet')}</h2>
          <p class="modal__sub">Pick a service template, then adjust date and leader.</p>
        </header>
        <div class="modal__body">
          <div class="tpl-grid" role="group" aria-label={t('set.service')}>
            {TEMPLATES.map((tpl) => (
              <button
                type="button"
                key={tpl.id}
                class={service === tpl.id ? 'is-on' : undefined}
                onClick={() => pickTemplate(tpl.id)}
              >
                {serviceLabel(tpl.id)}
                <small>
                  {tpl.time} · {tpl.blurb}
                </small>
              </button>
            ))}
          </div>

          <div class="chip-row" role="group" aria-label={t('set.date')}>
            <button type="button" class="chip" onClick={() => setDate(sundayIso('this'))}>
              This Sunday
            </button>
            <button type="button" class="chip" onClick={() => setDate(sundayIso('next'))}>
              Next Sunday
            </button>
          </div>

          <div class="g2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label class="field">
              <span class="field__label">{t('set.date')}</span>
              <input
                class="field__input"
                type="date"
                required
                lang="en-IN"
                value={date}
                onClick={(e) => {
                  try {
                    (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                  } catch {
                    /* */
                  }
                }}
                onInput={(e) => setDate(e.currentTarget.value)}
              />
            </label>
            <label class="field">
              <span class="field__label">{t('set.time')}</span>
              <input
                class="field__input"
                type="time"
                value={time}
                onInput={(e) => setTime(e.currentTarget.value)}
              />
            </label>
          </div>

          <label class="field">
            <span class="field__label">{t('set.titleLabel')}</span>
            <input
              class="field__input"
              type="text"
              maxLength={80}
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </label>

          <label class="field">
            <span class="field__label">{t('set.leader')}</span>
            <input
              class="field__input"
              type="text"
              maxLength={80}
              value={leader}
              placeholder="Ps. Samuel"
              onInput={(e) => setLeader(e.currentTarget.value)}
            />
          </label>

          <label class="field field--check">
            <input
              type="checkbox"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.currentTarget.checked)}
            />
            <span class="field__label">{t('set.useTemplate')}</span>
          </label>
        </div>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" onClick={onClose}>
            {t('set.cancel')}
          </button>
          <button type="submit" class="btn btn--primary">
            {t('set.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
