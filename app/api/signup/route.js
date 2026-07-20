import { NextResponse } from "next/server";
import { createUser, findUserByEmail, createVerificationToken } from "@/lib/db";
import { hashPassword, checkInviteCode, randomToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request) {
  const { name, email, password, inviteCode } = await request.json();

  const cleanName = (name || "").trim().slice(0, 60);
  const cleanEmail = (email || "").trim().toLowerCase().slice(0, 200);

  if (!cleanName || !cleanEmail || !password) {
    return NextResponse.json({ error: "צריך שם, מייל וסיסמה" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים" }, { status: 400 });
  }
  if (!checkInviteCode(inviteCode)) {
    return NextResponse.json({ error: "קוד הזמנה שגוי" }, { status: 403 });
  }
  if (findUserByEmail(cleanEmail)) {
    return NextResponse.json({ error: "כבר קיים חשבון עם המייל הזה" }, { status: 409 });
  }

  const user = createUser({
    email: cleanEmail,
    name: cleanName,
    passwordHash: hashPassword(password),
  });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  createVerificationToken(user.id, token, expiresAt);

  const verifyUrl = `${new URL(request.url).origin}/api/verify-email?token=${token}`;

  try {
    await sendVerificationEmail({ to: cleanEmail, name: cleanName, verifyUrl });
  } catch (err) {
    console.error("שליחת מייל אימות נכשלה:", err);
    return NextResponse.json(
      { error: "נרשמת, אבל שליחת מייל האימות נכשלה. נסי שוב מאוחר יותר" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
