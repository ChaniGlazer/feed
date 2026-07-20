"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_ERROR_MESSAGES = {
  1: "ההתחברות עם Google נכשלה, נסי שוב",
  invite: "צריך קוד הזמנה תקין כדי ליצור חשבון חדש עם Google",
};

export default function LoginSignupForm({ justVerified, verifyError, authError }) {
  const router = useRouter();
  const [mode, setMode] = useState(authError === "invite" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(
    (authError && AUTH_ERROR_MESSAGES[authError]) ||
      (verifyError ? "קישור האימות שגוי או שפג תוקפו. נסי להירשם שוב" : "")
  );
  const [notice, setNotice] = useState(
    justVerified ? "המייל אומת בהצלחה - אפשר להתחבר." : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/feed");
      } else {
        setError(data.error || "התחברות נכשלה");
      }
    } catch {
      setError("משהו השתבש, נסי שוב");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!agreed) {
      setError("צריך לאשר את התנאים לפני ההרשמה");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice("נרשמת בהצלחה! שלחנו מייל אימות - לחצי על הקישור כדי להתחבר.");
        setMode("login");
        setPassword("");
      } else {
        setError(data.error || "ההרשמה נכשלה");
      }
    } catch {
      setError("משהו השתבש, נסי שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div className="seal-rule" style={{ margin: "0 auto 20px" }} />
        <h1 style={styles.title}>מרחב הרעיונות</h1>
        <p style={styles.subtitle}>
          כניסה למרחב בטוח לשיתוף רעיונות סטארטאפ בין יזמות
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            style={mode === "login" ? styles.tabActive : styles.tab}
          >
            התחברות
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            style={mode === "signup" ? styles.tabActive : styles.tab}
          >
            הרשמה
          </button>
        </div>

        <a
          href={
            mode === "signup"
              ? `/api/auth/google?inviteCode=${encodeURIComponent(inviteCode)}`
              : "/api/auth/google"
          }
          style={styles.googleButton}
        >
          המשיכי עם Google
        </a>
        {mode === "signup" && (
          <p style={styles.googleHint}>
            (לחשבון Google חדש צריך למלא קוד הזמנה למטה קודם)
          </p>
        )}

        <div style={styles.divider}>
          <span>או</span>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>
              מייל
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                autoFocus
                required
              />
            </label>
            <label style={styles.label}>
              סיסמה
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </label>

            {notice && <p style={styles.notice}>{notice}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "נכנסת..." : "כניסה למרחב"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={styles.form}>
            <label style={styles.label}>
              שם
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              מייל
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              סיסמה
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                minLength={8}
                required
              />
            </label>
            <label style={styles.label}>
              קוד הזמנה
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={styles.checkbox}
              />
              <span>
                אני מאשרת שלא אעתיק, אשתמש או אשתף רעיונות שקראתי כאן ללא רשות
                מפורשת מבעלת הרעיון
              </span>
            </label>

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "נרשמת..." : "הרשמה למרחב"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(246, 242, 233, 0.04)",
    border: "1px solid rgba(184, 146, 63, 0.35)",
    borderRadius: 4,
    padding: "40px 32px",
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    color: "#f6f2e9",
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 24,
    color: "#c7cfdb",
    fontSize: 15,
    lineHeight: 1.6,
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: 3,
    border: "1px solid rgba(184, 146, 63, 0.3)",
    background: "transparent",
    color: "#c7cfdb",
    fontSize: 14,
  },
  tabActive: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: 3,
    border: "1px solid #b8923f",
    background: "rgba(184, 146, 63, 0.15)",
    color: "#f6f2e9",
    fontWeight: 600,
    fontSize: 14,
  },
  googleButton: {
    display: "block",
    padding: "10px 12px",
    borderRadius: 3,
    border: "1px solid rgba(184, 146, 63, 0.4)",
    background: "rgba(246, 242, 233, 0.06)",
    color: "#f6f2e9",
    fontSize: 14,
    textDecoration: "none",
  },
  googleHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#8b96a8",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "18px 0",
    color: "#8b96a8",
    fontSize: 12,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    textAlign: "right",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    color: "#dfe4ec",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 3,
    border: "1px solid rgba(184, 146, 63, 0.4)",
    background: "rgba(246, 242, 233, 0.06)",
    color: "#f6f2e9",
    fontSize: 15,
    outline: "none",
  },
  checkboxRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: "#c7cfdb",
    lineHeight: 1.6,
    textAlign: "right",
  },
  checkbox: {
    marginTop: 3,
    accentColor: "#b8923f",
    width: 16,
    height: 16,
    flexShrink: 0,
  },
  notice: {
    color: "#8fbf9f",
    fontSize: 13,
    margin: 0,
  },
  error: {
    color: "#e08a76",
    fontSize: 13,
    margin: 0,
  },
  button: {
    marginTop: 8,
    padding: "12px 20px",
    borderRadius: 3,
    border: "none",
    background: "#b8923f",
    color: "#12233b",
    fontWeight: 600,
    fontSize: 15,
  },
};
