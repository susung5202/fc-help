import CommunityDetail from "@/components/CommunityDetail";

export const metadata = {
  title: "커뮤니티 게시글 | FC Help",
};

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <CommunityDetail id={id} />
    </main>
  );
}
