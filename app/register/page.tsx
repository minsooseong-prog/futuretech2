import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthScreen } from "@/components/auth-screen";
export default async function Register() {
  if (await currentUser()) redirect("/home");
  return <AuthScreen register />;
}
