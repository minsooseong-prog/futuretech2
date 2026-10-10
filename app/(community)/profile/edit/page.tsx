import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { studentLabel } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ActionForm, TextArea, ImageUpload } from "@/components/forms";
export default async function Edit() {
  const user = await requireUser(),
    p = await getProfile(user.id);
  return (
    <>
      <PageHeader
        eyebrow="MY PROFILE"
        title="나를 소개해요"
        description={`${user.name} · ${studentLabel(user)}`}
      />
      <section className="panel editor-panel">
        <ActionForm name="profile-save">
          <ImageUpload
            purpose="avatar"
            single
            max={1}
            initial={p?.avatarId ? [p.avatarId] : []}
          />
          <TextArea
            label="한 줄 소개"
            name="bio"
            rows={4}
            maxLength={300}
            defaultValue={p?.bio || ""}
            placeholder="미래를 만드는 중."
          />
          <p className="help">이름과 학번 정보는 직접 변경할 수 없습니다.</p>
        </ActionForm>
      </section>
    </>
  );
}
