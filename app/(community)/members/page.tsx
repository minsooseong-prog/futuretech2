import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { alumni } from "@/lib/db/schema";
import { directory } from "@/lib/queries";
import { studentLabel, date } from "@/lib/format";
import { PageHeader, Avatar, Empty } from "@/components/ui";
export default async function Members() {
  await requireUser();
  const [rows, graduates] = await Promise.all([
    directory(),
    db().select().from(alumni).orderBy(desc(alumni.graduatedAt)),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE"
        title="함께하는 사람들"
        description="각자의 가능성이 모여, 우리의 미래가 됩니다."
      />
      {["1학년", "2학년", "3학년", "교사"].map((group, i) => {
        const members = rows.filter((r) =>
          i < 3
            ? r.user.role === "student" && r.user.grade === i + 1
            : r.user.role !== "student",
        );
        return (
          <section className="member-section" key={group}>
            <div className="section-title">
              <h2>
                {group}
                <span>{members.length}명</span>
              </h2>
            </div>
            {members.length ? (
              <div className="member-grid">
                {members.map((m) => (
                  <Link
                    className="member-card"
                    key={m.user.id}
                    href={`/profile/${m.user.id}`}
                  >
                    <Avatar id={m.avatarId} name={m.user.name} size="large" />
                    <div>
                      <h3>{m.user.name}</h3>
                      <p className="muted">{studentLabel(m.user)}</p>
                      <p className="member-bio">
                        {m.bio || "아직 소개를 작성하지 않았어요."}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">아직 등록된 구성원이 없습니다.</p>
            )}
          </section>
        );
      })}
      <section className="member-section">
        <div className="section-title">
          <h2>
            졸업생<span>{graduates.length}명</span>
          </h2>
        </div>
        <p className="muted">
          우리와 함께했던 이름들. 새로운 시작을 응원합니다.
        </p>
        <div className="alumni-list">
          {graduates.map((g) => (
            <div key={g.id}>
              <strong>{g.name}</strong>
              <time>{date(g.graduatedAt)} 졸업</time>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
