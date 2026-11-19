let timer: ReturnType<typeof setTimeout> | undefined;

/** Bottom toast above the nav, 3 s, announced via role="status" (spec §9.3). */
export function showToast(message: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => el?.classList.remove('is-visible'), 3000);
}
