import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { directory, userTheme } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { ActionForm, Field, ThemeControl } from "@/components/forms";
export default async function Settings() {
  const user = await requireUser(),
    theme = await userTheme(user.id);
  const members = user.role === "admin" ? await directory() : [];
  return (
    <>
      <PageHeader
        eyebrow="PREFERENCES"
        title="내게 맞는 공간"
        description="계정과 화면 설정을 관리하세요."
      />
      <div className="settings-stack">
        <section className="panel">
          <h2>계정</h2>
          <div className="settings-row">
            <div>
              <strong>{user.name}</strong>
              <p className="muted">학번 {user.studentId}</p>
            </div>
            <Link className="button" href="/profile/edit">
              프로필 관리
            </Link>
          </div>
          <ActionForm name="logout" label="로그아웃" />
        </section>
        <section className="panel">
          <h2>비밀번호 변경</h2>
          <p className="muted">변경 후 모든 기기에서 로그아웃됩니다.</p>
          <ActionForm name="password-change" label="비밀번호 변경">
            <Field
              name="current"
              label="현재 비밀번호"
              type="password"
              required
              autoComplete="current-password"
            />
            <Field
              name="password"
              label="새 비밀번호"
              type="password"
              required
              minLength={10}
              maxLength={64}
              autoComplete="new-password"
            />
            <Field
              name="confirm"
              label="새 비밀번호 확인"
              type="password"
              required
              minLength={10}
              maxLength={64}
              autoComplete="new-password"
            />
          </ActionForm>
        </section>
        <section className="panel">
          <h2>화면 스타일</h2>
          <p className="muted">편안하게 머무를 수 있는 분위기를 선택하세요.</p>
          <ThemeControl initial={theme} />
        </section>
        {user.role === "admin" && (
          <section className="panel admin-settings">
            <span className="tag">ADMIN ONLY</span>
            <h2>관리자 설정</h2>
            {(["notice", "calendar"] as const).map((kind) => (
              <div className="settings-subsection" key={kind}>
                <h3>
                  {kind === "notice" ? "공지사항" : "일정 추가"} 비밀번호 변경
                </h3>
                <ActionForm
                  name="admin-settings"
                  payload={{ kind }}
                  label="작성 비밀번호 변경"
                >
                  <Field
                    label="새 비밀번호"
                    name="password"
                    type="password"
                    required
                    minLength={10}
                    maxLength={64}
                    autoComplete="new-password"
                  />
                  <Field
                    label="새 비밀번호 확인"
                    name="confirm"
                    type="password"
                    required
                    minLength={10}
                    maxLength={64}
                    autoComplete="new-password"
                  />
                </ActionForm>
              </div>
            ))}
            <div className="settings-subsection">
              <h3>구성원 역할 관리</h3>
              <ActionForm name="role" label="역할 저장">
                <label className="field">
                  <span>구성원</span>
                  <select name="userId" required>
                    {members
                      .filter((m) => m.user.role !== "admin")
                      .map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name} · {m.user.grade}학년{" "}
                          {m.user.classNumber}반 {m.user.studentNumber}번 (
                          {m.user.role === "teacher" ? "교사" : "학생"})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>역할</span>
                  <select name="role">
                    <option value="teacher">교사</option>
                    <option value="student">학생</option>
                  </select>
                </label>
              </ActionForm>
            </div>
            <div className="settings-subsection">
              <h3>시스템 구성</h3>
              <dl className="config-list">
                <dt>데이터베이스</dt>
                <dd>
                  Neon PostgreSQL ·{" "}
                  {process.env.DATABASE_URL ? "환경변수 설정됨" : "미설정"}
                </dd>
                <dt>사진 저장소</dt>
                <dd>
                  Supabase Private Storage ·{" "}
                  {process.env.SUPABASE_SERVICE_ROLE_KEY
                    ? "환경변수 설정됨"
                    : "미설정"}
                </dd>
                <dt>가입 제한</dt>
                <dd>
                  {process.env.REGISTRATION_CODE
                    ? "초대 코드 사용"
                    : "공개 회원가입"}
                </dd>
                <dt>정리 작업 인증</dt>
                <dd>{process.env.CRON_SECRET ? "설정됨" : "미설정"}</dd>
              </dl>
            </div>
          </section>
        )}
        {user.role !== "admin" && (
          <section className="panel danger-zone">
            <h2>졸업 및 계정 삭제</h2>
            <p>
              탈퇴하면 계정, 작성한 글·댓글·사진과 모든 로그인 세션이
              삭제됩니다. 사진 파일은 삭제 대기열을 통해 정리됩니다. 졸업생
              목록에는 이름과 졸업일만 남습니다.
            </p>
            <p className="muted">
              두 비밀번호가 일치하고 확인 문구를 입력하면 버튼이 활성화됩니다.
              실제 비밀번호는 서버에서 최종 확인합니다.
            </p>
            <ActionForm
              name="graduate"
              graduation
              danger
              label="졸업하고 계정 삭제"
              confirm="계정과 개인 기록을 삭제하고 졸업생 목록에 이름을 남깁니다. 되돌릴 수 없습니다. 진행할까요?"
            >
              <Field
                name="password"
                label="현재 비밀번호"
                type="password"
                required
                autoComplete="current-password"
              />
              <Field
                name="confirm"
                label="비밀번호 다시 입력"
                type="password"
                required
                autoComplete="current-password"
              />
              <Field
                name="phrase"
                label="확인 문구"
                placeholder="학교를 졸업하겠습니다"
                required
                pattern="학교를 졸업하겠습니다"
                autoComplete="off"
              />
            </ActionForm>
          </section>
        )}
      </div>
    </>
  );
}
