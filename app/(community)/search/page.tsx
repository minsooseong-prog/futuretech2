import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { listEntries, directory } from "@/lib/queries";
import { PageHeader, PostList, Avatar } from "@/components/ui";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const q = ((await searchParams).q || "").slice(0, 100);
  const [board, notices, members] = q
    ? await Promise.all([
        listEntries("board", { q, limit: 20 }),
        listEntries("notice", { q, limit: 20 }),
        directory(q),
      ])
    : [[], [], []];
  return (
    <>
      <PageHeader
        eyebrow="SEARCH"
        title={q ? `“${q}” 검색 결과` : "어떤 이야기를 찾고 있나요?"}
        description="이야기, 공지사항, 구성원 이름을 검색해 보세요."
      />
      <form action="/search" className="search-page-form">
        <input
          name="q"
          aria-label="검색어"
          defaultValue={q}
          required
          maxLength={100}
        />
        <button className="button primary">검색</button>
      </form>
      {q && (
        <>
          <section className="panel">
            <h2>이야기</h2>
            <PostList rows={board} compact />
            <Link
              className="text-link"
              href={`/board?q=${encodeURIComponent(q)}`}
            >
              게시판에서 더 보기 →
            </Link>
          </section>
          <section className="panel">
            <h2>공지사항</h2>
            <PostList rows={notices} compact />
            <Link
              className="text-link"
              href={`/notices?q=${encodeURIComponent(q)}`}
            >
              공지사항에서 더 보기 →
            </Link>
          </section>
          <section className="panel">
            <h2>사람들</h2>
            <div className="member-grid">
              {members.map((m) => (
                <Link
                  className="member-card"
                  key={m.user.id}
                  href={`/profile/${m.user.id}`}
                >
                  <Avatar id={m.avatarId} name={m.user.name} />
                  {m.user.name}
                </Link>
              ))}
            </div>
            {!members.length && <p className="muted">검색 결과가 없습니다.</p>}
          </section>
        </>
      )}
    </>
  );
}
