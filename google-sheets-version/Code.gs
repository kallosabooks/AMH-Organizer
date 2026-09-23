/**
 * Client Onboarding Tracker — Google Sheets edition.
 *
 * The web app (Index.html) talks to these functions through google.script.run.
 * All data lives in three tabs of the spreadsheet this script is attached to:
 *   Clients, Notes, Stages
 * The tabs are rewritten after every change, so the spreadsheet is always a
 * readable, up-to-date copy of the board. setUp() also installs a nightly
 * backup that copies those tabs into a dated spreadsheet in Google Drive.
 */

var DEFAULT_STAGES = [
  'Initial Contact',
  'Consultation Scheduled',
  'Proposal Sent',
  'Contract Signed',
  'Documents Collected',
  'Account Setup',
  'Onboarding Complete'
];

var SHEETS = {
  stages: { name: 'Stages', headers: ['Order', 'Stage Name', 'Stage ID'] },
  clients: {
    name: 'Clients',
    headers: ['Business Name', 'Client Name', 'Stage', 'Date Entered Stage', 'Date Added',
              'Last Updated', 'Updated By', 'Client ID', 'Stage ID']
  },
  notes: {
    name: 'Notes',
    headers: ['Business Name', 'Date', 'Note', 'Type', 'Added By', 'Edited', 'Note ID', 'Client ID']
  }
};

var DATE_FORMAT = 'yyyy-mm-dd hh:mm';
var BACKUP_FOLDER_NAME = 'Client Tracker Backups';
var BACKUPS_TO_KEEP = 30;
var MAX_TEXT = 40000; // a Google Sheets cell holds at most 50,000 characters
var idsAssigned_ = false;

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Client Onboarding Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Functions called from the web page
// ---------------------------------------------------------------------------

/** Returns the whole board. */
function getData() {
  return withLock_(function () {
    idsAssigned_ = false;
    var data = readAll_();
    if (idsAssigned_) writeAll_(data); // rows typed into the sheet by hand get permanent IDs
    return payload_(data);
  });
}

/** Applies a batch of changes made in the web page, then returns the updated board. */
function applyOps(ops) {
  return withLock_(function () {
    var data = readAll_();
    var user = currentUser_();
    var now = new Date().toISOString();
    (ops || []).forEach(function (op) { applyOp_(data, op, user, now); });
    writeAll_(data);
    return payload_(data);
  });
}

/** Replaces everything with an imported backup (JSON or CSV already parsed by the page). */
function replaceAll(imported) {
  return withLock_(function () {
    var user = currentUser_();
    var data = normalize_(imported, user);
    if (!data.stages.length) throw new Error('The imported file has no stages.');
    try { backupNow(); } catch (e) { /* safety copy only — don't block the import */ }
    writeAll_(data);
    return payload_(data);
  });
}

// ---------------------------------------------------------------------------
// One-time setup and backups (run from the Apps Script editor)
// ---------------------------------------------------------------------------

/**
 * Run this once from the editor: creates the tabs, remembers which spreadsheet
 * to use, and schedules a nightly backup.
 */
function setUp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  withLock_(function () { writeAll_(readAll_()); });

  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'backupNow';
  });
  if (!exists) ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();

  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  Logger.log('Setup complete. Nightly backups go to the Drive folder "' + BACKUP_FOLDER_NAME + '".');
}

/** Copies the Clients, Notes and Stages tabs into a dated spreadsheet in the backup folder. */
function backupNow() {
  var ss = spreadsheet_();
  var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HHmm');
  var copy = SpreadsheetApp.create('Client Tracker Backup ' + stamp);
  [SHEETS.clients, SHEETS.notes, SHEETS.stages].forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (sheet) sheet.copyTo(copy).setName(def.name);
  });
  copy.getSheets().forEach(function (s) {
    if (s.getName() === 'Sheet1' && copy.getSheets().length > 1) copy.deleteSheet(s);
  });

  var folder = backupFolder_();
  var file = DriveApp.getFileById(copy.getId());
  file.moveTo(folder);

  // Keep only the most recent backups.
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUPS_TO_KEEP).forEach(function (f) { f.setTrashed(true); });
  return copy.getUrl();
}

function backupFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* deleted — make a new one */ }
  }
  var folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

// ---------------------------------------------------------------------------
// Applying changes
// ---------------------------------------------------------------------------

function applyOp_(data, op, user, now) {
  if (!op || !op.type) return;
  var client = op.clientId ? findById_(data.clients, op.clientId) : null;
  function touch(c) { c.updatedAt = now; c.updatedBy = user; }

  switch (op.type) {
    case 'addClient': {
      var c = op.client || {};
      var business = cleanText_(c.business), name = cleanText_(c.name);
      if (!business) throw new Error('Business name is required.');
      if (findById_(data.clients, c.id)) return; // already saved (retry)
      var stage = findById_(data.stages, c.stageId) || data.stages[0];
      var at = validDate_(c.createdAt) || now;
      data.clients.push({
        id: String(c.id || newId_()), business: business, name: name, stageId: stage.id,
        stageEnteredAt: at, createdAt: at, updatedAt: now, updatedBy: user,
        notes: (c.notes || []).map(function (n) { return makeNote_(n, user, at); }).filter(Boolean)
      });
      return;
    }
    case 'updateClient': {
      if (!client) return; // deleted by someone else
      if (op.business != null && cleanText_(op.business)) client.business = cleanText_(op.business);
      if (op.name != null) client.name = cleanText_(op.name);
      touch(client);
      return;
    }
    case 'moveClient': {
      var to = findById_(data.stages, op.stageId);
      if (!client || !to || client.stageId === to.id) return;
      moveClient_(data, client, to, validDate_(op.at) || now, user, op.noteId);
      touch(client);
      return;
    }
    case 'deleteClient': {
      data.clients = data.clients.filter(function (x) { return x.id !== op.clientId; });
      return;
    }
    case 'addNote': {
      if (!client || findById_(client.notes, op.note && op.note.id)) return;
      var note = makeNote_(op.note, user, now);
      if (note) { client.notes.push(note); touch(client); }
      return;
    }
    case 'editNote': {
      var n = client && findById_(client.notes, op.noteId);
      var text = cleanText_(op.text, true);
      if (!n || !text || n.system) return;
      n.text = text;
      n.editedAt = validDate_(op.editedAt) || now;
      touch(client);
      return;
    }
    case 'deleteNote': {
      if (!client) return;
      client.notes = client.notes.filter(function (x) { return x.id !== op.noteId; });
      touch(client);
      return;
    }
    case 'addStage': {
      var sname = cleanText_(op.stage && op.stage.name);
      if (!sname || findById_(data.stages, op.stage.id)) return;
      data.stages.push({ id: String(op.stage.id || newId_()), name: sname });
      return;
    }
    case 'renameStage': {
      var s = findById_(data.stages, op.stageId);
      var rn = cleanText_(op.name);
      if (s && rn) s.name = rn;
      return;
    }
    case 'reorderStages': {
      var order = op.ids || [];
      data.stages.sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
      });
      return;
    }
    case 'deleteStage': {
      var idx = indexById_(data.stages, op.stageId);
      if (idx === -1 || data.stages.length === 1) return;
      var gone = data.stages[idx];
      var target = findById_(data.stages, op.targetId);
      if (!target || target.id === gone.id) target = data.stages[idx === 0 ? 1 : idx - 1];
      var at2 = validDate_(op.at) || now;
      data.clients.forEach(function (c) {
        if (c.stageId === gone.id) { moveClient_(data, c, target, at2, user); touch(c); }
      });
      data.stages.splice(idx, 1);
      return;
    }
    default:
      throw new Error('Unknown change type: ' + op.type);
  }
}

