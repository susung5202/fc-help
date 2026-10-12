export type PlayerMeta = { id: number; name: string };
export type SeasonMeta = { seasonId: number; className: string };
export type ObservationMatch = { player_spid: number | null; player_name: string; season_name: string };

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

const seasonAliases: Record<string, string[]> = {
  "26fsl": ["26fsl", "26fcosuperchampionsleague"],
  "26tots": ["26tots", "26teamoftheseason"],
  "25ucl": ["25ucl", "25uefachampionsleague"],
  "22ucl": ["22ucl", "22uefachampionsleague"],
  "ptg": ["ptg", "pathtoglory"],
  "tk": ["tk", "teamkorea"],
  "wg": ["wg", "warriorsofglory"],
  "ws": ["ws", "winningstreak"],
  "uc": ["uc", "untouchablechampions"],
  "25dp": ["25dp", "25devotedplayer"],
};

function seasonEquivalent(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (left === right) return true;
  return Object.values(seasonAliases).some(
    (aliases) => aliases.includes(left) && aliases.includes(right)
  );
}

/**
 * Return an SPID only when official metadata identifies exactly one matching card.
 * Never guess an SPID from a name alone.
 */
export function matchObservationSpid(
  observation: ObservationMatch,
  players: PlayerMeta[],
  seasons: SeasonMeta[]
): number | null {
  if (observation.player_spid != null) {
    const id = Number(observation.player_spid);
    return players.some((player) => player.id === id) ? id : null;
  }
  const candidates = players.filter((player) => {
    if (normalize(player.name) !== normalize(observation.player_name)) return false;
    const seasonId = Math.floor(player.id / 1_000_000);
    const season = seasons.find((item) => Number(item.seasonId) === seasonId);
    return Boolean(season && seasonEquivalent(season.className, observation.season_name));
  });
  return candidates.length === 1 ? candidates[0].id : null;
}
