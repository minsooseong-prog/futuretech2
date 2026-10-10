"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">A LITTLE PAUSE</p>
      <h1>잠시 연결이 어려워요.</h1>
      <p>
        잠시 후 다시 시도해 주세요. 처음 설치했다면 환경변수와 DB 초기화를
        확인해 주세요.
      </p>
      <button className="button primary" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