function moveClient_(data, client, to, at, user, noteId) {
  var from = findById_(data.stages, client.stageId);
  client.stageId = to.id;
  client.stageEnteredAt = at;
  client.notes.push({
    id: String(noteId || newId_()),
    date: at,
    text: 'Moved ' + (from ? 'from “' + from.name + '” ' : '') + 'to “' + to.name + '”',
    system: true,
    author: user
  });
}

function makeNote_(n, user, fallbackDate) {
  var text = n && cleanText_(n.text, true);
  if (!text) return null;
  return {
    id: String(n.id || newId_()),
    date: validDate_(n.date) || fallbackDate,
    text: text,
    system: !!n.system,
    editedAt: validDate_(n.editedAt) || '',
    author: n.author ? String(n.author) : user
  };
}

function normalize_(s, user) {
  if (!s || !Array.isArray(s.stages) || !Array.isArray(s.clients)) {
    throw new Error('That file is not a valid tracker backup.');
  }
  var now = new Date().toISOString();
  var stages = [];
  s.stages.forEach(function (st) {
    var name = st && cleanText_(st.name);
    if (!name) return;
    var id = String(st.id || newId_());
    if (findById_(stages, id)) id = newId_();
    stages.push({ id: id, name: name });
  });
  var clients = [];
  s.clients.forEach(function (c) {
    if (!c) return;
    var business = cleanText_(c.business), name = cleanText_(c.name);
    if (!business && !name) return;
    var stage = findById_(stages, c.stageId) || stages[0];
    var created = validDate_(c.createdAt) || now;
    var id = String(c.id || newId_());
    if (findById_(clients, id)) id = newId_();
    clients.push({
      id: id, business: business || name, name: business ? name : '',
      stageId: stage ? stage.id : '', stageEnteredAt: validDate_(c.stageEnteredAt) || created,
      createdAt: created, updatedAt: now, updatedBy: user,
      notes: (Array.isArray(c.notes) ? c.notes : [])
        .map(function (n) { return makeNote_(n, n && n.author ? n.author : '', created); })
        .filter(Boolean)
    });
  });
  return { stages: stages, clients: clients };
}

// ---------------------------------------------------------------------------
// Reading and writing the spreadsheet
// ---------------------------------------------------------------------------

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(def) {
  var ss = spreadsheet_();
  var sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Reads a tab into objects keyed by header name, so columns can be moved around safely. */
function readRows_(def) {
  var sheet = sheet_(def);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var width = Math.max(sheet.getLastColumn(), def.headers.length);
  var values = sheet.getRange(1, 1, last, width).getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1).map(function (row) {
    var obj = {};
    def.headers.forEach(function (h) {
      var i = head.indexOf(h);
      obj[h] = i === -1 ? '' : row[i];
    });
    return obj;
  });
}

function readAll_() {
  var stages = readRows_(SHEETS.stages)
    .filter(function (r) { return str_(r['Stage Name']); })
    .sort(function (a, b) { return (Number(a.Order) || 0) - (Number(b.Order) || 0); })
    .map(function (r) { return { id: str_(r['Stage ID']) || assignId_(), name: str_(r['Stage Name']) }; });

  if (!stages.length) {
    stages = DEFAULT_STAGES.map(function (name) { return { id: assignId_(), name: name }; });
  }
  function stageFor(id, name) {
    return findById_(stages, id) ||
      stages.filter(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })[0] ||
      stages[0];
  }

  var clients = readRows_(SHEETS.clients)
    .filter(function (r) { return str_(r['Business Name']) || str_(r['Client Name']); })
    .map(function (r) {
      var created = dateIso_(r['Date Added']) || new Date().toISOString();
      return {
        id: str_(r['Client ID']) || assignId_(),
        business: str_(r['Business Name']) || str_(r['Client Name']),
        name: str_(r['Business Name']) ? str_(r['Client Name']) : '',
        stageId: stageFor(str_(r['Stage ID']), str_(r.Stage)).id,
        stageEnteredAt: dateIso_(r['Date Entered Stage']) || created,
        createdAt: created,
        updatedAt: dateIso_(r['Last Updated']),
        updatedBy: str_(r['Updated By']),
        notes: []
      };
    });

  var byId = {};
  clients.forEach(function (c) { byId[c.id] = c; });
  readRows_(SHEETS.notes).forEach(function (r) {
    var c = byId[str_(r['Client ID'])];
    var text = str_(r.Note);
    if (!c || !text) return;
    c.notes.push({
      id: str_(r['Note ID']) || assignId_(),
      date: dateIso_(r.Date) || c.createdAt,
      text: text,
      system: str_(r.Type).toLowerCase() === 'history',
      editedAt: dateIso_(r.Edited),
      author: str_(r['Added By'])
    });
  });
  return { stages: stages, clients: clients };
}

