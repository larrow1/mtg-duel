export interface ClientCard {
  name: string;
  manaCost: string | null;
  typeLine: string;
  colorIdentity: string[];
  imageSmall: string;
  imageNormal: string;
  powerTier: 'S' | 'A' | 'B' | 'C' | 'D';
  archetypes: string[];
  isSignpost: boolean;
  signpostFor: string[];
}

export interface CubeMeta {
  cubeId: string;
  cubeName: string;
  fetchedAt: string;
  cardCount: number;
  hasProfiles: boolean;
  profileCount: number;
}

export type ArchetypeSignposts = Record<string, string[]>;

export interface Divergence {
  packNum: number;
  pickNum: number;
  recommended: string;
  chosen: string;
  recommendedArchetypes: string[];
  chosenArchetypes: string[];
}

export interface DraftHistoryEntry {
  packNum: 1 | 2 | 3;
  pickNum: number;
  pickedName: string;
  passedNames: string[];
}

export interface DraftSession {
  pool: string[];
  seenAndPassed: string[];
  history: DraftHistoryEntry[];
  packNum: 1 | 2 | 3;
  pickNum: number;
  currentPack: string[];
  divergences: Divergence[];
}

export interface ScoreBreakdown {
  power: number;
  synergy: number;
  archetypeOpenness: number;
  speculation: number;
}

export interface Recommendation {
  cardName: string;
  score: number;
  breakdown: ScoreBreakdown;
  topArchetypes: string[];
}

export interface ArchetypeSignal {
  archetypeId: string;
  openness: number;
  commitment: number;
}

export interface ConsultantOutput {
  pickName: string;
  rationale: string;
  archetypeDirection: string | null;
}

export interface RecommendApiResponse {
  ranked: Recommendation[];
  consultant: ConsultantOutput | null;
  signals: ArchetypeSignal[];
  missing?: { pool: string[]; seenAndPassed: string[]; pack: string[] };
}
