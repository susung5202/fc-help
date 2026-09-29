import CommunityWrite from "@/components/CommunityWrite";

export const metadata = {
  title: "게시글 수정 | FC Help",
};

export default async function CommunityEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <CommunityWrite postId={id} />
    </main>
  );
}
