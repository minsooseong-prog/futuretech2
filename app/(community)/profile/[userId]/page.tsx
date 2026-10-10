import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProfile, listEntries, entryMedia, PAGE_SIZE } from "@/lib/queries";
import { uuid } from "@/lib/validation";
import { date, studentLabel } from "@/lib/format";
import { PageHeader, Avatar, Empty, Pager } from "@/components/ui";
import { Gallery } from "@/components/gallery";
import { ActionForm } from "@/components/forms";
export default async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId } = await params;
  if (!uuid.safeParse(userId).success) notFound();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number((await searchParams).page) || 1)),
  );
  const [viewer, profile, rows] = await Promise.all([
    requireUser(),
    getProfile(userId),
    listEntries("profile", { authorId: userId, page }),
  ]);
  if (!profile) notFound();
  const visible = rows.slice(0, PAGE_SIZE),
    photos = await entryMedia(visible.map((r) => r.entry.id));
  const own = viewer.id === userId;
  return (
    <>
      <PageHeader eyebrow="MINI HOME" title="생각이 머무는 곳" />
      <section className="profile-header panel">
        <div className="profile-banner">
          <span>EVERY MIND IS A NEW POSSIBILITY.</span>
          <span>✳</span>
        </div>
        <div className="profile-info">
          <Avatar id={profile.avatarId} name={profile.user.name} size="hero" />
          <div>
            <h1>{profile.user.name}</h1>
            <p className="muted">{studentLabel(profile.user)}</p>
            <p className="profile-bio prose-text">
              {profile.bio || "아직 소개를 작성하지 않았어요."}
            </p>
            <small className="muted">
              {date(profile.createdAt)}부터 함께하고 있어요.
            </small>
          </div>
          {own && (
            <Link className="button" href="/profile/edit">
              <Pencil size={15} />
              프로필 편집
            </Link>
          )}
        </div>
      </section>
      <div className="section-title">
        <h2>
          나의 작은 기록<span>JOURNAL & GALLERY</span>
        </h2>
        {own && (
          <Link href="/profile/new" className="button primary">
            <Plus size={15} />
            기록 남기기
          </Link>
        )}
      </div>
      {visible.length ? (
        visible.map(({ entry: e }) => (
          <article key={e.id} className="panel journal">
            <time className="muted">{date(e.createdAt, true)}</time>
            <h2>{e.title}</h2>
            <p className="prose-text">{e.content}</p>
            <Gallery
              ids={photos.filter((p) => p.entryId === e.id).map((p) => p.id)}
              title={e.title}
            />
            <div className="detail-actions">
              {own && (
                <Link className="button" href={`/profile/posts/${e.id}/edit`}>
                  수정
                </Link>
              )}
              {(own || viewer.role === "admin") && (
                <ActionForm
                  name="entry-delete"
                  payload={{ id: e.id }}
                  label="삭제"
                  danger
                  confirm="기록과 사진을 삭제할까요?"
                />
              )}
            </div>
          </article>
        ))
      ) : (
        <Empty
          title="아직 남긴 기록이 없습니다."
          description="좋아하는 것, 오늘의 생각, 기억하고 싶은 순간을 담아보세요."
        />
      )}
      <Pager
        page={page}
        more={rows.length > PAGE_SIZE}
        base={`/profile/${userId}`}
      />
    </>
  );
}
