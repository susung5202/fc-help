import CommunityWrite from "@/components/CommunityWrite";

export const metadata = {
  title: "커뮤니티 글쓰기 | FC Help",
  description: "FC Help 커뮤니티에 새 게시글을 작성합니다.",
};

export default function CommunityWritePage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <CommunityWrite />
    </main>
  );
}
