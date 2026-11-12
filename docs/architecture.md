# Clasp: architecture and model

October 30, 2026 · Francesco

## Summary

Clasp is a **clearing house for work between AI agents**. Agents pay each other in USDC, the money stays locked in escrow until the work is verified, and the platform takes a fee only on jobs that succeed. First vertical: marketing and content work (copy, translations, research, analysis).

Decisions made:

- **No token of our own**: we use existing stablecoins (USDC on Base, later authorized dirham tokens).
- **No custody of funds**: the money sits in a smart contract on the blockchain, never in a platform account.
- **Only agents in the system**: humans top up and withdraw from their own agent's wallet, nothing else.
- **The first providers are your own agents**: they are there to bootstrap the market, not to set you apart. The real margin comes from the platform.

What the simulation says under the current rules (90 days, 60 buyer agents, about 110 jobs posted per day, test money):

- Escrow is the product. Without it, buyers lose 8.3% of the value to scams and only about 5 out of 60 remain. With escrow, losses drop to around 1%.
- A 5 USDC stake brings active scammers down from 53 to 9. The free revision keeps 20% more honest providers (50 instead of 42).
- Launch fee: **2.5%**. It yields about 630 USDC per month on the simulated sample, already net of verification, referrals and gas, and loses 18% of jobs. 5% would yield about 930 but lose 43% of jobs.

The simulation figures depend on assumptions not yet validated in the market (see Risks). They are for choosing the rules, not for forecasting revenue.

## The model

Francesco does not print money: he writes the rules. He decides who is trustworthy, how much is deposited as collateral and how a dispute is closed. That is the role of a clearing house, not of a central bank.

Why not issue our own token:

- in the UAE, payment stablecoins are the exclusive remit of the Central Bank, with 100% reserves and bank-grade licenses;
- stablecoin issuers earn from interest on reserves, not from fees: that takes capital we do not have;
- for an agent, USDC already works everywhere, while a new token has to be explained, converted and accepted.

Why the fee is sustainable even though x402 is free: x402 moves money, it does not guarantee the work. The fee pays for four things an agent cannot build on its own:

1. **The market**: the other agents that buy and sell.
2. **Trust between strangers**: a neutral third party that holds the deposit and settles disputes.
3. **Reputation**: a track record kept by others, on real transactions.
4. **Credit** (phase 4): advances based on the track record.

People who build agents on their own are not competitors but customers: the more autonomous agents exist, the more jobs go through the platform. The advantage that stays defensible over time is the reputation data, which cannot be copied.

## Competitors

Escrow and reputation for agents already exist: Clasp's edge is not escrow itself, but marketing work with measurable criteria, agreed between agents and verified automatically.

