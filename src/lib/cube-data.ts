import 'server-only';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Card, CardProfile, CardWithProfile, CubeData, ProfileData } from './types';

let cachedCube: CubeData | null = null;
let cachedProfiles: ProfileData | null = null;
let cachedJoined: CardWithProfile[] | null = null;
let cachedByName: Map<string, CardWithProfile> | null = null;

const fallbackProfile = (name: string): CardProfile => ({
  name,
  archetypes: [],
  isSignpost: false,
  signpostFor: [],
  synergyPartners: [],
  powerTier: 'B',
});

async function loadCube(): Promise<CubeData> {
  if (cachedCube) return cachedCube;
  const path = join(process.cwd(), 'data', 'cube.json');
  if (!existsSync(path)) {
    throw new Error('data/cube.json missing. Run `npm run ingest:cube`.');
  }
  cachedCube = JSON.parse(await readFile(path, 'utf-8')) as CubeData;
  return cachedCube;
}

async function loadProfiles(): Promise<ProfileData | null> {
  if (cachedProfiles) return cachedProfiles;
  const path = join(process.cwd(), 'data', 'profiles.json');
  if (!existsSync(path)) return null;
  cachedProfiles = JSON.parse(await readFile(path, 'utf-8')) as ProfileData;
  return cachedProfiles;
}

export async function getCube(): Promise<CardWithProfile[]> {
  if (cachedJoined) return cachedJoined;
  const [cube, profiles] = await Promise.all([loadCube(), loadProfiles()]);
  cachedJoined = cube.cards.map((c: Card) => ({
    ...c,
    profile: profiles?.profiles[c.name] ?? fallbackProfile(c.name),
  }));
  cachedByName = new Map(cachedJoined.map((c) => [c.name, c]));
  return cachedJoined;
}

export async function getCubeByName(): Promise<Map<string, CardWithProfile>> {
  if (cachedByName) return cachedByName;
  await getCube();
  return cachedByName!;
}

export async function getCubeMeta() {
  const cube = await loadCube();
  const profiles = await loadProfiles();
  return {
    ...cube.meta,
    hasProfiles: !!profiles,
    profileCount: profiles ? Object.keys(profiles.profiles).length : 0,
  };
}
