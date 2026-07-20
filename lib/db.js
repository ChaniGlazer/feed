// שכבת גישה למסד הנתונים
// משתמשים ב-node:sqlite המובנה (Node 22+), עם דפוס Lazy Proxy
// כדי להימנע מנעילת קובץ בזמן ה-build של Next.js

const path = require("path");

// בסביבת Render כדאי להצביע ל-Persistent Disk, למשל /data/ideas.db
// באופן מקומי - קובץ בתיקיית הפרויקט
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "ideas.db");

let _db = null;

function getDb() {
  if (_db) return _db;

  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER
    )
  `);

  // מיגרציה רכה - מסדי נתונים ישנים שנוצרו לפני הוספת user_id
  try {
    db.exec(`ALTER TABLE ideas ADD COLUMN user_id INTEGER`);
  } catch {
    // העמודה כבר קיימת
  }

  _db = db;
  return _db;
}

// Proxy עצלן - הקובץ/החיבור נפתח רק בשימוש הראשון בפועל,
// לא בזמן import, כדי לא לתקוע build-time
const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getDb();
      const value = real[prop];
      return typeof value === "function" ? value.bind(real) : value;
    },
  }
);

// --- רעיונות ---

function listIdeas() {
  const stmt = db.prepare(
    "SELECT id, author, content, created_at FROM ideas ORDER BY id DESC"
  );
  return stmt.all();
}

function addIdea(userId, author, content) {
  const stmt = db.prepare(
    "INSERT INTO ideas (author, content, user_id) VALUES (?, ?, ?)"
  );
  stmt.run(author, content, userId);
}

// --- משתמשות ---

function createUser({ email, name, passwordHash = null, googleId = null, emailVerified = false }) {
  const stmt = db.prepare(
    `INSERT INTO users (email, name, password_hash, google_id, email_verified)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = stmt.run(email, name, passwordHash, googleId, emailVerified ? 1 : 0);
  return findUserById(Number(result.lastInsertRowid));
}

function findUserByEmail(email) {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  return stmt.get(email) || null;
}

function findUserById(id) {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id) || null;
}

function findUserByGoogleId(googleId) {
  const stmt = db.prepare("SELECT * FROM users WHERE google_id = ?");
  return stmt.get(googleId) || null;
}

function linkGoogleId(userId, googleId) {
  const stmt = db.prepare("UPDATE users SET google_id = ? WHERE id = ?");
  stmt.run(googleId, userId);
}

function markEmailVerified(userId) {
  const stmt = db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?");
  stmt.run(userId);
}

// --- אימות מייל ---

function createVerificationToken(userId, token, expiresAtIso) {
  const stmt = db.prepare(
    "INSERT INTO verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)"
  );
  stmt.run(token, userId, expiresAtIso);
}

function consumeVerificationToken(token) {
  const stmt = db.prepare(
    "SELECT user_id, expires_at FROM verification_tokens WHERE token = ?"
  );
  const row = stmt.get(token);
  if (!row) return null;

  db.prepare("DELETE FROM verification_tokens WHERE token = ?").run(token);

  if (new Date(row.expires_at + "Z") < new Date()) return null;
  return row.user_id;
}

module.exports = {
  db,
  listIdeas,
  addIdea,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  linkGoogleId,
  markEmailVerified,
  createVerificationToken,
  consumeVerificationToken,
};
