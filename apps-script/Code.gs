/**
 * Free AI Sessions: booking backend.
 *
 * Paste this whole file into a Google Apps Script project attached to a
 * Google Sheet (Extensions > Apps Script), then deploy it as a web app.
 * Setup steps are in ../README.md.
 *
 * The sheet "Bookings" is the record: one row per booking.
 * To cancel a booking, change its Status cell from "booked" to "cancelled";
 * the date becomes free again on the site.
 */

const CONFIG = {
  SHEET_NAME: 'Bookings',
  PER_MONTH: 2,                    // seats per calendar month
  MONTHS_AHEAD: 3,                 // this month + the next 2
  WEEKDAYS: [0, 1, 2, 3, 4, 5, 6], // bookable days, 0 = Sunday ... 6 = Saturday
  HOST_NAME: 'Mudaseer',
  SESSION_TIME: '7:00 PM IST',
  SESSION_LENGTH: '60 minutes',
  SESSION_PLACE: 'Online on Google Meet. You will get the meeting link the day before.',
  FORM_URL: 'https://forms.gle/REPLACE_WITH_YOUR_FORM',
  NOTIFY_OWNER: true,              // email you each time someone books
};

function doGet() {
  return json_(Object.assign({ ok: true }, publicState_()));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }

  // Honeypot field: real people never fill it in.
  if (body.website) return json_({ ok: false, error: 'bad_request' });

  const date = String(body.date || '');
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);

  if (!isBookable_(date)) return json_({ ok: false, error: 'invalid_date' });
  if (!name) return json_({ ok: false, error: 'invalid_name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'invalid_email' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = activeRows_();
    const today = today_();
    if (rows.some(r => r.date === date)) return json_(Object.assign({ ok: false, error: 'taken' }, publicState_()));
    if (rows.filter(r => r.date.slice(0, 7) === date.slice(0, 7)).length >= CONFIG.PER_MONTH) {
      return json_(Object.assign({ ok: false, error: 'month_full' }, publicState_()));
    }
    if (rows.some(r => r.email === email && r.date > today)) return json_({ ok: false, error: 'already_booked' });

    sheet_().appendRow([new Date(), date, name, email, 'booked']);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // A mail failure should not undo a booking that is already saved.
  try { sendEmails_(date, name, email); } catch (err) { console.error(err); }

  return json_(Object.assign({ ok: true, date: date }, publicState_()));
}

/** Only dates go out to the page, never names or emails. */
function publicState_() {
  return {
    today: today_(),
    perMonth: CONFIG.PER_MONTH,
    monthsAhead: CONFIG.MONTHS_AHEAD,
    weekdays: CONFIG.WEEKDAYS,
    booked: activeRows_().map(r => r.date).filter(d => d.slice(0, 7) >= today_().slice(0, 7)),
  };
}

function isBookable_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  if (CONFIG.WEEKDAYS.indexOf(dt.getDay()) === -1) return false;

  const today = today_();
  const [ty, tm] = today.split('-').map(Number);
  const last = new Date(ty, tm - 1 + CONFIG.MONTHS_AHEAD, 0); // last day of the final open month
  const lastIso = Utilities.formatDate(last, tz_(), 'yyyy-MM-dd');
  return date > today && date <= lastIso;
}

function activeRows_() {
  const sheet = sheet_();
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, 5).getValues()
    .filter(r => String(r[4]).trim().toLowerCase() === 'booked')
    .map(r => ({ date: toIso_(r[1]), name: String(r[2]), email: String(r[3]).trim().toLowerCase() }))
    .filter(r => r.date);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['Booked at', 'Session date', 'Name', 'Email', 'Status']);
    sheet.setFrozenRows(1);
    sheet.getRange('B:B').setNumberFormat('@'); // keep dates as plain yyyy-MM-dd text
  }
  return sheet;
}

function sendEmails_(date, name, email) {
  const nice = longDate_(date);
  MailApp.sendEmail({
    to: email,
    subject: 'Your free AI session is booked for ' + nice,
    body: [
      'Hi ' + name + ',',
      '',
      'Your free 1-to-1 AI session is booked.',
      '',
      'Date: ' + nice,
      'Time: ' + CONFIG.SESSION_TIME,
      'Length: ' + CONFIG.SESSION_LENGTH,
      'Where: ' + CONFIG.SESSION_PLACE,
      '',
      'Before the session, please fill in this short form so I can plan around what you want to learn:',
      CONFIG.FORM_URL,
      '',
      'If you can no longer make it, reply to this email so someone else can take the seat.',
      '',
      CONFIG.HOST_NAME,
    ].join('\n'),
  });

  if (CONFIG.NOTIFY_OWNER) {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'New AI session booking: ' + nice,
      body: name + ' <' + email + '> booked ' + nice + '.\n\nSheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    });
  }
}

function toIso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function longDate_(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Utilities.formatDate(new Date(y, m - 1, d), tz_(), 'EEEE, d MMMM yyyy');
}

function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function tz_() { return Session.getScriptTimeZone(); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to create the sheet and approve Gmail + Sheets access. */
function setup() {
  sheet_();
  console.log('Ready. Bookings sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}
