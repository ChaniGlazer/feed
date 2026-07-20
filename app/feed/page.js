import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import FeedClient from "./FeedClient";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return <FeedClient userName={user.name} />;
}
