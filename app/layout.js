import "./globals.css";

export const metadata = {
  title: "מרחב הרעיונות",
  description: "מרחב פרטי לשיתוף רעיונות סטארטאפ בין יזמות",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
