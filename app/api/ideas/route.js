import { NextResponse } from "next/server";
import { listIdeas, addIdea } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const ideas = listIdeas(user.id);
  return NextResponse.json({ ideas });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const { content } = await request.json();
  const cleanContent = (content || "").trim().slice(0, 4000);

  if (!cleanContent) {
    return NextResponse.json({ error: "צריך תוכן לרעיון" }, { status: 400 });
  }

  addIdea(user.id, user.name, cleanContent);
  return NextResponse.json({ ok: true });
}
