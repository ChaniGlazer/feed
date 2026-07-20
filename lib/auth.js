// עזרי אימות שדורשים node:crypto - לכן נמצאים בקובץ נפרד מ-lib/session.js
// (שצריך להישאר תואם ל-Edge runtime של ה-middleware).

const crypto = require("crypto");
const { cookies } = require("next/headers");
const { SESSION_COOKIE, verifySessionToken } = require("./session");
const { findUserById } = require("./db");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;

  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = crypto.scryptSync(password, salt, 64);
  return (
    candidate.length === hashBuffer.length &&
    crypto.timingSafeEqual(candidate, hashBuffer)
  );
}

function checkInviteCode(code) {
  const expected = process.env.INVITE_CODE;
  if (!expected) return false;
  const a = Buffer.from(code || "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

// שימוש ב-Server Components / Route Handlers בלבד (לא ב-middleware)
async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  return findUserById(userId);
}

module.exports = {
  hashPassword,
  verifyPassword,
  checkInviteCode,
  randomToken,
  getCurrentUser,
};
