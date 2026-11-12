"""
Simulation of the economy between AI agents: a "clearing house for agent work".

What it simulates (90 days, test money only):
  - PROVIDER agents (good, mediocre, scammers) that accept jobs
  - BUYER agents that post jobs with a budget
  - ESCROW: the money stays locked until the work is verified
  - 2-level VERIFICATION: automated check + buyer review
  - DISPUTES settled by an AI arbiter (a cost for the platform)
  - STAKE: the provider deposits it and loses part of it on bad deliveries
  - REPUTATION: buyers pick the providers with the best track record
  - Platform FEE withheld from the payment to the provider
  - NETTING: on-chain transactions are settled in one batch per day

Run:  python3 simulate.py
No external libraries: runs anywhere, zero cost.

WARNING: the assumptions in CONFIG are reasonable estimates, not real data.
They are meant to compare rules against each other, not to forecast revenue.
"""

import math
import random
import statistics
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# ASSUMPTIONS (all adjustable)
# --------------------------------------------------------------------------
CONFIG = {
    "days": 90,
    "initial_providers": 40,
    "buyers": 60,
    "jobs_per_buyer_per_day": 2.0,
    "median_job_value": 8.0,          # USDC
    "job_value_dispersion": 0.8,      # lognormal
    # provider types: (share, probability of delivering good work, cost as % of value)
    "types": {
        "good":     (0.55, 0.95, (0.30, 0.70)),
        "mediocre": (0.30, 0.70, (0.20, 0.60)),
        "scammer":  (0.15, 0.05, (0.02, 0.05)),
    },
    "auto_check_catch_rate": 0.60,    # % of bad jobs blocked automatically
    "buyer_catch_rate": 0.85,         # % of the remaining bad jobs the buyer disputes
    "arbiter_accuracy": 0.90,
    "ai_arbiter_cost": 0.03,          # USDC per dispute (one model call)
    "dispute_fee_min": 0.25,          # paid by whoever loses the dispute
    "dispute_fee_pct": 0.05,
    "gas_per_tx": 0.005,              # estimated cost of one transaction on Base
    "monthly_fixed_cost": 25.0,       # server + free-tier services
    "new_scammers_per_day": 0.5,      # entry attempts
    "new_honest_per_day": 0.3,
    "scammer_stake_sensitivity": 10.0,  # the lower it is, the more the stake deters them
    "honest_stake_sensitivity": 150.0,
    "buyer_churn_after_scam": 0.15,
    "days_to_assess_profit": 14,
    # EXTERNAL ALTERNATIVE: each buyer estimates the risk of getting scammed when paying
    # an agent directly (without the platform). It uses the platform only if the fee
    # costs less than that risk. In the "pay first" scenario the actual fraud rate is ~8%.
    "perceived_risk_min": 0.01,
    "perceived_risk_max": 0.12,
    # share of the forfeited stake that goes to the platform (the rest refunds the buyer).
    # Recommended 0: the platform must not profit from punishing, only from work that goes well.
    "platform_stake_share": 0.0,
    # UPDATED RULES
    "min_fee": 0.05,                  # USDC per job: covers verification and gas on small jobs
    "verification_cost": 0.01,        # USDC per automated check (rules + cheap AI model)
    "revision": True,                 # one free fix if the automated checks fail
    "revision_min_ok_jobs": 0,        # successful jobs required to qualify for the revision
    "fix_cost_pct": 0.3,              # what fixing costs the provider (% of its cost)
    "referral_job_share": 0.4,        # assumption: 40% of jobs come from agents brought in by referral
    "referral_share": 0.005,          # 0.5 fee points to whoever brought in the agent
}


@dataclass
class Provider:
    id: int
    type: str
    p_good: float
    cost_pct: float
    stake: float
    ok: int = 0
    ko: int = 0
    active: bool = True
    recent_profit: list = field(default_factory=list)

    def reputation(self) -> float:
        # Bayesian average: a new agent starts at 0.5
        return (self.ok + 1) / (self.ok + self.ko + 2)


@dataclass
class Buyer:
    id: int
    perceived_risk: float = 0.0
    active: bool = True


