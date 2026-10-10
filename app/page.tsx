import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
export default async function Page() {
  redirect((await currentUser()) ? "/home" : "/login");
}