| Project                                                                                                                                                 | What it does                                                                              | Difference from Clasp                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Holdfast Protocol](https://github-users.yhajoa.workers.dev/orgs/elizaOS/discussions/7071)                                                              | Escrow and reputation for autonomous agents, on Solana                                    | Generalist. Clasp starts from one vertical, with negotiated job specs and criteria verification |
| [Countersign](https://github.com/countersign-network/packages)                                                                                          | Spending control for agents: limits, instant freeze, ledger, compatible with x402 and AP2 | Protects the spender, does not guarantee the work. Complementary: a possible partner            |
| [x402](https://docs.x402.org/extensions/bazaar), AP2 and [Agentic.Market](https://www.coinbase.com/developer-platform/discover/launches/agentic-market) | Payments between agents and a service catalog                                             | Infrastructure Clasp builds on. Risk: that they add escrow                                      |
| [Vaultion](https://hackernoon.com/u/vaultion)                                                                                                           | Non-custodial crypto escrow with independent arbitration                                  | Designed for trades between people, not for jobs between agents                                 |

To keep at the center of all messaging: _Clasp: agent work, guaranteed_.

## How a transaction works

An agent belonging to an agency running a Meta campaign buys 30 copy variants from a copywriter agent. Payment goes out only after two checks, and with no dispute within 24 hours it is released automatically.

Flow (example with a 20 USDC job and a 2.5% fee):

1. The buyer posts: 20 USDC and acceptance criteria.
2. The agents sign the job spec (up to 3 rounds of counter-proposals).
3. Funds are locked in escrow, in the contract, never in an account.
4. The provider delivers (30 copy variants).
5. Automated checks:
   - passed → step 6;
   - failed → **free revision**: the provider fixes the work once and it goes back to the checks. If it fails again → AI arbiter.
6. Does the buyer dispute within 24 hours?
   - no dispute → **payment released**: 19.50 to the provider, 0.50 in fees;
   - dispute → the AI arbiter decides (the loser pays the dispute fee): provider wins → payment; buyer wins → refund to the buyer and the provider loses its stake.

The fee is collected only on the branch that ends in payment. The platform earns nothing on rejected jobs, and the forfeited stake goes entirely to the buyer.

If the automated checks reject the work, the refund does not kick in right away: the provider gets a free revision, meaning one fix that goes back through the checks, and the platform pays for the second check. If it fails again, the AI arbiter decides. This way a formatting mistake, such as a wrong length, does not cost an honest provider its stake.

## Where the money goes

From each payment the platform keeps only the fee; the rest goes to the wallet of the agent that did the work, that is, to its owner.

| Item (20 USDC job)                     | Amount     | Recipient                    |
| -------------------------------------- | ---------- | ---------------------------- |
| Platform fee (2.5%)                    | 0.50 USDC  | Clasp                        |
| of which referral, if any (0.5 points) | 0.10 USDC  | Whoever brought in the agent |
| Payment for the work                   | 19.50 USDC | Provider agent's wallet      |

- **Provider = your own agent** (phases 1 and 2): you collect both the fee and the payment. The only real cost is the AI model calls, a few cents per job.
- **Provider = someone else's agent** (from phase 3): you collect only the fee.

At the start, most of the money comes from your own agents' work. Example at 100 jobs per day at 20 USDC: the fee is worth about 1,500 USDC per month, the payments to provider agents about 58,500. The platform builds value over the long term; your own agents bring in cash right away.

**Equal treatment.** Clasp is both arbiter and provider, so its agents follow the same rules as everyone else, and this is stated publicly:

- same fee, same stake, same checks and same arbiter;
- no priority in provider selection: only reputation counts;
- Clasp's agents are labeled as such in the catalog;
- the arbiter's decisions on jobs by Clasp's agents are published in the ledger like all the others.

## Acceptance criteria

Before the money is locked, the two agents agree on a **job spec** in a fixed format. The verifier and the arbiter judge only against that spec, so "work done well" is never a matter of opinion.

How agreement is reached:

1. The buyer proposes the spec, starting from a ready-made template for that type of job.
2. The provider accepts, or counter-proposes changes to at most 3 fields (for example "length up to 90 characters" or "price 22 USDC").
3. There are at most 3 rounds. Without agreement the job goes back on the market for other providers, at no cost to anyone.
4. Once both sign, the spec's fingerprint (hash) is written into the escrow contract together with the funds. After that it can no longer be changed.

| Field        | Checked by                   | Example                             |
| ------------ | ---------------------------- | ----------------------------------- |
| Job type     | -                            | listing copy                        |
| Quantity     | Code rules                   | 30 variants                         |
| Length       | Code rules                   | 40-125 characters                   |
| Language     | Automatic language detection | English                             |
| Tone         | Cheap AI model               | direct, informal, second person     |
| Banned words | Code rules                   | free, guaranteed, miraculous        |
| Format       | Code rules                   | JSON with the fields title and text |
| Deadline     | Escrow contract              | 2 hours                             |
| Price        | Escrow contract              | 20 USDC                             |

This is what a signed spec looks like, as the MCP server and the verifier receive it:

```json
{
  "type": "listing_copy",
  "quantity": 30,
  "length": { "min": 40, "max": 125, "unit": "characters" },
  "language": "en",
  "tone": ["direct", "informal", "second person"],
  "banned_words": ["free", "guaranteed", "miraculous"],
  "format": { "type": "json", "fields": ["title", "text"] },
  "deadline_hours": 2,
  "price_usdc": 20,
  "negotiation_rounds": 1
}
```

At launch we need three ready-made templates, one for each of your agents: listing copy, translations, competitor research. The more fields can be checked with code rules, the cheaper verification is and the fewer disputes there are.

## Economic rules and simulation results

The launch rules: 2.5% fee with volume discounts, 5 USDC stake, free revision, dispute fee paid by the loser, forfeited stake going entirely to the buyer.

| Rule                  | Launch value                                                                                   | Why                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Fee on paid jobs      | 2.5% of the value, minimum 0.05 USDC                                                           | Keeps about 82% of jobs. The minimum covers verification and gas on small jobs                                  |
| Volume discount       | 2% above 500 jobs per month per owner, 1.5% above 5,000. Never below 1.5%                      | Even at 1.5% and with a referral on every job, about 0.09 USDC per job remains, against 0.023 in variable costs |
| Provider stake        | 5 USDC                                                                                         | Brings active scammers down from 53 to 9 without driving away honest providers                                  |
| Forfeited stake       | The job value, all of it to the buyer                                                          | The platform must not profit from punishing                                                                     |
| Revision              | One free fix if the automated checks fail. The platform pays for the second check (~0.01 USDC) | 78% of fixes succeed                                                                                            |
| Dispute fee           | The greater of 0.25 USDC and 5% of the value, paid by the loser                                | Covers the AI arbiter and discourages frivolous disputes                                                        |
| Automatic release     | 24 hours without disputes                                                                      | The provider gets paid even if the buyer does not respond                                                       |
| Maximum value per job | 100 USDC in the first months                                                                   | Limits the damage of any bug in the contract                                                                    |
| Referral              | 0.5 fee points for 12 months                                                                   | Details below                                                                                                   |

**Automatic referral.** Whoever brings a new agent onto the platform receives a share of the fee on each of its jobs. Users bring in other users, with no sales team.

- **Share:** 0.5 of the 2.5 fee points, i.e. one fifth. On jobs brought in by referral the platform keeps 2%.
- **Duration:** 12 months from the referred agent's first transaction. This way the cost does not pile up forever.
- **Recipient:** the agent or developer named at registration, via a code in the registration call to the MCP server.
- **Payment:** the escrow contract splits the fee automatically when the payment is released, together with everything else.
- **Anti-abuse:** paid only on completed, undisputed jobs between agents with different owners. The referred agent must have posted its stake. No self-referrals and no referrals between wallets of the same owner.

The referral has a cost: with 40% of jobs coming from referrals, simulated profit drops from 689 to 632 USDC per month, and to 546 at 100%. That is the price of growth without a sales team.

**Escrow and stake.** With a 2.5% fee, over 90 days:

| Model                               | Value exchanged (USDC) | Lost to scams | Buyers remaining out of 60 | Active scammers | Active honest providers |
| ----------------------------------- | ---------------------- | ------------- | -------------------------- | --------------- | ----------------------- |
| Pay first (x402 without protection) | 47,449                 | 8.3%          | 5.5                        | 52.2            | 62.0                    |
| Escrow, no stake                    | 84,086                 | 1.1%          | 48.0                       | 52.8            | 55.0                    |
| Escrow + 5 USDC stake               | 85,981                 | 1.0%          | 49.1                       | 9.2             | 50.4                    |
| Escrow + 20 USDC stake              | 84,162                 | 0.9%          | 48.5                       | 5.4             | 43.4                    |

Escrow nearly doubles the value exchanged because buyers stay. The 5 USDC stake blocks most scammers; the 20 USDC one blocks a few more but costs 7 honest providers.

**Free revision.** With the revision, 50 honest providers stay active instead of 42. The price: buyer losses rise from 0.7% to 1.0%, because scammers get a second chance too (9 active instead of 5). Reserving it for providers with 10 successful jobs lowers losses to 0.8% but cancels the benefit for honest providers: it is better to give it to everyone.

**Who collects the forfeited stake.** If half went to the platform, simulated profit (2% fee, 20 USDC stake) would rise from 603 to 1,348 USDC per month, but 54% of revenue would come from punishing. That revenue disappears precisely when the system works, and it creates an incentive to punish: ruled out.

**Fee level** (simulated monthly profit in USDC, 5 USDC stake, free revision, 40% of jobs from referrals, no netting):

| Fee               | Profit per month (USDC) | Jobs lost |
| ----------------- | ----------------------- | --------- |
| 0.5%              | 114                     | 0%        |
| 1%                | 254                     | 0%        |
| 2%                | 509                     | 14%       |
| **2.5% (launch)** | **632**                 | **18%**   |
| 3%                | 712                     | 24%       |
| 4%                | 866                     | 34%       |
| 5%                | 933                     | 43%       |
| 8%                | 792                     | 72%       |

5% is the short-term maximum, but it depends on the assumption about how much risk buyers perceive. At launch, keeping jobs matters more, because every job adds reputation data. At 2.5% the margin is about 0.25 USDC per job, already net of verification, referrals and gas: it takes about 1,000 completed jobs per day for 7,600 USDC of profit per month.

## Technical architecture

Eight components, almost all on free tiers: costs grow only when jobs grow, and every variable cost is covered by the fee or the dispute fee.

| Component            | What it does                                                                              | Technology                                                                          | Cost (estimate)                                                |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Escrow contract      | Locks funds, releases payment, withholds the fee, manages stakes                          | Solidity on Base, as small as possible, on already audited libraries (OpenZeppelin) | ~0.005 USDC per transaction, paid by the platform              |
| MCP server + API     | Single entry point for agents: register, post, negotiate the spec, take, deliver, dispute | TypeScript on Cloudflare Workers                                                    | Free tier at first                                             |
| x402 payments        | Payments and top-ups compatible with the standard                                         | Open source x402 library                                                            | 0                                                              |
| Verifier             | Checks the job criteria: code rules first, then a cheap AI model                          | Rules + AI model                                                                    | ~0.003-0.03 USDC per check                                     |
| AI arbiter           | Decides disputes                                                                          | AI model                                                                            | ~0.03 USDC per dispute, covered by the dispute fee (min. 0.25) |
| Reputation ledger    | Track record of every agent                                                               | Postgres on a free tier (Supabase or Cloudflare D1)                                 | 0                                                              |
| Your provider agents | 10-20 agents specialized in marketing                                                     | AI model + your prompts and data                                                    | Paid for by the jobs they do                                   |
| Owner dashboard      | Top-up, withdrawal, balance, history: a single page                                       | Static page                                                                         | 0                                                              |

Choices for ease of use: an agent connects with a single call to the MCP server, never needs to hold ETH for gas (the platform pays it) and receives acceptance criteria in a fixed format.

What **not** to build, and why:

- **Our own token or blockchain**: costs and licenses with no extra revenue.
- **Netting** (one settlement per day instead of one per job): in the simulation it saves about 16 USDC per month. To be added above 10,000 jobs per day.
- **Human arbitration**: the AI arbiter is enough for jobs worth a few dollars. To be added for large jobs.
- **Storefront or app for humans**: agents find services through the MCP and A2A registries.

## Costs and minimum budget

Phase 1 costs nothing: we work on a testnet with test money and free tiers. Money is spent only once the previous phase has reached its goal.

| Item                                       | Phase | Cost                                                | When it is spent                 |
| ------------------------------------------ | ----- | --------------------------------------------------- | -------------------------------- |
| Server, database, testnet                  | 1     | 0 (free tiers)                                      | Right away                       |
| AI model calls for your agents under test  | 1     | A few USD per month                                 | Right away                       |
| Domain                                     | 2     | ~15 USD per year                                    | Before launching with real money |
| Legal opinion on VARA and the Central Bank | 2     | To be quoted: the largest item                      | Before touching real money       |
| Security audit of the contract             | 2     | To be quoted: the smaller the contract, the cheaper | Before touching real money       |
| Stakes for your 20 agents (5 USDC each)    | 2     | 100 USDC, recoverable                               | At launch                        |
| Budget for buying test jobs                | 2     | 100-200 USDC                                        | At launch                        |
| On-chain gas                               | 2     | About 30 USDC per month at this scale               | At launch                        |
| AI verification (checks and revisions)     | 2     | About 30 USDC per month at this scale               | At launch, covered by the fee    |
| Free zone company license                  | 3     | To be quoted                                        | Once there is revenue            |

Your money at risk before the first revenue: about 300 USDC in operating costs, plus the legal opinion and the contract audit. Getting two or three quotes for these two items is the first task of phase 2.

**Break-even.** Months needed to pay back the legal opinion and the contract audit, with the simulated margin of about 0.25 USDC per job. The three upfront cost levels are assumptions, to be replaced with real quotes.

| Upfront cost (legal + contract) | At 100 jobs per day (~740 USDC/month) | At 300 jobs per day (~2,260 USDC/month) | At 1,000 jobs per day (~7,590 USDC/month) |
| ------------------------------- | ------------------------------------- | --------------------------------------- | ----------------------------------------- |
| Low: 3,000 USD                  | 4 months                              | 1.3 months                              | less than 1 month                         |
| Medium: 8,000 USD               | 11 months                             | 3.5 months                              | 1.1 months                                |
| High: 15,000 USD                | 20 months                             | 6.6 months                              | 2 months                                  |

Volume matters more than cost: reaching 300 jobs per day is worth more than saving on the quote.

## Roadmap

We move to the next phase only when its condition is met: this way nothing is spent before we have the evidence we need. The thresholds are proposed targets, to be adjusted with phase 1 data.

| Phase          | Period        | What                                                                                | Condition to move to the next phase              |
| -------------- | ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1 · Simulation | months 0-2    | Escrow on testnet, 3 of your agents, 100 test jobs. Cost: 0                         | AI arbiter correct ≥ 90%, positive legal opinion |
| 2 · Real money | months 2-5    | Real USDC in small amounts, 20 of your agents, first 5 customers. ~300 USDC + legal | 200 jobs per month, disputes below 5%            |
| 3 · Opening up | months 5-12   | External providers, fee test 2.5% → 3%, first round or bootstrapping                | 1,000 jobs per day, returning customers          |
| 4 · Credit     | from month 12 | Advances based on track record, ADGM or VARA license, earning on interest           | -                                                |

## How to find customers

The customers are agents, and agents look for services on their own: four channels out of six work without salespeople. Only the first 5 customers take a few direct messages.

| Priority | Channel                          | How it works                                                                                                                                                                                                                                                                     | When                      |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1        | Agent catalogs                   | Each of your agents listed in the [x402 Bazaar](https://docs.x402.org/extensions/bazaar), on [Agentic.Market](https://www.coinbase.com/developer-platform/discover/launches/agentic-market) and in the official MCP server registry. Agents find them and pay them automatically | From phase 2, set up once |
| 2        | Connection to Claude and ChatGPT | An agency connects the MCP server in one click and orders in chat ("30 copy variants for this campaign"). No blockchain to understand                                                                                                                                            | From phase 2              |
| 3        | Automatic referral               | Whoever brings in an agent receives 0.5 fee points for 12 months. Users bring in other users                                                                                                                                                                                     | From phase 3              |
| 4        | Agent developers                 | 0% fee for the first 3 months and integration in a few lines. Every provider brings its own customers. They can be found on GitHub, Discord and X                                                                                                                                | From phase 3              |
| 5        | Content                          | Tell the story of the project while building it, on LinkedIn and X: simulation, numbers, first jobs. Paid ads only once we know what a customer is worth                                                                                                                         | Right away                |
| 6        | Personal network                 | First 5 customers from agencies and marketing people you know, with a message and a 10-minute demo                                                                                                                                                                               | Right away                |

Channels 5 and 6 start right away, while phase 1 is being built. Channels 1 and 2 are the ones that scale on their own.

## Risks and assumptions to validate

The biggest risk is verification: if the AI arbiter is often wrong, trust collapses and the fee is no longer worth anything.

| Risk or assumption                                 | Value used in the simulation    | How to validate it                                                   |
| -------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| How much risk buyers perceive when paying directly | Between 1% and 12% of the value | Test the fee at 2.5% and then at 3% on real customers: how many stay |
| Share of bad jobs blocked automatically            | 60%                             | Measure it on your agents' jobs in phase 1                           |
| AI arbiter accuracy                                | 90%                             | 100 test disputes also judged by you                                 |
| Share of scammers among new agents                 | 15%                             | Ledger of agents that lose their stake                               |
| Average job value                                  | 8 USDC (median)                 | Real prices of the first 200 jobs                                    |

Other risks:

- **The giants add escrow** (Google, Coinbase, Stripe). Defense: speed in the vertical and neutrality, i.e. working with every platform.
- **Regulation**: even without custody, the activity may fall under virtual asset services. To be confirmed with the legal opinion before phase 2.
- **Vulnerable contract**: a bug in the code can drain the escrow. Defense: minimal contract, external audit, maximum value per job (for example 100 USDC) in the first months.
- **Fake agents inflating reputation**: the stake and the fee make it expensive to trade fake jobs. Agents that always work with the same few counterparts should be monitored.

## Next steps

The first goal on Claude Code is to get the escrow running on testnet with two of your agents exchanging a real job.

Before writing code:

- [x] Ask 3-5 agencies or marketing people whether they would pay 2.5% more for a guaranteed job with a refund
- [x] Check your own employment contract regarding side activities
- [x] Get 2-3 quotes for the legal opinion on VARA and update the break-even table

On Claude Code, phase 1:

- [ ] Create the three template specs (listing copy, translations, competitor research) in the format from the Acceptance criteria section
- [ ] Write the minimal escrow contract (lock, release, refund, stake, fee, referral) with automated tests
- [ ] Deploy it on the Base testnet (Base Sepolia) with test money
- [ ] Build the MCP server with 6 actions: register, post, negotiate, take, deliver, dispute
- [ ] Create the first 3 provider agents, one per template spec
- [ ] Run 100 test jobs and measure automatic blocks, successful revisions, disputes and arbiter accuracy
- [ ] Update the simulation assumptions (CONFIG in [simulation/simulate.py](simulation/simulate.py)) with the measured values and run it again

The referral (code at registration, fee split in the contract) is built together with the escrow: adding it later would cost a second contract audit.
