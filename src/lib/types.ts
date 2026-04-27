export interface Card {
  scryfallId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
  typeLine: string;
  oracleText: string;
  imageSmall: string;
  imageNormal: string;
}

export type ArchetypeId = string;

export type PowerTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CardProfile {
  name: string;
  archetypes: ArchetypeId[];
  isSignpost: boolean;
  signpostFor: ArchetypeId[];
  synergyPartners: string[];
  powerTier: PowerTier;
  notes?: string;
}

export interface CardWithProfile extends Card {
  profile: CardProfile;
}

export interface CubeData {
  cards: Card[];
  meta: {
    cubeId: string;
    cubeName: string;
    fetchedAt: string;
    cardCount: number;
  };
}

export interface ProfileData {
  profiles: Record<string, CardProfile>;
  meta: {
    generatedAt: string;
    model: string;
    cubeId: string;
  };
}

export interface DraftPick {
  packNum: 1 | 2 | 3;
  pickNum: number;
  pickedName: string;
  passedNames: string[];
}

export interface DraftState {
  pool: string[];
  seenAndPassed: string[];
  history: DraftPick[];
  currentPack: 1 | 2 | 3;
  currentPick: number;
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
  topArchetypes: ArchetypeId[];
}

export interface ArchetypeSignal {
  archetypeId: ArchetypeId;
  openness: number;
  commitment: number;
}

export interface ConsultantOutput {
  pickName: string;
  rationale: string;
  archetypeDirection: ArchetypeId | null;
}

export interface RecommendResponse {
  ranked: Recommendation[];
  consultant: ConsultantOutput | null;
  signals: ArchetypeSignal[];
}

export interface Divergence {
  packNum: number;
  pickNum: number;
  recommended: string;
  chosen: string;
  recommendedArchetypes: string[];
  chosenArchetypes: string[];
}
