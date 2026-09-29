/**
 * OMKAR APP — form notifications (Seva / Contact)
 * ================================================
 *
 * What this does, every time someone submits a form on the website:
 *   1. Emails the admin  — "New <form> submission — <name>"
 *   2. Adds a row to a Google Sheet, so nothing is ever lost
 *   3. Auto-creates that Sheet + its headers the first time it runs
 *
 * The app already knows how to call this. You only need the URL it gives you
 * (step 6 below) pasted into config/.env.local as VITE_FORM_ENDPOINT.
 *
 * ── SETUP ────────────────────────────────────────────────────────────────
 *   1. script.google.com  →  New project
 *   2. Delete the sample code, paste this whole file
 *   3. Set ADMIN_EMAIL below to the Samithi's email address
 *   4. Deploy → New deployment → Web app
 *        Execute as:        Me
 *        Who has access:    Anyone
 *   5. Approve the permissions it asks for (it needs to send mail and
 *      create the Sheet — that is all it does)
 *   6. Copy the "Web app URL" it shows you
 *   7. Paste it into config/.env.local as VITE_FORM_ENDPOINT, restart the
 *      dev server, and submit a test form
 *
 * The first email contains a link to the auto-created Sheet. Bookmark it —
 * that Sheet is a second copy of every seva signup and message, alongside the
 * admin dashboard. (There is no donation form: the Samithi does not accept
 * donations.)
 */

// ⬇️ CHANGE THIS to the Samithi's email address
var ADMIN_EMAIL = 'REPLACE-WITH-ADMIN-EMAIL@gmail.com';

// The Sheet is created automatically on first use; leave this name alone or
// rename it to whatever you like.
var SHEET_NAME = 'Omkar App Submissions';

/** The website calls this with a POST. */
function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var form = data.form || 'Form';
    var label = { contact: 'Message', seva: 'Seva signup' }[form] ||
      form.charAt(0).toUpperCase() + form.slice(1);

    var lines = [];
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (key === 'form') continue;
      var value = data[key];
      if (value === null || value === undefined || value === '') continue;
      lines.push(pretty(key) + ': ' + value);
    }

    var name = data.name || data.fullName || data['Full Name'] || '';
    var subject = 'New ' + label + (name ? ' from ' + name : '') + ' — Omkar Samithi';
    var body = lines.join('\n') +
      '\n\n──\nReceived: ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Muscat' }) +
      ' (Muscat)\nSubmitted from: ' + (data.page || 'the website');

    MailApp.sendEmail(ADMIN_EMAIL, subject, body);
    logToSheet(data, lines);

    return json({ ok: true });
  } catch (err) {
    // Still tell the admin — a broken submission is worse than a noisy one.
    try {
      MailApp.sendEmail(ADMIN_EMAIL, 'Omkar App: a form submission failed to save',
        'Error: ' + err + '\n\nRaw data:\n' + ((e && e.postData && e.postData.contents) || ''));
    } catch (ignored) { /* nothing more we can do */ }
    return json({ ok: false, error: String(err) });
  }
}

/** Lets you check the URL in a browser — it should say "Omkar App form endpoint is live". */
function doGet() {
  return ContentService.createTextOutput('Omkar App form endpoint is live');
}

/** Append one row to the Sheet, creating the Sheet + headers if needed. */
function logToSheet(data, lines) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var file;

  if (id) {
    file = SpreadsheetApp.openById(id);
  } else {
    file = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('SHEET_ID', file.getId());
    MailApp.sendEmail(ADMIN_EMAIL, 'Omkar App: your submissions spreadsheet is ready',
      'Every form submission now lands here:\n\n' + file.getUrl());
  }

  var sheet = file.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Received (Muscat)', 'Form', 'Name', 'Contact', 'Summary', 'Details']);
    sheet.getRange('1:1').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var contact = data.email || data.phone || data['Email'] || data['Phone'] || '';
  sheet.appendRow([
    new Date(),
    data.form || '',
    data.name || data.fullName || '',
    contact,
    lines.slice(0, 3).join(' | '),
    lines.join('\n'),
  ]);
}

function pretty(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, function (c) { return c.toUpperCase(); });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
