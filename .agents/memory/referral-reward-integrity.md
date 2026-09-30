---
name: Referral reward integrity
description: Referral qualification, mining commission, leaderboard, and reconciliation paths must remain payout-authoritative.
---

Use the admin-configured qualification bonus only when a qualification payout is atomically awarded, and calculate mining commission as `(mined amount * commission rate) / 100`. Leaderboards should sum recorded qualification payouts rather than multiplying referral counts by a setting.

**Why:** Synthetic count-based totals and reconciliation that marks a bonus claimed without credit can overpay, misreport earnings, or prevent the real payout path from running.

**How to apply:** Keep qualification payout state and mining commission state separate; missing settings resolve to zero; Mongo reconciliation may synchronize qualification status but must not invent or claim rewards.