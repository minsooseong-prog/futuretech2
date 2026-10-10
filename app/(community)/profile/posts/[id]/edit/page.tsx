import { EntryEditor } from "@/components/entry-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <EntryEditor kind="profile" id={(await params).id} />;
}
