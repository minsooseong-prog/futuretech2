import Link from "next/link";
import { ArrowUpRight, Plus, CalendarDays, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listEntries, entryMedia, upcoming } from "@/lib/queries";
import { date, studentLabel } from "@/lib/format";
import { PageHeader, PostList, AlbumCard, Empty } from "@/components/ui";
export default async function Home() {
  const user = await requireUser();
  const [notices, board, album, events] = await Promise.all([
    listEntries("notice", { limit: 3 }),
    listEntries("board", { limit: 4 }),
    listEntries("album", { limit: 3 }),
    upcoming(),
  ]);
  const photos = await entryMedia(album.map((r) => r.entry.id));
  return (
    <>
      <PageHeader
        eyebrow="OUR CLASS, OUR NEXT"
        title={`안녕하세요, ${user.name}님.`}
        description={`${studentLabel(user)} · 오늘은 어떤 가능성을 발견할까요?`}
      >
        <span className="today">{date(new Date())}</span>
      </PageHeader>
      <section className="welcome-banner">
        <div>
          <span className="tag outline">FUTURE ENGINEERING</span>
          <h2>
            혼자 떠올린 생각이,
            <br />
            함께 만드는 미래로.
          </h2>
          <p>
            질문 하나, 새로운 발견, 오늘의 작은 기록.
            <br />
            우리의 다음은 여기에서 시작돼요.
          </p>
          <Link className="button primary" href="/board/new">
            이야기 남기기
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="orbit three" />
          <span className="orbit-star">✳</span>
          <span className="orbit-label">IDEAS IN ORBIT / 01</span>
        </div>
      </section>
      <div className="dashboard-columns">
        <div>
          <section className="panel">
            <div className="section-title">
              <h2>
                우리 반 소식<span>NOTICE</span>
              </h2>
              <Link href="/notices" aria-label="공지사항 더 보기">
                <ArrowUpRight size={19} />
              </Link>
            </div>
            <PostList rows={notices} compact />
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>
                지금, 우리 이야기<span>COMMUNITY</span>
              </h2>
              <Link href="/board" aria-label="게시판 더 보기">
                <ArrowUpRight size={19} />
              </Link>
            </div>
            <PostList rows={board} compact />
          </section>
        </div>
        <section className="panel schedule-panel">
          <div className="section-title">
            <h2>다가오는 일정</h2>
            <CalendarDays size={19} />
          </div>
          {events.length ? (
            events.slice(0, 4).map((e) => (
              <Link href="/calendar" key={e.id} className="event-preview">
                <div className="date-box">
                  <strong>
                    {new Intl.DateTimeFormat("ko-KR", {
                      timeZone: "Asia/Seoul",
                      day: "2-digit",
                    }).format(e.startDate)}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: "Asia/Seoul",
                      month: "short",
                    }).format(e.startDate)}
                  </span>
                </div>
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.allDay ? "종일" : date(e.startDate, true)}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted empty-small">
              예정된 일정이 없습니다.
              <br />
              새로운 계획을 기다리고 있어요.
            </p>
          )}
          <Link href="/calendar" className="text-link">
            캘린더 열기
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section>
        <div className="section-title">
          <h2>
            쌓여가는 순간들<span>OUR ALBUM</span>
          </h2>
          <Link href="/album" className="text-link">
            모두 보기
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {album.length ? (
          <div className="album-grid">
            {album.map((row) => (
              <AlbumCard
                key={row.entry.id}
                row={row}
                imageId={photos.find((p) => p.entryId === row.entry.id)?.id}
                count={photos.filter((p) => p.entryId === row.entry.id).length}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="아직 등록된 사진이 없습니다."
            description="우리 반의 첫 번째 추억을 남겨보세요."
            href="/album/new"
            label="사진 올리기"
          />
        )}
      </section>
    </>
  );
}
