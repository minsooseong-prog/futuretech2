import { EntryList } from "@/components/entry-pages";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <EntryList kind="board" query={await searchParams} />;
}
