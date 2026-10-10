"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Images,
  MessageSquare,
  Megaphone,
  Users,
  CalendarDays,
  UserRound,
  Settings,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
const links = [
  ["/home", "홈", Home],
  ["/album", "우리의 앨범", Images],
  ["/board", "이야기", MessageSquare],
  ["/notices", "공지사항", Megaphone],
  ["/members", "함께하는 사람들", Users],
  ["/calendar", "캘린더", CalendarDays],
] as const;
export function Navigation({ userId }: { userId: string }) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const items = [
    ...links,
    [`/profile/${userId}`, "내 프로필", UserRound],
    ["/settings", "설정", Settings],
  ] as const;
  return (
    <>
      <button
        className="icon-button mobile-menu"
        aria-label="메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <button
          className="nav-overlay"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-label">OUR CLASSROOM</div>
        <nav aria-label="주 메뉴">
          {items.map(([href, label, Icon]) => (
            <Link
              key={href}
              onClick={() => setOpen(false)}
              href={href}
              className={
                path === href || path.startsWith(href + "/") ? "active" : ""
              }
            >
              <Icon size={19} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-spark">✳</span>
          <p>
            함께 배우고,
            <br />
            다음의 가능성을 만들어요.
          </p>
          <span>
            FUTURE STARTS HERE <ArrowUpRight size={12} />
          </span>
        </div>
        <div className="sidebar-bottom">
          Future Tech Community
          <br />
          <span>작은 생각이 미래가 되는 곳.</span>
        </div>
      </aside>
    </>
  );
}
