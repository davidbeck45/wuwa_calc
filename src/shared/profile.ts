/**
 * Wuthering Tools+ (fork `plus`): the enemy a run fights, set from outside around a run — one floor of the
 * Tower of Adversity, say. Unset (null, the default) a run is exactly the engine's own: a level-100 enemy with
 * 20% resistance to every attribute and nothing equipped on it beside the Tune Break machinery.
 *
 *   level      the enemy's level — its DEF, `792 + 8 x level` (state.ts `enemyDef()`)
 *   res        its resistance per attribute in %, missing ones 20 — equipped as one more Gear of RES entries on
 *              top of the Base Resistance (tunebreak.ts), one Gear per distinct table: the engine caches a slot's
 *              constant stats across runs by Gear id (evaluate.ts `ROSTERS`), so a Gear's figures never change
 *   enemyGear  more Gear equipped onto the enemy beside the Tune Break resonator (a floor's debuffs)
 *   teamGear   Gear equipped onto every member as they are built (a floor's buffs and its on-cast grants)
 *
 * Set it, run, set it back to null. A solve's caches (solver.ts `trialCache`, `bases`) never key on it, so a
 * caller solves unprofiled and only runs a fixed combo against a profile.
 */
import { Gear } from "../engine/gear.js";
import { addEnemyStat } from "../engine/context.js";
import { setEnemyLevel } from "../engine/state.js";
import { Attribute, EnemyStat } from "../engine/stats.js";

export type ResAttribute = "Aero" | "Electro" | "Fusion" | "Glacio" | "Spectro" | "Havoc" | "Physical";

export interface EnemyProfile {
  level?: number;
  res?: Partial<Record<ResAttribute, number>>;
  enemyGear?: Gear[];
  teamGear?: Gear[];
}

/** The engine's own enemy resistance, every attribute (tunebreak.ts `BASE_RESISTANCE`). */
const BASE_RES = 20;
const ATTRIBUTES: ReadonlyArray<[ResAttribute, Attribute]> = [
  ["Aero", Attribute.Aero], ["Electro", Attribute.Electro], ["Fusion", Attribute.Fusion], ["Glacio", Attribute.Glacio],
  ["Spectro", Attribute.Spectro], ["Havoc", Attribute.Havoc], ["Physical", Attribute.Physical],
];

let profile: EnemyProfile | null = null;
let resGear: Gear | null = null;
const RES_GEARS = new Map<string, Gear>();

/** The resistance table as a Gear: the difference from the Base Resistance's 20, per attribute. */
function resistanceGear(res: Partial<Record<ResAttribute, number>>): Gear | null {
  const lines = ATTRIBUTES.map(([name, attribute]) => [attribute, BASE_RES - (res[name] ?? BASE_RES)] as const).filter(([, v]) => v !== 0);
  if (!lines.length) return null;
  const sig = lines.map(([a, v]) => `${a}:${v}`).join(",");
  let gear = RES_GEARS.get(sig);
  if (!gear) {
    gear = new Gear({ name: "Enemy Resistance", constantStats: () => { for (const [a, v] of lines) addEnemyStat(EnemyStat.ResReduce, v, a); } });
    RES_GEARS.set(sig, gear);
  }
  return gear;
}

export function setEnemyProfile(next: EnemyProfile | null): void {
  profile = next;
  resGear = next?.res ? resistanceGear(next.res) : null;
  setEnemyLevel(next?.level ?? null);
}

export const enemyProfile = (): EnemyProfile | null => profile;

/** What teamrun.ts equips onto the enemy after the Tune Break resonator. */
export function profileEnemyGear(): Gear[] {
  if (!profile) return [];
  return resGear ? [resGear, ...(profile.enemyGear ?? [])] : (profile.enemyGear ?? []);
}

/** What teamrun.ts equips onto every member after their own pieces. */
export const profileTeamGear = (): Gear[] => profile?.teamGear ?? [];
