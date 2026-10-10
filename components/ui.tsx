import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { date, entryUrl } from "@/lib/format";
import type { listEntries } from "@/lib/queries";
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Empty({
  title = "아직 게시글이 없습니다.",
  description = "첫 번째 이야기를 시작해보세요.",
  href,
  label = "작성하기",
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <MessageSquare size={25} />
      </span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {href && (
        <Link className="button" href={href}>
          {label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Avatar({
  id,
  name,
  size = "",
}: {
  id?: string | null;
  name: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`}>
      {id ? (
        <img
          src={`/api/media/${id}`}
          alt={`${name}의 프로필 사진`}
          loading="lazy"
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
export function PostList({
  rows,
  compact = false,
}: {
  rows: Awaited<ReturnType<typeof listEntries>>;
  compact?: boolean;
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className={`post-list ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="post-table-head">
          <span>말머리</span>
          <span>제목</span>
          <span>작성자</span>
          <span>날짜</span>
          <span>조회</span>
        </div>
      )}
      {rows.map(({ entry: e, author: a }) => (
        <Link href={entryUrl(e)} className="post-row" key={e.id}>
          <span className={`tag ${e.pinned ? "accent" : ""}`}>
            {e.pinned ? "중요" : e.kind === "notice" ? "공지" : e.category}
          </span>
          <strong>
            {e.title}
            <ArrowUpRight size={14} />
          </strong>
          <span className="muted post-author">{a.name}</span>
          <time className="muted">{date(e.createdAt)}</time>
          {!compact && <span className="muted views">{e.views}</span>}
        </Link>
      ))}
    </div>
  );
}
export function Pager({
  page,
  more,
  base,
  query = "",
}: {
  page: number;
  more: boolean;
  base: string;
  query?: string;
}) {
  return (
    <nav className="pager" aria-label="페이지 이동">
      {page > 1 && (
        <Link className="button" href={`${base}?${query}&page=${page - 1}`}>
          이전
        </Link>
      )}
      <span>{page} 페이지</span>
      {more && (
        <Link className="button" href={`${base}?${query}&page=${page + 1}`}>
          다음
        </Link>
      )}
    </nav>
  );
}
export function AlbumCard({
  row,
  imageId,
  count = 0,
}: {
  row: Awaited<ReturnType<typeof listEntries>>[number];
  imageId?: string;
  count?: number;
}) {
  return (
    <Link href={entryUrl(row.entry)} className="album-card">
      <div className="album-cover">
        {imageId ? (
          <img
            src={`/api/media/${imageId}`}
            alt={row.entry.title}
            loading="lazy"
          />
        ) : (
          <ImageIcon size={32} />
        )}
        <span className="photo-count">
          <ImageIcon size={13} />
          {count}
        </span>
      </div>
      <div className="album-copy">
        <h3>{row.entry.title}</h3>
        <p>
          {row.author.name}
          <span>·</span>
          {date(row.entry.createdAt)}
        </p>
      </div>
    </Link>
  );
}
