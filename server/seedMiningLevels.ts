import { MiningLevelModel } from './models/MiningLevel.js';
import { SystemSettingsModel } from './models/index.js';
import { isMongoConnected } from './mongoose.js';
import { MinerTier } from '../src/types.js';

/**
 * 50 Thematic Mining Rig names for dynamic fleet progression
 */
export const RIG_THEMES = [
  'Base Micro Rig (Free)', 'Cyber Rig', 'Quantum Cell', 'Fusion Node', 'Hyper Reactor',
  'Orbital Node', 'Stellar Array', 'Singularity Core', 'Pulse Condenser', 'Neutron Forge',
  'Plasma Array', 'Vortex Accelerator', 'Titan Harvester', 'Nova Conduit', 'Dark Matter Siphon',
  'Photon Lattice', 'Ion Thruster Rig', 'Flux Dynamo', 'Apex Matrix', 'Helios Foundry',
  'Chronos Engine', 'Astral Beacon', 'Cosmic Dynamo', 'Supercluster Node', 'Quasar Pump',
  'Galactic Core', 'Hyperdrive Miner', 'Nebula Condenser', 'Antimatter Splicer', 'Exo Dynamo',
  'Zero-Point Field', 'Tachyon Emitter', 'Singularity Sieve', 'Wormhole Tapper', 'Aether Collector',
  'Dimensional Rift Rig', 'Omega Synthesizer', 'Infinity Lattice', 'Zenith Reactor', 'Solaris Foundry',
  'Genesis Crucible', 'Eclipse Siphon', 'Pulsar Extractor', 'Kevlar Dynamo', 'Horizon Harvester',
  'Radiant Accelerator', 'Titanium Vanguard', 'Ultimate Stratum', 'Ascendant Core', 'Quantum Singularity Apex'
];

/**
 * Generates all 50 Mining Levels based on linear growth logic:
 * Level 1: Speed = 0.20 POP/h | Cost = 0 POP (FREE BASE)
 * Level 2: Speed = 0.24 POP/h | Cost = 130 POP
 * Level 50: Speed = 1.99 POP/h | Cost = 1130 POP
 * Levels 3 to 49:
 *   - Speed Increment per level = (1.99 - 0.24) / 48 ≈ +0.0365 POP/h
 *   - Cost Increment per level = (1130 - 130) / 48 ≈ +20.83 POP
 *   - Speeds rounded to 2 decimal places, costs rounded to nearest integer
 */
export function generateDefaultMiningLevels(popUsdRate: number = 0.001): MinerTier[] {
  const levels: MinerTier[] = [];
  const speedStep = (1.99 - 0.24) / 48; // ~0.036458333333333336 POP/h
  const costStep = (1130 - 130) / 48;   // ~20.833333333333332 POP

  for (let lvl = 1; lvl <= 50; lvl++) {
    const themeName = RIG_THEMES[lvl - 1] || `Rig Mark ${lvl}`;
    const name = `Level ${lvl}: ${themeName}`;

    if (lvl === 1) {
      levels.push({
        level: 1,
        name: 'Level 1: Base Micro Rig (Free)',
        speedPerHour: 0.20,
        pricePOP: 0,
        priceUSD: 0.00,
      });
    } else if (lvl === 2) {
      levels.push({
        level: 2,
        name: 'Level 2: Cyber Rig',
        speedPerHour: 0.24,
        pricePOP: 130,
        priceUSD: Number((130 * popUsdRate).toFixed(2)),
      });
    } else if (lvl === 50) {
      levels.push({
        level: 50,
        name: 'Level 50: Quantum Singularity Apex',
        speedPerHour: 1.99,
        pricePOP: 1130,
        priceUSD: Number((1130 * popUsdRate).toFixed(2)),
      });
    } else {
      const stepIndex = lvl - 2; // 1 for lvl 3, up to 47 for lvl 49
      const calculatedSpeed = 0.24 + stepIndex * speedStep;
      const speedPerHour = Number(calculatedSpeed.toFixed(2));
      const calculatedCost = 130 + stepIndex * costStep;
      const pricePOP = Math.round(calculatedCost);
      const priceUSD = Number((pricePOP * popUsdRate).toFixed(2));

      levels.push({
        level: lvl,
        name,
        speedPerHour,
        pricePOP,
        priceUSD,
      });
    }
  }

  return levels;
}

/**
 * Seeds or updates all 50 mining levels in MongoDB Atlas
 */
export async function seedMiningLevelsToMongo(force: boolean = false): Promise<MinerTier[]> {
  const defaultLevels = generateDefaultMiningLevels();

  if (!isMongoConnected()) {
    console.log('[Mining Levels Seed] MongoDB not currently connected; returning generated default 50 tiers');
    return defaultLevels;
  }

  try {
    const existingCount = await MiningLevelModel.countDocuments();
    console.log(`[Mining Levels Seed] Existing levels count in MongoDB: ${existingCount}`);

    if (existingCount < 50 || force) {
      console.log(`[Mining Levels Seed] Seeding / refreshing full 50 levels into MongoDB Atlas... (force=${force})`);

      const operations = defaultLevels.map((lvl) => ({
        updateOne: {
          filter: { level: lvl.level },
          update: {
            $set: {
              level: lvl.level,
              name: lvl.name,
              speedPerHour: lvl.speedPerHour,
              pricePOP: lvl.pricePOP,
              priceUSD: lvl.priceUSD,
              description: `Autonomous POP miner fleet unit level ${lvl.level}`,
              isActive: true,
            },
          },
          upsert: true,
        },
      }));

      await MiningLevelModel.bulkWrite(operations);
      console.log('[Mining Levels Seed] Successfully seeded 50 Mining Levels into MongoDB Atlas!');

      // Also sync to SystemSettingsModel.miner_tiers for backward-compatibility
      await SystemSettingsModel.findOneAndUpdate(
        { key: 'admin_config' },
        { $set: { miner_tiers: defaultLevels } },
        { upsert: true }
      ).catch((err) => console.warn('[Mining Levels Seed] Could not sync system settings miner_tiers:', err?.message));
    }

    // Load active levels sorted by level asc
    const docs = await MiningLevelModel.find({ isActive: true }).sort({ level: 1 }).lean();
    if (docs.length >= 50) {
      return docs.map((d: any) => ({
        level: d.level,
        name: d.name,
        speedPerHour: d.speedPerHour,
        pricePOP: d.pricePOP,
        priceUSD: d.priceUSD,
      }));
    }
  } catch (err: any) {
    console.warn('[Mining Levels Seed] MongoDB seeding error:', err?.message || err);
  }

  return defaultLevels;
}
