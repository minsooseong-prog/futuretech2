import Link from "next/link";
import { Search, Bell, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { userTheme, getProfile } from "@/lib/queries";
import { Navigation } from "@/components/navigation";
import { Avatar } from "@/components/ui";
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [theme, profile] = await Promise.all([
    userTheme(user.id),
    getProfile(user.id),
  ]);
  return (
    <div className={`site ${theme}`}>
      <a href="#main" className="skip-link">
        본문으로 이동
      </a>
      <header className="topbar">
        <Link href="/home" className="wordmark">
          future tech<span>✳</span>
        </Link>
        <form action="/search" className="global-search">
          <Search size={17} />
          <input
            name="q"
            aria-label="전체 검색"
            placeholder="이야기, 공지, 친구 검색"
            maxLength={100}
          />
          <kbd>검색</kbd>
        </form>
        <Link
          className="icon-button mobile-search"
          href="/search"
          aria-label="전체 검색"
        >
          <Search size={19} />
        </Link>
        <div className="topbar-right">
          <Link href="/notices" className="icon-button" aria-label="공지사항">
            <Bell size={20} />
          </Link>
          <span className="topbar-divider" />
          <Link href={`/profile/${user.id}`} className="user-chip">
            <Avatar id={profile?.avatarId} name={user.name} />
            <span>{user.name}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <Navigation userId={user.id} />
      <main id="main" className="main-content">
        {user.mustChangePassword && (
          <p className="info-banner">
            초기 관리자 비밀번호를 변경해 주세요.{" "}
            <Link href="/settings">설정으로 이동 →</Link>
          </p>
        )}
        {children}
        <footer className="content-footer">
          <span>Future Tech</span>
          <span>함께 기록하는 우리의 다음.</span>
        </footer>
      </main>
    </div>
  );
}
