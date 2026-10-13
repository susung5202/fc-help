"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import { createClient } from "@/lib/supabase/client";

type Favorite = {
  player_spid: number;
  player_name: string;
  season_name: string;
  created_at: string;
};
type FavoriteInput = {
  playerSpid: number;
  playerName: string;
  seasonName: string;
};
type FavoritesContextValue = {
  userId: string | null;
  favorites: Favorite[];
  loading: boolean;
  saving: boolean;
  toggle: (player: FavoriteInput) => Promise<void>;
};
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function RefreshFavoritesProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load(showLoading = true) {
      if (showLoading) setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      const nextId = auth.user?.id ?? null;
      setUserId(nextId);
      if (!nextId) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("refresh_favorites")
        .select("player_spid,player_name,season_name,created_at")
        .eq("user_id", nextId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("갱신 즐겨찾기 조회 오류", error.message);
        setFavorites([]);
      } else {
        setFavorites((data ?? []).map((row) => ({
          player_spid: Number(row.player_spid),
          player_name: row.player_name,
          season_name: row.season_name,
          created_at: row.created_at,
        })));
      }
      setLoading(false);
    }

    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
    });
    // Refresh the stars without unmounting the current alert-settings dialog.
    const onAlertSaved = () => void load(false);
    window.addEventListener("fc-help-refresh-favorites-changed", onAlertSaved);
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("fc-help-refresh-favorites-changed", onAlertSaved);
    };
  }, [supabase]);

  const toggle = useCallback(async (player: FavoriteInput) => {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const exists = favorites.some((item) => item.player_spid === player.playerSpid);
      if (exists) {
        const { error } = await supabase
          .from("refresh_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("player_spid", player.playerSpid);
        if (error) throw error;
        setFavorites((rows) => rows.filter((row) => row.player_spid !== player.playerSpid));
      } else {
        const { data, error } = await supabase
          .from("refresh_favorites")
          .insert({
            user_id: userId,
            player_spid: player.playerSpid,
            player_name: player.playerName,
            season_name: player.seasonName,
          })
          .select("player_spid,player_name,season_name,created_at")
          .single();
        if (error) throw error;
        setFavorites((rows) => [
          {
            player_spid: Number(data.player_spid),
            player_name: data.player_name,
            season_name: data.season_name,
            created_at: data.created_at,
          },
          ...rows,
        ]);
      }
    } finally {
      setSaving(false);
    }
  }, [favorites, router, saving, supabase, userId]);

  return (
    <FavoritesContext.Provider value={{ userId, favorites, loading, saving, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("RefreshFavoritesProvider가 필요합니다.");
  return value;
}

export function RefreshFavoriteButton({
  playerSpid,
  playerName,
  seasonName,
  compact = false,
}: FavoriteInput & { compact?: boolean }) {
  const { favorites, loading, saving, toggle } = useFavorites();
  const [error, setError] = useState("");
  const active = favorites.some((row) => row.player_spid === playerSpid);

  async function handleToggle() {
    setError("");
    try {
      await toggle({ playerSpid, playerName, seasonName });
    } catch {
      setError("즐겨찾기 저장에 실패했습니다.");
    }
  }

  return (
    <div className={compact ? "absolute right-3 top-3 z-20" : "relative"}>
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading || saving}
        aria-pressed={active}
        aria-label={active ? `${playerName} 즐겨찾기 해제` : `${playerName} 즐겨찾기 추가`}
        title={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={compact
          ? `rounded-xl border p-2.5 text-lg shadow-lg transition disabled:opacity-50 ${active ? "border-amber-300/40 bg-amber-300/20 text-amber-300" : "border-white/15 bg-[#111318]/85 text-white hover:border-amber-300/40"}`
          : `rounded-xl border px-5 py-3 text-sm font-bold transition disabled:opacity-50 ${active ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-white/20 bg-white/5 text-white hover:border-amber-300/40"}`
        }
      >
        {loading ? "…" : compact ? (active ? "★" : "☆") : active ? "★ 즐겨찾기됨" : "☆ 즐겨찾기"}
      </button>
      {error && <p role="alert" className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-red-950 p-2 text-xs text-red-200">{error}</p>}
    </div>
  );
}

export function RefreshFavoritesList() {
  const { userId, favorites, loading, saving, toggle } = useFavorites();
  const [error, setError] = useState("");

  async function remove(item: Favorite) {
    setError("");
    try {
      await toggle({
        playerSpid: item.player_spid,
        playerName: item.player_name,
        seasonName: item.season_name,
      });
    } catch {
      setError("즐겨찾기를 해제하지 못했습니다. 다시 시도해주세요.");
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-gray-500">즐겨찾기를 불러오는 중...</p>;
  }

  if (!userId) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#171b21] px-6 py-20 text-center">
        <p className="text-lg font-black">로그인 후 즐겨찾기를 사용할 수 있습니다.</p>
        <Link href="/login" className="mt-6 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black">로그인하기 →</Link>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#171b21] px-6 py-20 text-center">
        <p className="text-lg font-black">저장한 선수가 없습니다.</p>
        <p className="mt-2 text-sm text-gray-400">갱신시간 검색에서 별표를 누르면 이곳에 모아볼 수 있습니다.</p>
        <Link href="/refresh" className="mt-6 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black">갱신시간 검색하기 →</Link>
      </div>
    );
  }

  return (
    <>
      <p className="mt-5 text-sm text-gray-400">총 {favorites.length}명의 선수를 저장했습니다. 알림 등록과는 별도로 관리됩니다.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((item) => (
          <article key={item.player_spid} className="overflow-hidden rounded-2xl border border-white/10 bg-[#181b21]">
            <Link href={`/refresh/${item.player_spid}`} className="block transition hover:bg-white/[0.04]">
              <div className="flex h-40 items-end justify-center bg-gradient-to-b from-white/5 to-transparent">
                <PlayerArtwork spid={item.player_spid} alt={item.player_name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="px-5 pt-3">
                <p className="text-xs font-bold text-lime-300">{item.season_name || "시즌 미확인"}</p>
                <h2 className="mt-1 text-lg font-black">{item.player_name}</h2>
                <p className="mt-2 text-xs text-gray-500">갱신시간 확인하기 →</p>
              </div>
            </Link>
            <div className="px-5 pb-4 pt-3">
              <button
                type="button"
                onClick={() => void remove(item)}
                disabled={saving}
                className="rounded-lg border border-amber-300/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-white/5 disabled:opacity-50"
              >★ 즐겨찾기 해제</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
