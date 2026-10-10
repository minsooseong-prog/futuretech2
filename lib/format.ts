export function date(value: Date | string, withTime = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value));
}
export function studentLabel(user: {
  role: string;
  grade: number | null;
  classNumber: number | null;
  studentNumber: number | null;
}) {
  return user.role !== "student"
    ? "교사"
    : `${user.grade}학년 ${user.classNumber}반 ${user.studentNumber}번`;
}
export function entryUrl(e: { kind: string; id: string; authorId?: string }) {
  return e.kind === "profile"
    ? `/profile/${e.authorId}`
    : `/${e.kind === "notice" ? "notices" : e.kind}/${e.id}`;
}