function writeAll_(data) {
  var stageName = {}, stageOrder = {};
  data.stages.forEach(function (s, i) { stageName[s.id] = s.name; stageOrder[s.id] = i; });

  var clients = data.clients.slice().sort(function (a, b) {
    return (stageOrder[a.stageId] - stageOrder[b.stageId]) ||
      a.business.toLowerCase().localeCompare(b.business.toLowerCase());
  });

  writeRows_(SHEETS.stages, data.stages.map(function (s, i) {
    return [i + 1, text_(s.name), text_(s.id)];
  }), []);

  writeRows_(SHEETS.clients, clients.map(function (c) {
    return [text_(c.business), text_(c.name), text_(stageName[c.stageId] || ''), date_(c.stageEnteredAt),
            date_(c.createdAt), date_(c.updatedAt), text_(c.updatedBy), text_(c.id), text_(c.stageId)];
  }), [4, 5, 6]);

  var notes = [];
  clients.forEach(function (c) {
    c.notes.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).forEach(function (n) {
      notes.push([text_(c.business), date_(n.date), text_(n.text), n.system ? 'History' : 'Note',
                  text_(n.author), date_(n.editedAt), text_(n.id), text_(c.id)]);
    });
  });
  writeRows_(SHEETS.notes, notes, [2, 6]);
}

/** Overwrites a tab's data rows (keeping the header row) and clears any leftover rows below. */
function writeRows_(def, rows, dateCols) {
  var sheet = sheet_(def);
  var cols = def.headers.length;
  sheet.getRange(1, 1, 1, cols).setValues([def.headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, cols).setValues(rows);
    dateCols.forEach(function (col) { sheet.getRange(2, col, rows.length, 1).setNumberFormat(DATE_FORMAT); });
  }
  var last = sheet.getLastRow();
  if (last > rows.length + 1) {
    sheet.getRange(rows.length + 2, 1, last - rows.length - 1, Math.max(cols, sheet.getLastColumn())).clearContent();
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function payload_(data) {
  var ss = spreadsheet_();
  return { stages: data.stages, clients: data.clients, user: currentUser_(), sheetUrl: ss.getUrl() };
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('The tracker is busy saving someone else\'s change. Please try again.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function currentUser_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function findById_(list, id) {
  if (id == null) return null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function indexById_(list, id) {
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
  return -1;
}

function assignId_() {
  idsAssigned_ = true;
  return newId_();
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function str_(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function cleanText_(v, multiline) {
  if (v == null) return '';
  var s = String(v).replace(/\r\n?/g, '\n').trim();
  if (!multiline) s = s.replace(/\s+/g, ' ');
  if (s.length > MAX_TEXT) throw new Error('That text is too long (limit ' + MAX_TEXT + ' characters).');
  return s;
}

function validDate_(v) {
  if (!v) return '';
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

function dateIso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  return validDate_(v);
}

/** A leading apostrophe makes Sheets store the value as plain text (no formulas, no number conversion). */
function text_(v) {
  v = v == null ? '' : String(v);
  return v ? "'" + v : '';
}

function date_(iso) {
  var d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d : '';
}
