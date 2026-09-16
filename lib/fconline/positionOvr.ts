const POSITION_ALIASES: Record<string, string> = {
  LS: "ST",
  RS: "ST",
  LF: "CF",
  RF: "CF",
  LAM: "CAM",
  RAM: "CAM",
  LCM: "CM",
  RCM: "CM",
  LDM: "CDM",
  RDM: "CDM",
  LCB: "CB",
  RCB: "CB",
  LWB: "LB",
  RWB: "RB",
  SW: "CB",
};

type PositionWeights = Record<string, number>;

const POSITION_WEIGHTS: Record<string, PositionWeights> = {
  ST: {
    "골 결정력": 18,
    "위치 선정": 13,
    "볼 컨트롤": 10,
    "슛 파워": 10,
    헤더: 10,
    "반응 속도": 8,
    드리블: 7,
    몸싸움: 5,
    속력: 5,
    "짧은 패스": 5,
    가속력: 4,
    "중거리 슛": 3,
    발리슛: 2,
  },
  CF: {
    "볼 컨트롤": 15,
    드리블: 14,
    "위치 선정": 13,
    "골 결정력": 11,
    "반응 속도": 9,
    "짧은 패스": 9,
    시야: 8,
    "슛 파워": 5,
    속력: 5,
    가속력: 5,
    "중거리 슛": 4,
    헤더: 2,
  },
  LW: {
    드리블: 16,
    "볼 컨트롤": 14,
    "골 결정력": 10,
    "위치 선정": 9,
    "짧은 패스": 9,
    크로스: 9,
    "반응 속도": 7,
    가속력: 7,
    시야: 6,
    속력: 6,
    "중거리 슛": 4,
    민첩성: 3,
  },
  RW: {
    드리블: 16,
    "볼 컨트롤": 14,
    "골 결정력": 10,
    "위치 선정": 9,
    "짧은 패스": 9,
    크로스: 9,
    "반응 속도": 7,
    가속력: 7,
    시야: 6,
    속력: 6,
    "중거리 슛": 4,
    민첩성: 3,
  },
  CAM: {
    "짧은 패스": 16,
    "볼 컨트롤": 15,
    시야: 14,
    드리블: 13,
    "위치 선정": 9,
    "반응 속도": 7,
    "골 결정력": 7,
    "중거리 슛": 5,
    가속력: 4,
    "긴 패스": 4,
    속력: 3,
    민첩성: 3,
  },
  LM: {
    드리블: 15,
    "볼 컨트롤": 13,
    "짧은 패스": 11,
    크로스: 10,
    "위치 선정": 8,
    "반응 속도": 7,
    가속력: 7,
    시야: 7,
    "골 결정력": 6,
    속력: 6,
    스태미너: 5,
    "긴 패스": 5,
  },
  RM: {
    드리블: 15,
    "볼 컨트롤": 13,
    "짧은 패스": 11,
    크로스: 10,
    "위치 선정": 8,
    "반응 속도": 7,
    가속력: 7,
    시야: 7,
    "골 결정력": 6,
    속력: 6,
    스태미너: 5,
    "긴 패스": 5,
  },
  CM: {
    "짧은 패스": 17,
    "볼 컨트롤": 14,
    시야: 13,
    "긴 패스": 13,
    "반응 속도": 8,
    드리블: 7,
    "위치 선정": 6,
    스태미너: 6,
    태클: 5,
    가로채기: 5,
    "중거리 슛": 4,
    "골 결정력": 2,
  },
  CDM: {
    "짧은 패스": 14,
    가로채기: 14,
    태클: 12,
    "볼 컨트롤": 10,
    "긴 패스": 10,
    "대인 수비": 9,
    "반응 속도": 7,
    스태미너: 6,
    "슬라이딩 태클": 5,
    적극성: 5,
    시야: 4,
    몸싸움: 4,
  },
  CB: {
    태클: 17,
    "대인 수비": 14,
    가로채기: 13,
    "슬라이딩 태클": 10,
    헤더: 10,
    몸싸움: 10,
    적극성: 7,
    "반응 속도": 5,
    "짧은 패스": 5,
    "볼 컨트롤": 4,
    점프: 3,
    속력: 2,
  },
  RB: {
    "슬라이딩 태클": 14,
    가로채기: 12,
    태클: 11,
    크로스: 9,
    스태미너: 8,
    "반응 속도": 8,
    "대인 수비": 8,
    "짧은 패스": 7,
    "볼 컨트롤": 7,
    속력: 7,
    가속력: 5,
    헤더: 4,
  },
  LB: {
    "슬라이딩 태클": 14,
    가로채기: 12,
    태클: 11,
    크로스: 9,
    스태미너: 8,
    "반응 속도": 8,
    "대인 수비": 8,
    "짧은 패스": 7,
    "볼 컨트롤": 7,
    속력: 7,
    가속력: 5,
    헤더: 4,
  },
  GK: {
    "GK 다이빙": 21,
    "GK 핸들링": 21,
    "GK 위치 선정": 21,
    "GK 반응속도": 21,
    "반응 속도": 11,
    "GK 킥": 5,
  },
};

const ABILITY_NAMES = Array.from(
  new Set(Object.values(POSITION_WEIGHTS).flatMap((weights) => Object.keys(weights)))
).sort((a, b) => b.length - a.length);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSquadPosition(position: string) {
  const normalized = position.trim().toUpperCase();
  return POSITION_ALIASES[normalized] ?? normalized;
}

export function calculatePositionOvrFromAbilities(
  abilities: Record<string, number>,
  position: string
): number | null {
  const normalizedPosition = normalizeSquadPosition(position);
  const weights = POSITION_WEIGHTS[normalizedPosition];
  if (!weights) return null;

  let weightedTotal = 0;
  for (const [ability, weight] of Object.entries(weights)) {
    const value = abilities[ability];
    if (!Number.isFinite(value)) return null;
    weightedTotal += value * weight;
  }

  return Math.floor(weightedTotal / 100);
}

export function calculatePositionOvrFromText(text: string, position: string): number | null {
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
}
