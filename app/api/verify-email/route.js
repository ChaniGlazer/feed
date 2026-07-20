import { NextResponse } from "next/server";
import { consumeVerificationToken, markEmailVerified } from "@/lib/db";

export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "";

  const userId = consumeVerificationToken(token);
  if (!userId) {
    return NextResponse.redirect(`${origin}/?verifyError=1`);
  }

  markEmailVerified(userId);
  return NextResponse.redirect(`${origin}/?verified=1`);
}
