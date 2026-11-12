# Simulation results

Output of [`simulate.py`](simulate.py) with the default `CONFIG` assumptions: 90 days, 60 buyer agents, test money only. Every row is the mean of 8 runs (seeds 0 to 7), so the output is deterministic.

Column legend:

| Column       | Meaning                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| GMV          | Total value of paid jobs over 90 days (USDC)                                 |
| profit/month | Platform net profit per month after variable and fixed costs (USDC)          |
| margin/job   | Revenue minus variable costs, per completed job (USDC)                       |
| losses       | Value of bad work that buyers paid for, as % of GMV                          |
| completed    | Completed jobs as % of posted jobs                                           |
| lost to fee  | Jobs that went elsewhere because the fee exceeded the buyer's perceived risk |
| from stakes  | Share of platform revenue that comes from forfeited stakes                   |
| buyers       | Active buyers at the end (out of 60)                                         |
| honest       | Active honest providers at the end                                           |
| scammers     | Active scammers at the end                                                   |

Reproduce from the repo root with `python3 docs/simulation/simulate.py` (about 15 seconds).

```text
=== 1. Escrow vs 'pay first' (fee 2.5%) ===
Pay first (plain x402)     GMV    47449  profit/month   370.4  margin/job 0.276  losses   8.3%  completed 100.0%  lost to fee   0.0%  from stakes  0.0%  buyers  5.5  honest 62.0  scammers 52.2
Escrow, no stake           GMV    84086  profit/month   624.5  margin/job 0.255  losses   1.1%  completed  78.3%  lost to fee  18.3%  from stakes  0.0%  buyers 48.0  honest 55.0  scammers 52.8
Escrow + stake 5           GMV    85981  profit/month   631.6  margin/job 0.254  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
Escrow + stake 20          GMV    84162  profit/month   613.6  margin/job 0.252  losses   0.9%  completed  78.9%  lost to fee  18.4%  from stakes  0.0%  buyers 48.5  honest 43.4  scammers  5.4

=== 2. Free revision (fee 2.5%, stake 5) ===
No revision                GMV    86942  profit/month   615.2  margin/job 0.244  losses   0.7%  completed  77.6%  lost to fee  17.4%  from stakes  0.0%  buyers 52.9  honest 41.9  scammers  5.0
With free revision         GMV    85981  profit/month   631.6  margin/job 0.254  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
Revision after 10 ok jobs  GMV    87722  profit/month   631.4  margin/job 0.247  losses   0.8%  completed  79.6%  lost to fee  17.7%  from stakes  0.0%  buyers 52.0  honest 42.0  scammers  7.4
   revisions per month: 141, successful: 78%, verification cost per month: 28.3 USDC

=== 3. Referral (fee 2.5%, stake 5) ===
No referral jobs           GMV    85981  profit/month   689.2  margin/job 0.276  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
40% from referral          GMV    85981  profit/month   631.6  margin/job 0.254  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
100% from referral         GMV    85981  profit/month   545.9  margin/job 0.221  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2

=== 4. Netting (fee 2.5%, stake 5) ===
No netting                 GMV    85981  profit/month   631.6  margin/job 0.254  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
With netting               GMV    85981  profit/month   647.7  margin/job 0.260  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2

=== 5. Fee level (stake 5, current rules) ===
fee 0.5%                   GMV   100817  profit/month   114.2  margin/job 0.046  losses   1.1%  completed  96.3%  lost to fee   0.0%  from stakes  0.0%  buyers 45.6  honest 50.5  scammers  7.2
fee 1.0%                   GMV   100439  profit/month   254.0  margin/job 0.092  losses   1.1%  completed  96.4%  lost to fee   0.0%  from stakes  0.0%  buyers 45.1  honest 49.9  scammers  7.9
fee 2.0%                   GMV    89309  profit/month   508.8  margin/job 0.198  losses   0.9%  completed  83.3%  lost to fee  13.7%  from stakes  0.0%  buyers 48.0  honest 49.5  scammers  8.2
fee 2.5%                   GMV    85981  profit/month   631.6  margin/job 0.254  losses   1.0%  completed  79.0%  lost to fee  18.1%  from stakes  0.0%  buyers 49.1  honest 50.4  scammers  9.2
fee 3.0%                   GMV    79228  profit/month   711.6  margin/job 0.308  losses   1.1%  completed  73.0%  lost to fee  24.4%  from stakes  0.0%  buyers 49.5  honest 50.8  scammers  8.8
fee 4.0%                   GMV    70514  profit/month   866.0  margin/job 0.419  losses   1.0%  completed  63.8%  lost to fee  33.8%  from stakes  0.0%  buyers 50.6  honest 48.6  scammers  8.4
fee 5.0%                   GMV    59951  profit/month   933.3  margin/job 0.528  losses   1.0%  completed  54.5%  lost to fee  43.4%  from stakes  0.0%  buyers 51.5  honest 49.8  scammers 12.0
fee 8.0%                   GMV    31409  profit/month   792.1  margin/job 0.871  losses   1.0%  completed  27.2%  lost to fee  71.7%  from stakes  0.0%  buyers 55.1  honest 47.2  scammers 14.5

=== 6. Variable costs per job and sustainability of discounts ===
   average job value 11.07 USDC, average variable cost 0.023 USDC per job
   fee 2.5% with referral active -> average margin 0.199 USDC per job
   fee 2.0% with referral active -> average margin 0.144 USDC per job
   fee 1.5% with referral active -> average margin 0.088 USDC per job

=== 7. Launch configuration and scale ===
fee 2.5%, stake 5 -> profit 632 USDC/month, margin 0.254 USDC/job, jobs lost to fee 18%, buyer losses 1.0%
    100 completed jobs/day -> ~      736 USDC/month
    300 completed jobs/day -> ~    2,259 USDC/month
   1000 completed jobs/day -> ~    7,588 USDC/month
  10000 completed jobs/day -> ~   76,108 USDC/month
```
