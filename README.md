# Free AI Sessions

A booking page for free 1-to-1 AI lessons. Visitors pick a free date on a calendar, confirm it,
then leave their name and email. Only 2 seats per month, first come first served.
Bookings go into a Google Sheet, and each person automatically gets an email with your Google Form
link and the session details.

```
ai-sessions/
  index.html          the page
  css/style.css
  js/app.js           calendar + booking logic (SCRIPT_URL goes here)
  apps-script/Code.gs the backend: paste into Google Apps Script
```

Until `SCRIPT_URL` is set, the page runs in **demo mode**: bookings are kept only in your own
browser and a yellow banner says so. Don't share the link while the banner is showing.

## One-time setup (about 5 minutes)

1. **Make the Google Form** people will fill in (what they want to learn, experience level, etc.)
   and copy its share link (`https://forms.gle/...`).
2. **Make a Google Sheet** (sheets.new). Name it e.g. "AI session bookings".
3. In the sheet: **Extensions > Apps Script**. Delete the sample code and paste all of
   `apps-script/Code.gs`.
4. Edit `CONFIG` at the top: put your form link in `FORM_URL`, and change the time, length,
   place or bookable weekdays if needed (e.g. `WEEKDAYS: [0, 6]` for weekends only).
5. Select the `setup` function in the toolbar and click **Run**. Approve the permissions
   (Google will warn the app is unverified: Advanced > Go to project). This creates the
   "Bookings" tab.
6. **Deploy > New deployment > type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click Deploy and copy the **Web app URL** (ends in `/exec`).
7. Paste that URL into `SCRIPT_URL` at the top of `js/app.js`.

If you edit `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** so the
same URL keeps working.

## Day to day

- Each booking is a row in the **Bookings** tab. You also get an email per booking.
- To cancel one, change its **Status** from `booked` to `cancelled`. The date opens up again.
- The page shows only which dates are taken; names and emails never leave the sheet.
- Gmail limits Apps Script to about 100 emails a day, far more than 2 a month needs.

## Changing the copy

Session time, length and topics are written in `index.html` (the facts row, the confirm step and
"What we'll cover"). Keep them in step with `CONFIG` in `Code.gs`, which is what the emails use.

## Publishing

Static files, no build step. Host on GitHub Pages from its own repo
(a `git subtree split` of this folder only).
