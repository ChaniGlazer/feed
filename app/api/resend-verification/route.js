import { NextResponse } from "next/server";
import {
  findUserByEmail,
  createVerificationToken,
  deleteVerificationTokensForUser,
} from "@/lib/db";
import { randomToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request) {
  const { email } = await request.json();
  const cleanEmail = (email || "").trim().toLowerCase();

  const user = findUserByEmail(cleanEmail);
  // תשובה זהה גם אם המשתמשת לא קיימת/כבר מאומתת, כדי לא לחשוף אילו כתובות רשומות
  if (!user || user.email_verified) {
    return NextResponse.json({ ok: true });
  }

  deleteVerificationTokensForUser(user.id);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  createVerificationToken(user.id, token, expiresAt);

  const verifyUrl = `${new URL(request.url).origin}/api/verify-email?token=${token}`;

  try {
    await sendVerificationEmail({ to: cleanEmail, name: user.name, verifyUrl });
  } catch (err) {
    console.error("שליחת מייל אימות חוזר נכשלה:", err);
    return NextResponse.json(
      { error: "שליחת המייל נכשלה, נסי שוב מאוחר יותר" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
