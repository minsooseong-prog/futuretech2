import { requireUser } from "@/lib/auth";
import { calendarEvents, upcoming } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { Calendar } from "@/components/calendar";
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const q = (await searchParams).month;
  const current = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
  const value = q && /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(q) ? q : current;
  const [year, month] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, -6) - 9 * 3600000),
    end = new Date(Date.UTC(year, month, 8) - 9 * 3600000);
  const [events, next] = await Promise.all([
    calendarEvents(start, end),
    upcoming(),
  ]);
  const serialize = (items: typeof events) =>
    items.map((e) => ({
      ...e,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    }));
  return (
    <>
      <PageHeader
        eyebrow="DAYS AHEAD"
        title="함께할 날들"
        description="새로운 배움과 만남, 놓치지 않도록."
      />
      <Calendar
        key={value}
        {...{ year, month }}
        events={serialize(events)}
        upcoming={serialize(next)}
        userId={user.id}
        admin={user.role === "admin"}
      />
    </>
  );
}
