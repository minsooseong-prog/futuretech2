import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthScreen } from "@/components/auth-screen";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (await currentUser()) redirect("/home");
  const q = await searchParams;
  return (
    <AuthScreen
      notice={
        q.graduated
          ? "졸업 처리가 완료되었습니다. 함께한 시간을 기억할게요."
          : q.changed
            ? "비밀번호가 변경되었습니다. 다시 로그인해 주세요."
            : ""
      }
    />
  );
}
