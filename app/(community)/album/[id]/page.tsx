import { EntryDetail } from "@/components/entry-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntryDetail kind="album" id={(await params).id} />;
}
