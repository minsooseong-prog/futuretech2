import { EntryEditor } from "@/components/entry-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntryEditor kind="album" id={(await params).id} />;
}
