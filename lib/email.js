// שליחת מיילים דרך Resend - קריאת REST פשוטה, בלי SDK נוסף.

async function sendVerificationEmail({ to, name, verifyUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("חסר משתנה סביבה RESEND_API_KEY");
  }
  const from = process.env.RESEND_FROM_EMAIL || "מרחב הרעיונות <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "אימות כתובת מייל - מרחב הרעיונות",
      html: `
        <div dir="rtl" style="font-family: sans-serif; line-height: 1.6;">
          <h2>שלום ${escapeHtml(name)},</h2>
          <p>כדי לאמת את כתובת המייל שלך ולהיכנס למרחב הרעיונות, לחצי על הקישור:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>הקישור בתוקף ל-24 שעות.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`שליחת מייל אימות נכשלה (${res.status}): ${body}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { sendVerificationEmail };