def new_provider(rnd, i, type_, stake):
    _, p, (cmin, cmax) = CONFIG["types"][type_]
    return Provider(i, type_, p, rnd.uniform(cmin, cmax), stake)


def pick_type(rnd):
    r, acc = rnd.random(), 0.0
    for type_, (share, _, _) in CONFIG["types"].items():
        acc += share
        if r <= acc:
            return type_
    return "good"


def simulate(fee: float, stake: float, escrow: bool = True, netting: bool = False, seed: int = 0):
    rnd = random.Random(seed)
    C = CONFIG
    providers = [new_provider(rnd, i, pick_type(rnd), stake) for i in range(C["initial_providers"])]
    buyers = [Buyer(i, rnd.uniform(C["perceived_risk_min"], C["perceived_risk_max"]))
              for i in range(C["buyers"])]

    m = dict(gmv=0.0, fee_revenue=0.0, dispute_revenue=0.0, stake_revenue=0.0,
             arbiter_costs=0.0, gas_costs=0.0, buyer_losses=0.0,
             jobs_posted=0, jobs_completed=0, jobs_without_provider=0,
             jobs_lost_to_fee=0, disputes=0, verification_costs=0.0, referral_costs=0.0,
             revisions=0, successful_revisions=0)

    for day in range(C["days"]):
        # new agents entering: the stake deters scammers above all
        if rnd.random() < C["new_scammers_per_day"] * math.exp(-stake / C["scammer_stake_sensitivity"]):
            providers.append(new_provider(rnd, len(providers), "scammer", stake))
        if rnd.random() < C["new_honest_per_day"] * math.exp(-stake / C["honest_stake_sensitivity"]):
            providers.append(new_provider(rnd, len(providers), rnd.choice(["good", "mediocre"]), stake))

        agents_active_today = set()
        for buyer in buyers:
            if not buyer.active:
                continue
            n_jobs = sum(1 for _ in range(4) if rnd.random() < C["jobs_per_buyer_per_day"] / 4)
            for _ in range(n_jobs):
                value = C["median_job_value"] * math.exp(rnd.gauss(0, C["job_value_dispersion"]))
                m["jobs_posted"] += 1
                # the buyer goes elsewhere if the fee costs more than the risk it avoids
                if escrow and fee > buyer.perceived_risk:
                    m["jobs_lost_to_fee"] += 1
                    continue
                fee_amount = max(value * fee, C["min_fee"]) if escrow else value * fee
                from_referral = rnd.random() < C["referral_job_share"]
                # only providers who still profit after the fee accept
                candidates = [p for p in providers if p.active and value - fee_amount > value * p.cost_pct]
                if not candidates:
                    m["jobs_without_provider"] += 1
                    continue
                # choice by reputation, with some exploration for newcomers
                weights = [math.exp(8 * p.reputation()) for p in candidates]
                f = rnd.choices(candidates, weights=weights)[0]
                agents_active_today.update({("b", buyer.id), ("p", f.id)})

                good = rnd.random() < f.p_good
                provider_cost = value * f.cost_pct

                if not escrow:
                    # "pay first" model (plain x402): no protection
                    m["gmv"] += value
                    m["fee_revenue"] += fee_amount
                    m["jobs_completed"] += 1
                    f.recent_profit.append(value - fee_amount - provider_cost)
                    if good:
                        f.ok += 1
                    else:
                        f.ko += 1
                        m["buyer_losses"] += value
                        if rnd.random() < C["buyer_churn_after_scam"]:
                            buyer.active = False
                    continue

                # --- with escrow ---
                m["verification_costs"] += C["verification_cost"]

                def arbitration():
                    """Dispute decided by the AI arbiter. True = the buyer wins."""
                    m["disputes"] += 1
                    m["arbiter_costs"] += C["ai_arbiter_cost"]
                    if rnd.random() < C["arbiter_accuracy"]:
                        dispute_fee = max(C["dispute_fee_min"], value * C["dispute_fee_pct"])
                        m["dispute_revenue"] += dispute_fee
                        f.recent_profit.append(-dispute_fee)
                        return True
                    return False

                blocked = False
                if not good:
                    if rnd.random() < C["auto_check_catch_rate"]:
                        if C["revision"] and f.ok >= C["revision_min_ok_jobs"]:
                            # FREE REVISION: the provider fixes the work once,
                            # the platform pays for the second check
                            m["revisions"] += 1
                            m["verification_costs"] += C["verification_cost"]
                            provider_cost += value * f.cost_pct * C["fix_cost_pct"]
                            good = rnd.random() < f.p_good
                            if good:
                                m["successful_revisions"] += 1
                            elif rnd.random() < C["auto_check_catch_rate"]:
                                blocked = arbitration()
                            elif rnd.random() < C["buyer_catch_rate"]:
                                blocked = arbitration()
                        else:
                            blocked = True
                    elif rnd.random() < C["buyer_catch_rate"]:
                        blocked = arbitration()
                if blocked:
                    f.ko += 1
                    f.recent_profit.append(-provider_cost)
                    # stake: the provider loses the equivalent of the job value (extra refund to the buyer)
                    cut = min(f.stake, value)
                    f.stake -= cut
                    f.recent_profit.append(-cut)
                    m["stake_revenue"] += cut * C["platform_stake_share"]
                    if stake > 0 and f.stake < stake * 0.5:
                        # below half the stake: honest providers top up, scammers disappear
                        if f.type == "scammer":
                            f.active = False
                        else:
                            f.stake = stake
                    if not netting:
                        m["gas_costs"] += 2 * C["gas_per_tx"]
                    continue

                # payment released
                m["gmv"] += value
                m["fee_revenue"] += fee_amount
                if from_referral:
                    m["referral_costs"] += value * C["referral_share"]
                m["jobs_completed"] += 1
                f.recent_profit.append(value - fee_amount - provider_cost)
                if good:
                    f.ok += 1
                else:
                    f.ko += 1  # bad but it got through: a loss for the buyer
                    m["buyer_losses"] += value
                    if rnd.random() < C["buyer_churn_after_scam"]:
                        buyer.active = False
                if not netting:
                    m["gas_costs"] += 2 * C["gas_per_tx"]

        if netting:
            # a single settlement per day for each agent that worked
            m["gas_costs"] += len(agents_active_today) * C["gas_per_tx"]

        # honest providers that do not make money drop out
        if day % C["days_to_assess_profit"] == C["days_to_assess_profit"] - 1:
            for f in providers:
                if f.active and f.recent_profit and sum(f.recent_profit) <= 0 and f.type != "scammer":
                    f.active = False
                f.recent_profit = []

    months = C["days"] / 30
    m["fixed_costs"] = C["monthly_fixed_cost"] * months
    m["total_revenue"] = m["fee_revenue"] + m["dispute_revenue"] + m["stake_revenue"]
    variable_costs = m["arbiter_costs"] + m["gas_costs"] + m["verification_costs"] + m["referral_costs"]
    m["net_profit"] = m["total_revenue"] - variable_costs - m["fixed_costs"]
    m["monthly_profit"] = m["net_profit"] / months
    m["losses_pct_gmv"] = 100 * m["buyer_losses"] / m["gmv"] if m["gmv"] else 0
    m["completion_rate"] = 100 * m["jobs_completed"] / m["jobs_posted"]
    m["lost_to_fee_pct"] = 100 * m["jobs_lost_to_fee"] / m["jobs_posted"]
    m["stake_revenue_share"] = 100 * m["stake_revenue"] / m["total_revenue"] if m["total_revenue"] else 0
    m["active_honest"] = sum(1 for f in providers if f.active and f.type != "scammer")
    m["active_scammers"] = sum(1 for f in providers if f.active and f.type == "scammer")
    m["active_buyers"] = sum(1 for b in buyers if b.active)
    m["margin_per_job"] = (m["total_revenue"] - variable_costs) / max(1, m["jobs_completed"])
    return m


