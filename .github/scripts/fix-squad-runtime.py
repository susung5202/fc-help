from pathlib import Path


def replace_function(source: str, signature: str, replacement: str) -> str:
    start = source.find(signature)
    if start < 0:
        raise SystemExit(f'function not found: {signature}')
    brace = source.find('{', start)
    if brace < 0:
        raise SystemExit(f'function brace not found: {signature}')
    depth = 0
    end = None
    for i in range(brace, len(source)):
        ch = source[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise SystemExit(f'function end not found: {signature}')
    return source[:start] + replacement + source[end:]


# 1) Make position OVR parsing work with both FC Online ability section labels,
#    and parse stat names as exact tokens instead of independent substring matches.
pos_path = Path('lib/fconline/positionOvr.ts')
pos = pos_path.read_text(encoding='utf-8')
pos_replacement = r'''export function calculatePositionOvrFromText(text: string, position: string): number | null {
  const markerIndexes = [text.lastIndexOf("능력치 전체"), text.lastIndexOf("총 능력치")].filter(
    (index) => index >= 0
  );
  const abilityMarker = markerIndexes.length > 0 ? Math.max(...markerIndexes) : -1;
  const birthMarker = text.indexOf("출생", abilityMarker >= 0 ? abilityMarker : 0);
  const section = text.slice(
    abilityMarker >= 0 ? abilityMarker : 0,
    birthMarker >= 0 ? birthMarker : text.length
  );

  const abilities: Record<string, number> = {};
  const abilityPattern = new RegExp(
    `(?:^|\\s)(${ABILITY_NAMES.map(escapeRegExp).join("|")})\\s+(\\d{1,3})(?=\\s|$)`,
    "g"
  );

  for (const match of section.matchAll(abilityPattern)) {
    const name = match[1];
    const value = Number(match[2]);
    if (Number.isFinite(value)) abilities[name] = value;
  }

  return calculatePositionOvrFromAbilities(abilities, position);
}'''
pos = replace_function(pos, 'export function calculatePositionOvrFromText(', pos_replacement)
pos_path.write_text(pos, encoding='utf-8')


# 2) Retry transient FC Online mobile player requests so individual cards do not fall back to '-'.
card_path = Path('app/api/squad/card/route.ts')
card = card_path.read_text(encoding='utf-8')
card_fetch_replacement = r'''async function fetchMobilePlayerHtml(spid: number) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${MOBILE_PLAYER_URL}?spid=${spid}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        next: { revalidate: 300 },
      });

      if (response.ok) return response.text();

      lastError = new Error(`mobile player request failed: ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("mobile player request failed");
}'''
card = replace_function(card, 'async function fetchMobilePlayerHtml(', card_fetch_replacement)
card_path.write_text(card, encoding='utf-8')


# 3) Retry PlayerAbility calls and avoid one failed player wiping the entire squad response.
team_path = Path('app/api/squad/team-color/route.ts')
team = team_path.read_text(encoding='utf-8')
team_fetch_replacement = r'''async function fetchPlayerAbility(player: SquadInput) {
  const cacheKey = `${player.spid}:${player.grade}:4`;
  const cached = abilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.html;

  const body = new URLSearchParams({
    spid: String(player.spid),
    n1Strong: String(Math.min(13, Math.max(1, player.grade))),
    n1Grow: "4",
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n1Change: "0",
    strPlayerImg: `https://fo4.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${player.spid}.png`,
    rd: "0",
  }).toString();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(PLAYER_ABILITY_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: `https://fconline.nexon.com/DataCenter/PlayerInfo?spid=${player.spid}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body,
        cache: "no-store",
      });

      if (response.ok) {
        const html = await response.text();
        abilityCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, html });
        return html;
      }

      lastError = new Error(`player ability request failed: ${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 220 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("player ability request failed");
}'''
team = replace_function(team, 'async function fetchPlayerAbility(', team_fetch_replacement)

start_marker = '    const basePlayers: BasePlayerData[] = await Promise.all('
end_marker = '    const [affiliationCandidates, relationshipCandidates] = await Promise.all(['
start = team.find(start_marker)
end = team.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('basePlayers block not found')
base_replacement = r'''    const basePlayers: BasePlayerData[] = [];

    // FC Online 쪽 요청을 11개 동시에 몰아치면 일부 요청이 간헐적으로 실패할 수 있다.
    // 3명씩 나눠 요청하고, 끝까지 실패한 선수만 제외해서 한 명의 실패가 전체 스쿼드를 비우지 않게 한다.
    for (let index = 0; index < players.length; index += 3) {
      const batch = await Promise.all(
        players.slice(index, index + 3).map(async (player): Promise<BasePlayerData | null> => {
          try {
            const html = await fetchPlayerAbility(player);
            const abilityBaseOvr = calculatePositionOvrFromAbilities(
              parseAbilityValues(html),
              player.position
            );

            return {
              player,
              html,
              baseOvr: parsePositionOvr(html, player.position) ?? abilityBaseOvr,
              enhancementOptions: parseOptionsBetween(html, "강화 팀컬러", "소속 팀컬러"),
              affiliationOptions: parseOptionsBetween(html, "소속 팀컬러", "관계 팀컬러"),
              relationshipOptions: parseOptionsBetween(html, "관계 팀컬러", "클래스 비교"),
            };
          } catch (error) {
            console.error("Squad player ability fetch failed", {
              slotId: player.slotId,
              spid: player.spid,
              position: player.position,
              error,
            });
            return null;
          }
        })
      );

      basePlayers.push(
        ...batch.filter((item): item is BasePlayerData => item !== null)
      );
    }

'''
team = team[:start] + base_replacement + team[end:]

# Ensure enhancement team color remains visible even if every upstream player detail request fails.
needle = '    const ovrBySlot: Record<string, number | null> = {};\n\n    for (const item of basePlayers) {'
if needle not in team:
    raise SystemExit('team color map insertion point not found')
insert = r'''    const ovrBySlot: Record<string, number | null> = {};

    if (enhancement) {
      const effect = `전체 능력치 +${enhancement.bonus}`;
      selectedTeamColorMap.set(`enhancement:${enhancement.name}`, {
        name: enhancement.name,
        category: "enhancement",
        id: officialEnhancementEmblem?.id ?? enhancementInfo?.id ?? enhancementOption?.id ?? null,
        emblemUrl:
          officialEnhancementEmblem?.emblemUrl ??
          enhancementInfo?.emblemUrl ??
          enhancementOption?.emblemUrl ??
          null,
        count: enhancement.count,
        level: enhancement.level,
        maxLevel: enhancement.maxLevel,
        maxRequired: enhancement.required,
        effect,
      });
    }

    for (const item of basePlayers) {'''
team = team.replace(needle, insert, 1)

# Remove the duplicate enhancement-map write from inside the player loop, leaving only the effect application.
old_inner = r'''      if (enhancement && enhancementApplies) {
        const effect = `전체 능력치 +${enhancement.bonus}`;
        effects.push(effect);
        selectedTeamColorMap.set(`enhancement:${enhancement.name}`, {
          name: enhancement.name,
          category: "enhancement",
          id: officialEnhancementEmblem?.id ?? enhancementInfo?.id ?? enhancementOption?.id ?? null,
          emblemUrl:
            officialEnhancementEmblem?.emblemUrl ??
            enhancementInfo?.emblemUrl ??
            enhancementOption?.emblemUrl ??
            null,
          count: enhancement.count,
          level: enhancement.level,
          maxLevel: enhancement.maxLevel,
          maxRequired: enhancement.required,
          effect,
        });
      }'''
new_inner = r'''      if (enhancement && enhancementApplies) {
        effects.push(`전체 능력치 +${enhancement.bonus}`);
      }'''
if old_inner not in team:
    raise SystemExit('inner enhancement block not found')
team = team.replace(old_inner, new_inner, 1)
team_path.write_text(team, encoding='utf-8')
