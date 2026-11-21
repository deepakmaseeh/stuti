import { t } from '../../i18n';
import type { WorshipSet } from '../../lib/sets';
import { songItems } from '../../lib/sets';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export default function SetsCalendar({
  year,
  month,
  sets,
  onMonthChange,
}: {
  year: number;
  month: number;
  sets: WorshipSet[];
  onMonthChange: (y: number, m: number) => void;
}) {
  const firstDow = new Date(year, month, 1).getDay();
  const dim = daysInMonth(year, month);
  const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );

  const byDay = new Map<string, WorshipSet[]>();
  for (const s of sets) {
    if (!s.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue;
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }

  const prev = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };
  const next = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  const cells: Array<{ day?: number; iso?: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({});
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }

  return (
    <div class="sets-cal">
      <div class="sets-cal__nav">
        <button type="button" class="btn btn--ghost" onClick={prev} aria-label={t('sets.prevMonth')}>
          ‹
        </button>
        <h2>{label}</h2>
        <button type="button" class="btn btn--ghost" onClick={next} aria-label={t('sets.nextMonth')}>
          ›
        </button>
      </div>
      <div class="sets-cal__grid" role="grid">
        {WEEKDAYS.map((w) => (
          <div class="sets-cal__dow" key={w}>
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          const daySets = c.iso ? byDay.get(c.iso) ?? [] : [];
          return (
            <div class={c.day ? 'sets-cal__cell' : 'sets-cal__cell sets-cal__cell--empty'} key={i}>
              {c.day ? <span class="sets-cal__day">{c.day}</span> : null}
              {daySets.map((s) => (
                <a
                  key={s.id}
                  class="sets-cal__event"
                  href={`/sets/edit/?id=${encodeURIComponent(s.id)}`}
                  title={`${s.title} · ${songItems(s).length} songs`}
                >
                  {s.title}
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
