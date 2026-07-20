import { NextResponse } from "next/server";
import {
  findUserByGoogleId,
  findUserByEmail,
  createUser,
  linkGoogleId,
} from "@/lib/db";
import { checkInviteCode } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/session";

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;
  const inviteCode = request.cookies.get("google_oauth_invite")?.value || "";

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${origin}/?authError=1`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/?authError=1`);
  }
  const tokenData = await tokenRes.json();

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileRes.ok) {
    return NextResponse.redirect(`${origin}/?authError=1`);
  }
  const profile = await profileRes.json();

  if (!profile.email || !profile.email_verified) {
    return NextResponse.redirect(`${origin}/?authError=1`);
  }
  const email = profile.email.toLowerCase();

  let user = findUserByGoogleId(profile.sub);

  if (!user) {
    user = findUserByEmail(email);
    if (user) {
      linkGoogleId(user.id, profile.sub);
    }
  }

  if (!user) {
    if (!checkInviteCode(inviteCode)) {
      return NextResponse.redirect(`${origin}/?authError=invite`);
    }
    user = createUser({
      email,
      name: (profile.name || email).slice(0, 60),
      googleId: profile.sub,
      emailVerified: true,
    });
  }

  const token = await createSessionToken(user.id);
  const res = NextResponse.redirect(`${origin}/feed`);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  res.cookies.delete("google_oauth_state");
  res.cookies.delete("google_oauth_invite");
  return res;
}
