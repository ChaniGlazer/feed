"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const COMPLEXITY_LABELS = { 1: "קל", 2: "בינוני", 3: "מורכב", 4: "מורכב מאוד" };

export default function FeedClient({ userName }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});

  async function loadIdeas() {
    setLoading(true);
    const res = await fetch("/api/ideas");
    if (res.status === 401) {
      router.push("/");
      return;
    }
    const data = await res.json();
    const list = data.ideas || [];
    setIdeas(list);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const idea of list) {
        if (!next[idea.id]) {
          next[idea.id] = {
            score: idea.my_score || 5,
            complexity: idea.my_complexity || 2,
          };
        }
      }
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    loadIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!content.trim()) {
      setError("צריך לכתוב את הרעיון");
      return;
    }

    setPosting(true);
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      setContent("");
      await loadIdeas();
    } else {
      setError("לא הצלחנו לשמור את הרעיון, נסי שוב");
    }
    setPosting(false);
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  async function handleVote(ideaId) {
    const res = await fetch(`/api/ideas/${ideaId}/vote`, { method: "POST" });
    if (!res.ok) return;
    const { voted, count } = await res.json();
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId
          ? { ...idea, voted_by_me: voted, vote_count: count }
          : idea
      )
    );
  }

  function setDraftField(ideaId, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [ideaId]: { ...prev[ideaId], [field]: value },
    }));
  }

  async function handleRate(ideaId) {
    const draft = drafts[ideaId];
    if (!draft) return;

    const res = await fetch(`/api/ideas/${ideaId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: draft.score, complexity: draft.complexity }),
    });
    if (!res.ok) return;
    const summary = await res.json();
    setIdeas((prev) =>
      prev.map((idea) => (idea.id === ideaId ? { ...idea, ...summary } : idea))
    );
  }

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>מרחב הרעיונות</h1>
          <p style={styles.subtitle}>
            שלום {userName} - כל רעיון כאן נושא חותמת זמן, הוכחת בעלות
          </p>
        </div>
        <button onClick={handleLogout} style={styles.logout}>
          יציאה
        </button>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          placeholder="ספרי לנו על הרעיון שלך..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={styles.textarea}
          rows={4}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={posting} style={styles.button}>
          {posting ? "משתפת..." : "לשתף רעיון"}
        </button>
      </form>

      <div style={styles.list}>
        {loading && <p style={styles.muted}>טוענת רעיונות...</p>}
        {!loading && ideas.length === 0 && (
          <p style={styles.muted}>עדיין אין רעיונות - את יכולה להיות הראשונה</p>
        )}
        {ideas.map((idea) => (
          <article key={idea.id} style={styles.card}>
            <div style={styles.cardTop}>
              <span style={styles.author}>{idea.author}</span>
              <span style={styles.timestamp}>
                {formatDate(idea.created_at)}
              </span>
            </div>
            <div className="seal-rule" />
            <p style={styles.content}>{idea.content}</p>
            <div style={styles.cardFooter}>
              <button
                onClick={() => handleVote(idea.id)}
                style={idea.voted_by_me ? styles.voteActive : styles.vote}
              >
                ▲ {idea.vote_count}
              </button>
            </div>

            <div style={styles.ratingPanel}>
              <p style={styles.ratingSummary}>
                {idea.rating_count > 0 ? (
                  <>
                    ציון ממוצע: {idea.avg_score.toFixed(1)}/10 · מורכבות
                    משוערת: {COMPLEXITY_LABELS[Math.round(idea.avg_complexity)]}{" "}
                    ({idea.rating_count} דירוגים)
                  </>
                ) : (
                  "עדיין אין דירוגים - היי הראשונה לדרג"
                )}
              </p>

              <div style={styles.ratingForm}>
                <label style={styles.ratingLabel}>
                  הציון שלך
                  <select
                    value={drafts[idea.id]?.score ?? 5}
                    onChange={(e) =>
                      setDraftField(idea.id, "score", Number(e.target.value))
                    }
                    style={styles.scoreSelect}
                  >
                    {SCORE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={styles.complexityRow}>
                  {Object.entries(COMPLEXITY_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDraftField(idea.id, "complexity", Number(value))
                      }
                      style={
                        drafts[idea.id]?.complexity === Number(value)
                          ? styles.complexityBtnActive
                          : styles.complexityBtn
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleRate(idea.id)}
                  style={styles.saveRatingBtn}
                >
                  {idea.my_score ? "עדכון דירוג" : "שמירת דירוג"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function formatDate(isoLike) {
  // node:sqlite datetime('now') מחזיר UTC כמחרוזת "YYYY-MM-DD HH:MM:SS"
  const iso = isoLike.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const styles = {
  main: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "32px 20px 80px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  title: { fontSize: 26, color: "#f6f2e9" },
  subtitle: { marginTop: 6, color: "#a9b4c4", fontSize: 13 },
  logout: {
    background: "transparent",
    border: "1px solid rgba(184,146,63,0.4)",
    color: "#dcc98a",
    padding: "8px 14px",
    borderRadius: 3,
    fontSize: 13,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "rgba(246, 242, 233, 0.04)",
    border: "1px solid rgba(184, 146, 63, 0.3)",
    borderRadius: 4,
    padding: 20,
    marginBottom: 36,
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 3,
    border: "1px solid rgba(184,146,63,0.35)",
    background: "rgba(246,242,233,0.06)",
    color: "#f6f2e9",
    fontSize: 14,
    resize: "vertical",
    fontFamily: "inherit",
  },
  error: { color: "#e08a76", fontSize: 13, margin: 0 },
  button: {
    alignSelf: "flex-start",
    padding: "10px 18px",
    borderRadius: 3,
    border: "none",
    background: "#b8923f",
    color: "#12233b",
    fontWeight: 600,
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: {
    background: "rgba(246, 242, 233, 0.03)",
    border: "1px solid rgba(184, 146, 63, 0.2)",
    borderRight: "3px solid #b8923f",
    borderRadius: 3,
    padding: "16px 18px",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
    fontSize: 13,
  },
  author: { color: "#dcc98a", fontWeight: 600 },
  timestamp: { color: "#8b96a8" },
  content: {
    marginTop: 10,
    color: "#e7e2d5",
    fontSize: 15,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
  muted: { color: "#8b96a8", fontSize: 14 },
  cardFooter: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-start",
  },
  vote: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 12,
    border: "1px solid rgba(184, 146, 63, 0.35)",
    background: "transparent",
    color: "#c7cfdb",
    fontSize: 13,
  },
  voteActive: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 12,
    border: "1px solid #b8923f",
    background: "rgba(184, 146, 63, 0.2)",
    color: "#dcc98a",
    fontWeight: 600,
    fontSize: 13,
  },
  ratingPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(184, 146, 63, 0.2)",
  },
  ratingSummary: {
    margin: "0 0 10px",
    color: "#a9b4c4",
    fontSize: 12,
  },
  ratingForm: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  ratingLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#c7cfdb",
  },
  scoreSelect: {
    padding: "4px 8px",
    borderRadius: 3,
    border: "1px solid rgba(184,146,63,0.35)",
    background: "rgba(246,242,233,0.06)",
    color: "#f6f2e9",
    fontSize: 13,
  },
  complexityRow: {
    display: "flex",
    gap: 6,
  },
  complexityBtn: {
    padding: "4px 10px",
    borderRadius: 12,
    border: "1px solid rgba(184, 146, 63, 0.35)",
    background: "transparent",
    color: "#c7cfdb",
    fontSize: 12,
  },
  complexityBtnActive: {
    padding: "4px 10px",
    borderRadius: 12,
    border: "1px solid #b8923f",
    background: "rgba(184, 146, 63, 0.2)",
    color: "#dcc98a",
    fontWeight: 600,
    fontSize: 12,
  },
  saveRatingBtn: {
    padding: "5px 14px",
    borderRadius: 3,
    border: "none",
    background: "#3f6e63",
    color: "#f6f2e9",
    fontSize: 12,
    fontWeight: 600,
  },
};
