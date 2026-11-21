import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  createSet,
  defaultDateForService,
  defaultTitle,
  templateHeadings,
  type ServiceType,
} from '../../lib/sets';

const SERVICES: { id: ServiceType; label: string }[] = [
  { id: 'sunday_morning', label: 'Sunday morning' },
  { id: 'sunday_evening', label: 'Sunday evening' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'youth', label: 'Youth' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'easter', label: 'Easter' },
  { id: 'good_friday', label: 'Good Friday' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'funeral', label: 'Funeral' },
  { id: 'other', label: 'Other' },
];

const TEMPLATES: Array<'sunday_morning' | 'christmas' | 'wedding' | 'funeral'> = [
  'sunday_morning',
  'christmas',
  'wedding',
  'funeral',
];

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
  const [title, setTitle] = useState(() =>
    defaultTitle('sunday_morning', defaultDateForService('sunday_morning')),
  );
  const [useTemplate, setUseTemplate] = useState(true);

  useEffect(() => {
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  if (!open) return null;

  const onService = (s: ServiceType) => {
    setService(s);
    const d = defaultDateForService(s);
    setDate(d);
    setTitle(defaultTitle(s, d));
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const items =
      useTemplate && (TEMPLATES as string[]).includes(service)
        ? templateHeadings(service as (typeof TEMPLATES)[number])
        : [];
    const set = createSet({
      title: title.trim() || defaultTitle(service, date),
      date,
      service,
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
        </header>
        <div class="modal__body">
          <label class="field">
            <span class="field__label">{t('set.service')}</span>
            <select
              class="field__input"
              value={service}
              onChange={(e) => onService(e.currentTarget.value as ServiceType)}
            >
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="field__label">{t('set.date')}</span>
            <input
              class="field__input"
              type="date"
              required
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </label>
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
