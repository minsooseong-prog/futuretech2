"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Pencil } from "lucide-react";
import { ActionForm, Field, TextArea } from "./forms";
import { date } from "@/lib/format";
type Event = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  createdBy: string | null;
};
function localDate(value: string) {
  const d = new Date(new Date(value).getTime() + 9 * 3600000);
  return d.toISOString().slice(0, 10);
}
function localInput(value: string, allDay: boolean) {
  const d = new Date(new Date(value).getTime() + 9 * 3600000);
  return d.toISOString().slice(0, allDay ? 10 : 16);
}
export function Calendar({
  year,
  month,
  events,
  upcoming,
  userId,
  admin,
}: {
  year: number;
  month: number;
  events: Event[];
  upcoming: Event[];
  userId: string;
  admin: boolean;
}) {
  const today = localDate(new Date().toISOString()),
    [selected, setSelected] = useState(
      `${year}-${String(month).padStart(2, "0")}-01`,
    ),
    [editing, setEditing] = useState<Event | null>(null),
    [allDay, setAllDay] = useState(true),
    [version, setVersion] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const first = new Date(Date.UTC(year, month - 1, 1)),
    start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(start.getTime() + i * 86400000),
  );
  function monthLink(offset: number) {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `/calendar?month=${d.toISOString().slice(0, 7)}`;
  }
  function open(event: Event | null = null) {
    setEditing(event);
    setAllDay(event?.allDay ?? true);
    setVersion((v) => v + 1);
    dialog.current?.showModal();
  }
  const onDay = (d: string) =>
    events.filter(
      (e) => localDate(e.startDate) <= d && localDate(e.endDate) >= d,
    );
  return (
    <>
      <div className="calendar-toolbar">
        <div className="actions">
          <Link
            className="icon-button"
            href={monthLink(-1)}
            aria-label="이전 달"
          >
            <ChevronLeft />
          </Link>
          <h2>
            {year}년 {month}월
          </h2>
          <Link
            className="icon-button"
            href={monthLink(1)}
            aria-label="다음 달"
          >
            <ChevronRight />
          </Link>
          <Link
            className="button"
            href={`/calendar?month=${today.slice(0, 7)}`}
            onClick={() => setSelected(today)}
          >
            오늘
          </Link>
        </div>
        <button className="button primary" onClick={() => open()}>
          <Plus size={16} />
          일정 추가
        </button>
      </div>
      <div className="calendar-layout">
        <section className="calendar panel">
          <div className="calendar-week">
            {"일월화수목금토".split("").map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10),
                found = onDay(key);
              return (
                <button
                  key={key}
                  className={`calendar-day ${d.getUTCMonth() !== month - 1 ? "outside" : ""} ${key === selected ? "selected" : ""} ${key === today ? "is-today" : ""}`}
                  onClick={() => setSelected(key)}
                  aria-pressed={key === selected}
                  aria-label={`${key}, 일정 ${found.length}개`}
                >
                  <span className="day-number">{d.getUTCDate()}</span>
                  {found.slice(0, 2).map((e) => (
                    <span className="calendar-event" key={e.id}>
                      {e.title}
                    </span>
                  ))}
                  {found.length > 2 && <small>+{found.length - 2}</small>}
                </button>
              );
            })}
          </div>
        </section>
        <aside className="panel day-detail">
          <p className="eyebrow">SELECTED DAY</p>
          <h2>{date(`${selected}T00:00:00+09:00`)}</h2>
          {onDay(selected).length ? (
            onDay(selected).map((e) => (
              <article key={e.id} className="day-event">
                <span className="tag">
                  {e.allDay ? "종일" : date(e.startDate, true)}
                </span>
                <h3>{e.title}</h3>
                <p className="prose-text muted">{e.description}</p>
                <small className="muted">
                  {date(e.startDate)} ~ {date(e.endDate)}
                </small>
                {(admin || e.createdBy === userId) && (
                  <div className="event-actions">
                    <button className="button" onClick={() => open(e)}>
                      <Pencil size={13} />
                      수정
                    </button>
                    <ActionForm
                      name="event-delete"
                      payload={{ id: e.id }}
                      label="삭제"
                      danger
                      confirm="이 일정을 삭제할까요?"
                    />
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="muted">등록된 일정이 없습니다.</p>
          )}
          <button className="text-link" onClick={() => open()}>
            <Plus size={15} />이 날짜에 일정 추가
          </button>
        </aside>
      </div>
      <section className="panel">
        <h2>다가오는 일정</h2>
        {upcoming.length ? (
          upcoming.map((e) => (
            <div key={e.id} className="upcoming-row">
              <time>{date(e.startDate, e.allDay ? false : true)}</time>
              <strong>{e.title}</strong>
              <span className="muted">{e.allDay ? "종일" : "시간 지정"}</span>
            </div>
          ))
        ) : (
          <p className="muted">예정된 일정이 없습니다.</p>
        )}
      </section>
      <dialog ref={dialog} className="dialog calendar-dialog">
        <div className="section-title">
          <h2>{editing ? "일정 수정" : "새로운 일정"}</h2>
          <button
            className="icon-button"
            onClick={() => dialog.current?.close()}
            aria-label="닫기"
          >
            <X />
          </button>
        </div>
        <ActionForm
          key={version}
          name="event-save"
          onSaved={() => dialog.current?.close()}
          payload={editing ? { id: editing.id } : {}}
          label="일정 저장"
          gate={!admin}
        >
          <Field
            name="title"
            label="일정 제목"
            required
            maxLength={120}
            defaultValue={editing?.title}
          />
          <TextArea
            name="description"
            label="설명"
            rows={3}
            maxLength={3000}
            defaultValue={editing?.description}
          />
          <label className="checkbox">
            <input
              name="allDay"
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            종일
          </label>
          <div className="form-columns">
            <Field
              key={`s-${allDay}`}
              name="startDate"
              label="시작"
              type={allDay ? "date" : "datetime-local"}
              required
              defaultValue={
                editing
                  ? localInput(editing.startDate, allDay)
                  : selected + (allDay ? "" : "T09:00")
              }
            />
            <Field
              key={`e-${allDay}`}
              name="endDate"
              label="종료"
              type={allDay ? "date" : "datetime-local"}
              required
              defaultValue={
                editing
                  ? localInput(editing.endDate, allDay)
                  : selected + (allDay ? "" : "T18:00")
              }
            />
          </div>
          <p className="help">모든 일정은 한국 시간(Asia/Seoul) 기준입니다.</p>
        </ActionForm>
      </dialog>
    </>
  );
}
