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

  db.exec(`
    CREATE TABLE IF NOT EXISTS idea_votes (
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (idea_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS idea_ratings (
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      complexity INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (idea_id, user_id)
    )
  `);

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

function listIdeas(currentUserId) {
  // vc/rs מרכזות (pre-aggregate) לפני ההצטרפות ל-ideas, כדי למנוע הכפלת שורות
  // (fan-out) שהייתה קורית אילו הצטרפנו ישירות לשתי טבלאות one-to-many.
  const stmt = db.prepare(`
    SELECT
      i.id, i.author, i.content, i.created_at,
      COALESCE(vc.vote_count, 0) AS vote_count,
      COALESCE(vc.voted_by_me, 0) AS voted_by_me,
      COALESCE(rs.rating_count, 0) AS rating_count,
      rs.avg_score AS avg_score,
      rs.avg_complexity AS avg_complexity,
      mr.score AS my_score,
      mr.complexity AS my_complexity
    FROM ideas i
    LEFT JOIN (
      SELECT idea_id, COUNT(*) AS vote_count,
             MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS voted_by_me
      FROM idea_votes GROUP BY idea_id
    ) vc ON vc.idea_id = i.id
    LEFT JOIN (
      SELECT idea_id, COUNT(*) AS rating_count,
             AVG(score) AS avg_score, AVG(complexity) AS avg_complexity
      FROM idea_ratings GROUP BY idea_id
    ) rs ON rs.idea_id = i.id
    LEFT JOIN idea_ratings mr ON mr.idea_id = i.id AND mr.user_id = ?
    ORDER BY i.id DESC
  `);
  return stmt.all(currentUserId, currentUserId).map((row) => ({
    ...row,
    voted_by_me: Boolean(row.voted_by_me),
  }));
}

function addIdea(userId, author, content) {
  const stmt = db.prepare(
    "INSERT INTO ideas (author, content, user_id) VALUES (?, ?, ?)"
  );
  stmt.run(author, content, userId);
}

// --- הצבעות ---

function toggleVote(ideaId, userId) {
  const existing = db
    .prepare("SELECT 1 FROM idea_votes WHERE idea_id = ? AND user_id = ?")
    .get(ideaId, userId);

  if (existing) {
    db.prepare("DELETE FROM idea_votes WHERE idea_id = ? AND user_id = ?").run(
      ideaId,
      userId
    );
  } else {
    db.prepare(
      "INSERT INTO idea_votes (idea_id, user_id) VALUES (?, ?)"
    ).run(ideaId, userId);
  }

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM idea_votes WHERE idea_id = ?")
    .get(ideaId);

  return { voted: !existing, count };
}

// --- דירוגים (ציון + רמת מורכבות) ---

function upsertRating(ideaId, userId, score, complexity) {
  db.prepare(
    `INSERT INTO idea_ratings (idea_id, user_id, score, complexity)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(idea_id, user_id) DO UPDATE SET score = excluded.score, complexity = excluded.complexity`
  ).run(ideaId, userId, score, complexity);

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS rating_count, AVG(score) AS avg_score, AVG(complexity) AS avg_complexity
       FROM idea_ratings WHERE idea_id = ?`
    )
    .get(ideaId);

  return {
    rating_count: agg.rating_count,
    avg_score: agg.avg_score,
    avg_complexity: agg.avg_complexity,
    my_score: score,
    my_complexity: complexity,
  };
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

function deleteVerificationTokensForUser(userId) {
  db.prepare("DELETE FROM verification_tokens WHERE user_id = ?").run(userId);
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
  toggleVote,
  upsertRating,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  linkGoogleId,
  markEmailVerified,
  createVerificationToken,
  deleteVerificationTokensForUser,
  consumeVerificationToken,
};
