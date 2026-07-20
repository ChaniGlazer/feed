import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionToken } from "@/lib/session";

export async function POST(request) {
  const { email, password } = await request.json();
  const cleanEmail = (email || "").trim().toLowerCase();

  const user = findUserByEmail(cleanEmail);
  if (!user || !user.password_hash || !verifyPassword(password || "", user.password_hash)) {
    return NextResponse.json({ error: "מייל או סיסמה שגויים" }, { status: 401 });
  }
  if (!user.email_verified) {
    return NextResponse.json(
      { error: "צריך לאמת את המייל לפני ההתחברות - בדקי את תיבת הדואר" },
      { status: 403 }
    );
  }

  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
