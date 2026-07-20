// טוקן session חתום (HMAC-SHA256) שנשמר בעוגייה.
// נבנה עם Web Crypto API (לא node:crypto) כדי לעבוד גם ב-Edge runtime של ה-middleware.

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 יום

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("חסר משתנה סביבה SESSION_SECRET");
  }
  return secret;
}

function bufToBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

async function getKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload) {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufToBase64Url(sig);
}

async function createSessionToken(userId) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = bufToBase64Url(encoder.encode(`${userId}.${expiresAt}`));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

async function verifySessionToken(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const key = await getKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBuf(signature),
    encoder.encode(payload)
  );
  if (!valid) return null;

  const decoded = new TextDecoder().decode(base64UrlToBuf(payload));
  const [userId, expiresAt] = decoded.split(".");
  if (!userId || !expiresAt || Date.now() > Number(expiresAt)) return null;

  return Number(userId);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
};
