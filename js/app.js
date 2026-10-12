// Free AI Sessions: booking calendar.
// Paste your Apps Script web app URL here (see README). Until then the page runs in demo mode.
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_ksAdgdEmIO_Uv-BvWqkM9PUeKnMle6d4Sd7wKXHd0f-7J62otiY51yUVEkdvcJqg/exec';

const DEMO = !/^https:\/\/script\.google\.com\//.test(SCRIPT_URL);
const DEMO_KEY = 'ai-sessions-demo-bookings';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const $ = (id) => document.getElementById(id);

const state = {
  rules: null,      // { today, perMonth, monthsAhead, weekdays, booked: ['yyyy-mm-dd'] }
  view: null,       // { y, m } with m 0-11
  selected: null,   // 'yyyy-mm-dd'
};

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; };
const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

function longDate(s) {
  const { y, m, d } = parse(s);
  return new Date(y, m, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function localToday() {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

/** First and last month a person can book in, as {y, m}. */
function range() {
  const t = parse(state.rules.today);
  const last = new Date(t.y, t.m + state.rules.monthsAhead - 1, 1);
  return { first: { y: t.y, m: t.m }, last: { y: last.getFullYear(), m: last.getMonth() } };
}

function bookedIn(y, m) {
  const key = monthKey(y, m);
  return state.rules.booked.filter((b) => b.startsWith(key)).length;
}

function dayState(y, m, d) {
  const s = iso(y, m, d);
  const r = state.rules;
  if (r.booked.includes(s)) return 'taken';
  if (s <= r.today) return 'off';
  if (!r.weekdays.includes(new Date(y, m, d).getDay())) return 'off';
  if (bookedIn(y, m) >= r.perMonth) return 'off';
  return 'free';
}

// ---------- backend ----------
async function fetchRules() {
  if (DEMO) return demoState();
  const res = await fetch(SCRIPT_URL, { cache: 'no-store' });
  const data = await res.json();
  if (!data.ok) throw new Error('load_failed');
  return data;
}

async function book(payload) {
  if (DEMO) return demoBook(payload);
  // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function demoBookings() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch { return []; }
}

function demoState() {
  return {
    ok: true,
    today: localToday(),
    perMonth: 2,
    monthsAhead: 3,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    booked: demoBookings().map((b) => b.date),
  };
}

function demoBook({ date, name, email }) {
  const list = demoBookings();
  const base = demoState();
  if (list.some((b) => b.date === date)) return { ok: false, error: 'taken', ...base };
  if (list.filter((b) => b.date.slice(0, 7) === date.slice(0, 7)).length >= 2) return { ok: false, error: 'month_full', ...base };
  list.push({ date, name, email });
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch { /* demo only */ }
  return { ok: true, date, ...demoState() };
}

// ---------- rendering ----------
function show(step) {
  for (const id of ['step-pick', 'step-confirm', 'step-details', 'step-done']) $(id).hidden = id !== step;
}

function renderCalendar() {
  const { y, m } = state.view;
  const { first, last } = range();
  const r = state.rules;

  $('month-label').textContent = `${MONTHS[m]} ${y}`;
  $('prev').disabled = y === first.y && m === first.m;
  $('next').disabled = y === last.y && m === last.m;

  const used = Math.min(bookedIn(y, m), r.perMonth);
  const left = r.perMonth - used;
  $('seat-dots').innerHTML = Array.from({ length: r.perMonth }, (_, i) =>
    `<i class="${i < used ? 'used' : 'open'}"></i>`).join('');

  const seats = $('seats-label');
  seats.classList.toggle('last', left === 1);
  seats.classList.toggle('full', left === 0);
  const anyFree = Array.from({ length: daysIn(y, m) }, (_, i) => dayState(y, m, i + 1)).includes('free');
  $('seats-text').textContent =
    left === 0 ? `${MONTHS[m]} is full`
      : !anyFree ? `No dates left in ${MONTHS[m]}`
        : `${left} of ${r.perMonth} seats left`;

  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first grid
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="day blank" aria-hidden="true"></span>');
  for (let d = 1; d <= daysIn(y, m); d++) {
    const s = iso(y, m, d);
    const st = dayState(y, m, d);
    const cls = ['day', st, s === r.today ? 'today' : '', s === state.selected ? 'selected' : ''].join(' ');
    const label = longDate(s) + (st === 'free' ? ', free' : st === 'taken' ? ', taken' : ', not open');
    cells.push(st === 'free'
      ? `<button type="button" class="${cls}" data-date="${s}" aria-label="${label}">${d}</button>`
      : `<span class="${cls}" aria-label="${label}">${d}${st === 'taken' ? '<small>Taken</small>' : ''}</span>`);
  }
  $('days').innerHTML = cells.join('');
}

function setStatus(text, isError) {
  const el = $('pick-status');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

/** Open on the first month that still has a free date. */
function firstOpenMonth() {
  const { first, last } = range();
  let y = first.y, m = first.m;
  while (y < last.y || (y === last.y && m <= last.m)) {
    for (let d = 1; d <= daysIn(y, m); d++) if (dayState(y, m, d) === 'free') return { y, m };
    m++; if (m > 11) { m = 0; y++; }
  }
  return first;
}

function applyRules(data) {
  state.rules = {
    today: data.today || localToday(),
    perMonth: data.perMonth,
    monthsAhead: data.monthsAhead,
    weekdays: data.weekdays,
    booked: data.booked || [],
  };
}

// ---------- events ----------
$('days').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-date]');
  if (!btn) return;
  state.selected = btn.dataset.date;
  $('confirm-date').textContent = longDate(state.selected);
  show('step-confirm');
  $('confirm-yes').focus();
});

$('prev').addEventListener('click', () => {
  const { y, m } = state.view;
  state.view = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  renderCalendar();
});

$('next').addEventListener('click', () => {
  const { y, m } = state.view;
  state.view = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  renderCalendar();
});

$('confirm-yes').addEventListener('click', () => {
  $('details-date').textContent = longDate(state.selected);
  $('details-error').textContent = '';
  show('step-details');
  $('name').focus();
});

function backToCalendar() {
  state.selected = null;
  renderCalendar();
  show('step-pick');
}
$('confirm-back').addEventListener('click', backToCalendar);
$('details-back').addEventListener('click', backToCalendar);

const ERRORS = {
  taken: (d) => `Someone just booked ${longDate(d)}. Please pick another date.`,
  month_full: (d) => `${MONTHS[parse(d).m]} just filled up. Please pick a date in another month.`,
  invalid_date: () => 'That date is no longer open. Please pick another one.',
  already_booked: () => 'This email already has an upcoming session. One session per person at a time.',
  invalid_email: () => 'That email address doesn\'t look right. Check it and try again.',
  invalid_name: () => 'Please enter your name.',
};

$('step-details').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name').value.trim();
  const email = $('email').value.trim();
  const err = $('details-error');

  $('name').setAttribute('aria-invalid', String(!name));
  $('email').setAttribute('aria-invalid', String(!$('email').checkValidity() || !email));
  if (!name) { err.textContent = ERRORS.invalid_name(); $('name').focus(); return; }
  if (!email || !$('email').checkValidity()) { err.textContent = ERRORS.invalid_email(); $('email').focus(); return; }

  const btn = $('book-btn');
  btn.disabled = true;
  btn.textContent = 'Booking…';
  err.textContent = '';

  try {
    const res = await book({ date: state.selected, name, email, website: $('website').value });
    if (res.ok) {
      applyRules(res);
      $('done-date').textContent = longDate(state.selected);
      $('done-email').textContent = email;
      show('step-done');
      return;
    }
    const msg = (ERRORS[res.error] || (() => 'Something went wrong. Please try again.'))(state.selected);
    if (['taken', 'month_full', 'invalid_date'].includes(res.error)) {
      if (res.booked) applyRules(res);
      backToCalendar();
      setStatus(msg, true);
    } else {
      err.textContent = msg;
    }
  } catch {
    err.textContent = 'Couldn\'t reach the booking sheet. Check your internet connection and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Book my seat';
  }
});

// ---------- start ----------
(async function start() {
  $('demo-strip').hidden = !DEMO;
  try {
    applyRules(await fetchRules());
    state.view = firstOpenMonth();
    renderCalendar();
  } catch {
    $('seats-text').textContent = 'Couldn\'t load free dates';
    setStatus('Check your internet connection and reload the page.', true);
  }
})();
