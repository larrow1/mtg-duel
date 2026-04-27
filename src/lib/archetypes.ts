export interface ArchetypeDef {
  id: string;
  name: string;
  colors: string[];
  description: string;
}

export const ARCHETYPES: ArchetypeDef[] = [
  // Aggro
  { id: 'mono-white-aggro', name: 'Mono-White Aggro', colors: ['W'], description: 'White weenie / death and taxes; efficient creatures + tax effects.' },
  { id: 'mono-red-aggro', name: 'Mono-Red Aggro / Burn', colors: ['R'], description: 'Cheap creatures and burn; close before opponents stabilize.' },
  { id: 'rw-aggro', name: 'Boros Aggro', colors: ['R', 'W'], description: 'Efficient creatures with white tokens/removal and red burn.' },
  { id: 'rg-stompy', name: 'Gruul Stompy', colors: ['R', 'G'], description: 'Mana ramp into large green threats with red removal/burn.' },
  { id: 'wg-tokens', name: 'Selesnya Tokens', colors: ['W', 'G'], description: 'Token producers with anthem effects.' },

  // Tempo
  { id: 'ur-tempo', name: 'Izzet Tempo', colors: ['U', 'R'], description: 'Cheap evasive threats backed by countermagic and burn.' },
  { id: 'wu-tempo', name: 'Azorius Tempo', colors: ['W', 'U'], description: 'Flyers + countermagic + bounce.' },

  // Control
  { id: 'wu-control', name: 'Azorius Control', colors: ['W', 'U'], description: 'Counters, wraths, and finishers.' },
  { id: 'esper-control', name: 'Esper Control', colors: ['W', 'U', 'B'], description: 'WU control with black removal and finishers.' },
  { id: 'grixis-control', name: 'Grixis Control', colors: ['U', 'B', 'R'], description: 'Removal-heavy control with black/red kills + blue counters.' },

  // Midrange / value
  { id: 'bg-midrange', name: 'Golgari Midrange', colors: ['B', 'G'], description: 'Value creatures, ramp, removal.' },
  { id: 'jund', name: 'Jund Midrange', colors: ['B', 'R', 'G'], description: 'Value creatures, removal, planeswalkers.' },
  { id: 'sultai', name: 'Sultai Value', colors: ['U', 'B', 'G'], description: 'Reanimation/value engines with green ramp and blue draw.' },
  { id: 'rakdos-aggro', name: 'Rakdos Aggro', colors: ['B', 'R'], description: 'Aggressive black/red creatures with disruption and burn.' },

  // Strategies (cross-color)
  { id: 'reanimator', name: 'Reanimator', colors: ['U', 'B'], description: 'Discard a fatty, return it from the graveyard.' },
  { id: 'sneak-show', name: 'Sneak and Show', colors: ['U', 'R'], description: 'Cheat fatties into play (Sneak Attack, Show and Tell).' },
  { id: 'storm', name: 'Storm', colors: ['U', 'R', 'B'], description: 'Cast many spells in a turn for a lethal payoff.' },
  { id: 'artifacts', name: 'Artifact Combo / Welder', colors: ['B', 'R'], description: 'Artifact synergies (Welder, Tinker, fast mana, Affinity).' },
  { id: 'ramp', name: 'Green Ramp', colors: ['G'], description: 'Mana acceleration into Eldrazi/large finishers.' },
  { id: 'tinker-combo', name: 'Tinker Combo', colors: ['U'], description: "Tinker for Blightsteel / Bolas's Citadel / Sundering Titan." },
  { id: 'twin-kiki', name: 'Splinter Twin / Kiki Combo', colors: ['U', 'R', 'W'], description: 'Pestermite/Restoration Angel + Twin/Kiki for infinite tokens.' },
  { id: 'lands', name: 'Lands', colors: ['G'], description: 'Land-recursion combos (Dark Depths, Crucible, Loam).' },
  { id: 'stax', name: 'Stax / Prison', colors: ['W', 'B'], description: 'Resource denial (Smokestack, Tangle Wire, sphere effects).' },
  { id: 'dredge', name: 'Dredge', colors: ['B', 'G'], description: 'Self-mill and graveyard payoffs.' },
];

export const ARCHETYPE_BY_ID: Record<string, ArchetypeDef> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);

export const ARCHETYPE_IDS: ReadonlySet<string> = new Set(ARCHETYPES.map((a) => a.id));
