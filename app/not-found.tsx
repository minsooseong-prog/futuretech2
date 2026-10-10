import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <p className="eyebrow">404 / NOT HERE</p>
      <h1>이 페이지는 찾을 수 없어요.</h1>
      <p>주소가 변경되었거나 삭제된 기록일 수 있습니다.</p>
      <Link className="button primary" href="/home">
        홈으로 돌아가기
      </Link>
    </main>
  );
}
