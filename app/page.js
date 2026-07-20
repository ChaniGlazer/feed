import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginSignupForm from "./LoginSignupForm";

export default async function HomePage({ searchParams }) {
  const user = await getCurrentUser();
  if (user) redirect("/feed");

  const params = await searchParams;
  return (
    <LoginSignupForm
      justVerified={params?.verified === "1"}
      verifyError={params?.verifyError === "1"}
      authError={params?.authError}
    />
  );
}
