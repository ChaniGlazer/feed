import { NextResponse } from "next/server";
import { upsertRating } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MIN_SCORE = 1;
const MAX_SCORE = 10;
const MIN_COMPLEXITY = 1;
const MAX_COMPLEXITY = 4;

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

  const { score, complexity } = await request.json();
  const cleanScore = Number(score);
  const cleanComplexity = Number(complexity);

  if (!Number.isInteger(cleanScore) || cleanScore < MIN_SCORE || cleanScore > MAX_SCORE) {
    return NextResponse.json({ error: "ציון לא תקין" }, { status: 400 });
  }
  if (
    !Number.isInteger(cleanComplexity) ||
    cleanComplexity < MIN_COMPLEXITY ||
    cleanComplexity > MAX_COMPLEXITY
  ) {
    return NextResponse.json({ error: "רמת מורכבות לא תקינה" }, { status: 400 });
  }

  const summary = upsertRating(ideaId, user.id, cleanScore, cleanComplexity);
  return NextResponse.json(summary);
}
