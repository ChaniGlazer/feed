import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "התחברות עם Google לא מוגדרת" }, { status: 500 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const inviteCode = (url.searchParams.get("inviteCode") || "").slice(0, 200);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 דקות - מספיק לזרימת ה-OAuth
  };
  res.cookies.set("google_oauth_state", state, cookieOpts);
  res.cookies.set("google_oauth_invite", inviteCode, cookieOpts);
  return res;
}
