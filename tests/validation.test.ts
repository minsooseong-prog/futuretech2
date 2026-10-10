import { describe, it, expect } from "vitest";
import {
  parseStudentId,
  registerSchema,
  password,
  eventSchema,
  graduationSchema,
} from "../lib/validation";
import { studentLabel } from "../lib/format";
describe("input boundaries", () => {
  it("parses five-digit class identifiers and reserves administrator ID", () => {
    expect(parseStudentId("20208")).toEqual({
      grade: 2,
      classNumber: 2,
      studentNumber: 8,
    });
    for (const id of ["00000", "20008", "20200", "40208", "２０２０８", "2020"])
      expect(() => parseStudentId(id)).toThrow();
  });
  it("does not truncate long UTF-8 passwords at bcrypt's boundary", () => {
    expect(password.safeParse("가".repeat(25)).success).toBe(false);
    expect(password.safeParse("가".repeat(20)).success).toBe(true);
  });
  it("requires matching confirmation", () => {
    expect(
      registerSchema.safeParse({
        name: "김학생",
        studentId: "20208",
        password: "long-password",
        confirm: "another",
      }).success,
    ).toBe(false);
  });
  it("requires exact graduation phrase", () => {
    expect(
      graduationSchema.safeParse({
        password: "x",
        confirm: "x",
        phrase: "학교를 졸업하겠습니다 ",
      }).success,
    ).toBe(false);
  });
  it("rejects events that end before they begin", () => {
    expect(
      eventSchema.safeParse({
        title: "실습",
        startDate: "2026-10-11T09:00:00+09:00",
        endDate: "2026-10-10T09:00:00+09:00",
        allDay: false,
      }).success,
    ).toBe(false);
  });
  it("groups an administrator as teacher without parsing 00000", () => {
    expect(
      studentLabel({
        role: "admin",
        grade: null,
        classNumber: null,
        studentNumber: null,
      }),
    ).toBe("교사");
  });
});