def mean(fee, stake, escrow=True, netting=False, seeds=8):
    results = [simulate(fee, stake, escrow, netting, seed=s) for s in range(seeds)]
    return {k: statistics.mean(r[k] for r in results) for k in results[0]}


def print_row(name, r):
    print(f"{name:<26} GMV {r['gmv']:>8.0f}  profit/month {r['monthly_profit']:>7.1f}  "
          f"margin/job {r['margin_per_job']:>5.3f}  losses {r['losses_pct_gmv']:>5.1f}%  "
          f"completed {r['completion_rate']:>5.1f}%  lost to fee {r['lost_to_fee_pct']:>5.1f}%  "
          f"from stakes {r['stake_revenue_share']:>4.1f}%  buyers {r['active_buyers']:>4.1f}  "
          f"honest {r['active_honest']:>4.1f}  scammers {r['active_scammers']:>4.1f}")


def with_config(key, value, fn):
    """Runs fn with one CONFIG assumption temporarily changed."""
    old = CONFIG[key]
    CONFIG[key] = value
    try:
        return fn()
    finally:
        CONFIG[key] = old


if __name__ == "__main__":
    FEE, STAKE = 0.025, 5   # launch rules

    print("=== 1. Escrow vs 'pay first' (fee 2.5%) ===")
    print_row("Pay first (plain x402)", mean(FEE, 0, escrow=False))
    print_row("Escrow, no stake", mean(FEE, 0))
    print_row("Escrow + stake 5", mean(FEE, 5))
    print_row("Escrow + stake 20", mean(FEE, 20))

    print("\n=== 2. Free revision (fee 2.5%, stake 5) ===")
    no_revision = with_config("revision", False, lambda: mean(FEE, STAKE))
    print_row("No revision", no_revision)
    base = mean(FEE, STAKE)
    print_row("With free revision", base)
    print_row("Revision after 10 ok jobs", with_config("revision_min_ok_jobs", 10, lambda: mean(FEE, STAKE)))
    print(f"   revisions per month: {base['revisions']/3:.0f}, successful: {100*base['successful_revisions']/max(1,base['revisions']):.0f}%, "
          f"verification cost per month: {base['verification_costs']/3:.1f} USDC")

    print("\n=== 3. Referral (fee 2.5%, stake 5) ===")
    print_row("No referral jobs", with_config("referral_job_share", 0.0, lambda: mean(FEE, STAKE)))
    print_row("40% from referral", base)
    print_row("100% from referral", with_config("referral_job_share", 1.0, lambda: mean(FEE, STAKE)))

    print("\n=== 4. Netting (fee 2.5%, stake 5) ===")
    print_row("No netting", base)
    print_row("With netting", mean(FEE, STAKE, netting=True))

    print("\n=== 5. Fee level (stake 5, current rules) ===")
    grid = []
    for fee in [0.005, 0.01, 0.02, 0.025, 0.03, 0.04, 0.05, 0.08]:
        r = mean(fee, STAKE)
        grid.append((fee, r))
        print_row(f"fee {fee*100:.1f}%", r)

    print("\n=== 6. Variable costs per job and sustainability of discounts ===")
    var_cost = (base["arbiter_costs"] + base["gas_costs"] + base["verification_costs"]) / base["jobs_completed"]
    avg_value = base["gmv"] / base["jobs_completed"]
    print(f"   average job value {avg_value:.2f} USDC, average variable cost {var_cost:.3f} USDC per job")
    for discounted_fee in [0.025, 0.02, 0.015]:
        net = avg_value * (discounted_fee - CONFIG["referral_share"]) - var_cost
        print(f"   fee {discounted_fee*100:.1f}% with referral active -> average margin {net:.3f} USDC per job")

    print("\n=== 7. Launch configuration and scale ===")
    r = base
    print(f"fee 2.5%, stake 5 -> profit {r['monthly_profit']:.0f} USDC/month, margin {r['margin_per_job']:.3f} USDC/job, "
          f"jobs lost to fee {r['lost_to_fee_pct']:.0f}%, buyer losses {r['losses_pct_gmv']:.1f}%")
    for jobs_per_day in [100, 300, 1_000, 10_000]:
        profit = jobs_per_day * 30 * r["margin_per_job"] - CONFIG["monthly_fixed_cost"]
        print(f"{jobs_per_day:>7} completed jobs/day -> ~{profit:>9,.0f} USDC/month")
