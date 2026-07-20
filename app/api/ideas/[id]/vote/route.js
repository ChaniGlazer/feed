import { NextResponse } from "next/server";
import { toggleVote } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const { id } = await params;
  const ideaId = Number(id);
  if (!Number.isInteger(ideaId)) {
    return NextResponse.json({ error: "מזהה רעיון לא תקין" }, { status: 400 });
  }

  const result = toggleVote(ideaId, user.id);
  return NextResponse.json(result);
}
