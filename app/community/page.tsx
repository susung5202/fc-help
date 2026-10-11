import CommunityFeed from "@/components/CommunityFeed";
import ServiceUsageNotes from "@/components/ServiceUsageNotes";

export const metadata = {
  title: "커뮤니티 | FC Help",
  description: "FC Online 자유 이야기, 질문, 팁과 스쿼드를 나누는 FC Help 커뮤니티입니다.",
  alternates: { canonical: "/community" },
};

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <CommunityFeed />
      <ServiceUsageNotes section="community" />
    </main>
  );
}
