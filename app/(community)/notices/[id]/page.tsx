import { EntryDetail } from "@/components/entry-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntryDetail kind="notice" id={(await params).id} />;
}
