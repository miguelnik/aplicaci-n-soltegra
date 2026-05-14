import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "admin" || profile.role === "superadmin") {
    redirect("/admin/dashboard");
  }

  redirect("/dashboard");
}
