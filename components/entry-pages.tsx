import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Search, ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  listEntries,
  getEntry,
  entryMedia,
  entryComments,
  PAGE_SIZE,
} from "@/lib/queries";
import { date, entryUrl } from "@/lib/format";
import { categories, uuid } from "@/lib/validation";
import type { Entry } from "@/lib/db/schema";
import { PageHeader, PostList, Empty, Pager, AlbumCard, Avatar } from "./ui";
import { ActionForm, Field, TextArea, ImageUpload } from "./forms";
import { Gallery, ViewTracker } from "./gallery";
const labels = {
  board: [
    "COMMUNITY",
    "우리의 이야기",
    "작은 질문부터 새로운 발견까지, 자유롭게 나눠요.",
  ],
  album: [
    "OUR ALBUM",
    "쌓여가는 순간들",
    "함께해서 더 오래 기억하고 싶은 순간.",
  ],
  notice: [
    "CLASS NOTICES",
    "우리 반 소식",
    "놓치지 말아야 할, 우리 반의 중요한 이야기.",
  ],
  profile: [
    "MY JOURNAL",
    "나의 기록",
    "생각과 취향이 쌓이는 나만의 작은 공간.",
  ],
};
const base = (kind: string) => `/${kind === "notice" ? "notices" : kind}`;
export async function EntryList({
  kind,
  query,
}: {
  kind: "board" | "album" | "notice";
  query: Record<string, string | undefined>;
}) {
  await requireUser();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const rows = await listEntries(kind, {
    q: query.q,
    category: kind === "board" ? query.category : undefined,
    page,
  });
  const visible = rows.slice(0, PAGE_SIZE);
  const photos =
    kind === "album" ? await entryMedia(visible.map((x) => x.entry.id)) : [];
  const [eyebrow, title, description] = labels[kind];
  return (
    <>
      <PageHeader {...{ eyebrow, title, description }}>
        <Link className="button primary" href={`${base(kind)}/new`}>
          <Plus size={16} />
          {kind === "album" ? "추억 올리기" : "글쓰기"}
        </Link>
      </PageHeader>
      <div className="list-tools">
        {kind === "board" && (
          <nav className="category-tabs" aria-label="말머리 필터">
            {["전체", ...categories].map((c) => (
              <Link
                key={c}
                className={(query.category || "전체") === c ? "active" : ""}
                href={`/board?category=${c === "전체" ? "" : encodeURIComponent(c)}&q=${encodeURIComponent(query.q || "")}`}
              >
                {c}
              </Link>
            ))}
          </nav>
        )}
        <form className="list-search" action={base(kind)}>
          <Search size={17} />
          <input
            name="q"
            aria-label="글 검색"
            placeholder="제목 또는 내용 검색"
            defaultValue={query.q}
            maxLength={100}
          />
          {query.category && (
            <input name="category" type="hidden" value={query.category} />
          )}
          <button type="submit">검색</button>
        </form>
      </div>
      {visible.length ? (
        kind === "album" ? (
          <div className="album-grid">
            {visible.map((row) => (
              <AlbumCard
                key={row.entry.id}
                row={row}
                imageId={photos.find((p) => p.entryId === row.entry.id)?.id}
                count={photos.filter((p) => p.entryId === row.entry.id).length}
              />
            ))}
          </div>
        ) : (
          <div className="panel">
            <PostList rows={visible} />
          </div>
        )
      ) : (
        <Empty
          title={
            kind === "album"
              ? "아직 등록된 사진이 없습니다."
              : "아직 게시글이 없습니다."
          }
          description={
            query.q
              ? "다른 검색어로 찾아보세요."
              : kind === "album"
                ? "우리 반의 첫 번째 추억을 남겨보세요."
                : "첫 번째 이야기를 시작해보세요."
          }
        />
      )}
      <Pager
        page={page}
        more={rows.length > PAGE_SIZE}
        base={base(kind)}
        query={new URLSearchParams({
          q: query.q || "",
          category: query.category || "",
        }).toString()}
      />
    </>
  );
}
export async function EntryEditor({
  kind,
  id,
}: {
  kind: Entry["kind"];
  id?: string;
}) {
  const user = await requireUser();
  if (id && !uuid.safeParse(id).success) notFound();
  const data = id ? await getEntry(id) : undefined;
  if (
    id &&
    (!data || data.entry.kind !== kind || data.entry.authorId !== user.id)
  )
    notFound();
  const photos = id ? await entryMedia([id]) : [];
  const e = data?.entry;
  return (
    <>
      <PageHeader
        eyebrow={labels[kind][0]}
        title={
          id
            ? "기록 수정하기"
            : kind === "album"
              ? "새로운 추억 남기기"
              : "새로운 이야기"
        }
        description="완벽하지 않아도 괜찮아요. 지금의 생각을 남겨주세요."
      />
      <div className="panel editor-panel">
        <ActionForm
          name="entry-save"
          payload={{ kind, ...(id ? { id } : {}) }}
          label={id ? "수정 저장" : "게시하기"}
          gate={kind === "notice" && user.role !== "admin"}
        >
          <Field
            label="제목"
            name="title"
            required
            maxLength={120}
            defaultValue={e?.title}
            placeholder="어떤 이야기를 나눌까요?"
          />
          {kind === "board" && (
            <label className="field">
              <span>말머리</span>
              <select name="category" defaultValue={e?.category || "자유"}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <TextArea
            label={kind === "album" ? "사진 이야기" : "내용"}
            name="content"
            rows={kind === "album" ? 4 : 10}
            required
            maxLength={20000}
            defaultValue={e?.content}
            placeholder="자유롭게 작성해 주세요."
          />
          {kind !== "notice" && (
            <ImageUpload purpose={kind} initial={photos.map((x) => x.id)} />
          )}{" "}
          {kind === "notice" && (
            <label className="checkbox">
              <input type="checkbox" name="pinned" defaultChecked={e?.pinned} />
              중요 공지로 고정
            </label>
          )}
        </ActionForm>
      </div>
    </>
  );
}
export async function EntryDetail({
  kind,
  id,
}: {
  kind: "board" | "album" | "notice";
  id: string;
}) {
  const user = await requireUser();
  if (!uuid.safeParse(id).success) notFound();
  const row = await getEntry(id);
  if (!row || row.entry.kind !== kind) notFound();
  const e = row.entry;
  const [photos, comments] = await Promise.all([
    entryMedia([id]),
    kind === "board" ? entryComments(id) : Promise.resolve([]),
  ]);
  return (
    <>
      <Link className="text-link back-link" href={base(kind)}>
        <ArrowLeft size={16} />
        목록으로
      </Link>
      <article className="panel detail-panel">
        <span className="tag">
          {kind === "notice"
            ? e.pinned
              ? "중요 공지"
              : "공지"
            : kind === "album"
              ? "우리의 앨범"
              : e.category}
        </span>
        <h1>{e.title}</h1>
        <div className="author-line">
          <Link href={`/profile/${row.author.id}`}>
            <Avatar id={row.avatarId} name={row.author.name} />
            <strong>{row.author.name}</strong>
          </Link>
          <time>{date(e.createdAt, true)}</time>
          {kind === "board" && <span>조회 {e.views}</span>}
        </div>
        <div className="prose-text">{e.content}</div>
        <Gallery ids={photos.map((p) => p.id)} title={e.title} />
        <div className="detail-actions">
          {e.authorId === user.id && (
            <Link href={`${base(kind)}/${id}/edit`} className="button">
              <Pencil size={15} />
              수정
            </Link>
          )}
          {(e.authorId === user.id || user.role === "admin") && (
            <ActionForm
              name="entry-delete"
              payload={{ id }}
              label="삭제"
              danger
              confirm="이 게시물과 첨부 사진을 삭제할까요?"
            />
          )}
        </div>
      </article>
      {kind === "board" && (
        <>
          <ViewTracker id={id} />
          <section className="panel comments">
            <h2>
              댓글 <span className="muted">{comments.length}</span>
            </h2>
            {comments.length ? (
              comments.map(({ comment: c, author: a, avatarId }) => (
                <div className="comment" key={c.id}>
                  <Avatar id={avatarId} name={a.name} />
                  <div>
                    <Link href={`/profile/${a.id}`}>
                      <strong>{a.name}</strong>
                    </Link>
                    <time>{date(c.createdAt, true)}</time>
                    <p className="prose-text">{c.content}</p>
                    {(c.authorId === user.id || user.role === "admin") && (
                      <ActionForm
                        name="comment-delete"
                        payload={{ id: c.id }}
                        label="댓글 삭제"
                        confirm="댓글을 삭제할까요?"
                        className="small-action"
                      />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">첫 댓글을 남겨보세요.</p>
            )}
            <ActionForm
              name="comment-save"
              payload={{ entryId: id }}
              label="댓글 등록"
              reset
            >
              <TextArea
                label="댓글 작성"
                name="content"
                required
                maxLength={2000}
                rows={3}
                placeholder="서로를 존중하는 따뜻한 이야기를 나눠주세요."
              />
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
