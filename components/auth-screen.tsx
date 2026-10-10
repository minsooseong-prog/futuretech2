import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActionForm, Field } from "./forms";
export function AuthScreen({
  register = false,
  notice = "",
}: {
  register?: boolean;
  notice?: string;
}) {
  return (
    <main className="auth-page">
      <header className="auth-top">
        <Link href="/" className="wordmark">
          future tech<span>✳</span>
        </Link>
        <span>우리의 생각이 미래가 되는 곳</span>
      </header>
      <section className="auth-content">
        <div className="auth-panel">
          <p className="eyebrow">A SPACE FOR OUR NEXT</p>
          <h1>
            {register ? "우리의 다음에, 함께해요." : "다시 만나서 반가워요."}
          </h1>
          <p className="muted">함께 배우고 만드는 미래공학 클래스.</p>
          <nav className="auth-tabs">
            <Link href="/login" className={!register ? "active" : ""}>
              로그인
            </Link>
            <Link href="/register" className={register ? "active" : ""}>
              회원가입
            </Link>
          </nav>
          {notice && <p className="info-banner">{notice}</p>}
          <ActionForm
            name={register ? "register" : "login"}
            label={register ? "함께 시작하기" : "우리 반으로 들어가기"}
          >
            <Field
              label="이름"
              name="name"
              placeholder="이름을 입력해 주세요"
              required
              maxLength={40}
              autoComplete="name"
            />
            <Field
              label="학번"
              name="studentId"
              placeholder="예: 20208"
              required
              pattern="[0-9]{5}"
              maxLength={5}
              inputMode="numeric"
              autoComplete="username"
            />
            <Field
              label="비밀번호"
              name="password"
              type="password"
              placeholder={
                register
                  ? "10자 이상 입력해 주세요"
                  : "비밀번호를 입력해 주세요"
              }
              required
              minLength={register ? 10 : 1}
              maxLength={64}
              autoComplete={register ? "new-password" : "current-password"}
            />
            {register && (
              <>
                <Field
                  label="비밀번호 확인"
                  name="confirm"
                  type="password"
                  required
                  minLength={10}
                  maxLength={64}
                  autoComplete="new-password"
                />
                {process.env.REGISTRATION_CODE && (
                  <Field
                    label="우리 반 초대 코드"
                    name="inviteCode"
                    required
                    autoComplete="off"
                  />
                )}
                <p className="help">
                  학번으로 학년·반·번호가 자동 등록됩니다.
                  <br />
                  가입하면 로그인한 구성원에게 이름과 프로필이 공개됩니다.
                </p>
              </>
            )}
          </ActionForm>
          <p className="auth-footnote">
            작은 호기심에서 시작되는, 더 큰 가능성.
            <ArrowUpRight size={14} />
          </p>
        </div>
        <div className="auth-art" aria-label="Future Tech">
          <span className="art-index">EST. 2026 / FUTURE ENGINEERING</span>
          <div className="scribble-word">
            Future
            <br />
            <span>Tech</span>
            <i>✳</i>
          </div>
          <div className="art-caption">
            <span>THINK. MAKE. TOGETHER.</span>
            <p>
              아직 없는 내일을,
              <br />
              우리의 이야기로.
            </p>
          </div>
        </div>
      </section>
      <footer className="auth-footer">
        <span>© Future Tech Class Community</span>
        <span>THE NEXT CHAPTER IS OURS.</span>
      </footer>
    </main>
  );
}
