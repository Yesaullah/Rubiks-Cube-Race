_Generated from `results/trials.jsonl` (56 model-puzzle trials)._

### Primary benchmark (4–5 turn scrambles, exact BFS optimum)

| Model | Type | Trials | Success rate | Avg latency / move | Median | p95 | Avg total time | Avg moves | Avg moves (solved) vs shortest | Mean optimality gap | Gap = 0 | Forfeited turns | Refusals | Malformed outputs | Retries | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Opus 5.5** (`anthropic/claude-opus-5.5`) | Frontier LLM | 10 | **10%** (1/10) | **14.89 s** | 12.56 s | 32.38 s | 4:42.82 | 18.4 | 12.0 vs 4.0 | **+8.00** | 0 | 0 | 0 | 0 | 0 | $2.978 |
| **Jev 1.13** (`typesafe/jev-1.13`) | Decision | 10 | **0%** (0/10) | **653 ms** | 620 ms | 845 ms | 0:19.60 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.010 |
| **GPT-6 Luna** (`openai/gpt-6-luna-decisions`) | Decision | 10 | **0%** (0/10) | **1.09 s** | 1.38 s | 1.72 s | 0:32.78 | 14.1 | – vs – | **–** | 0 | 159 | 159 | 0 | 318 | $0.006 |
| **Clef** (`cloudflare/clef`) | Decision | 10 | **0%** (0/10) | **815 ms** | 721 ms | 1.36 s | 0:24.45 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.010 |


<img src="docs/charts/primary_latency.png" width="49%"> <img src="docs/charts/primary_success.png" width="49%"> <img src="docs/charts/primary_moves.png" width="49%"> <img src="docs/charts/primary_total_time.png" width="49%">


<details><summary>Per-puzzle results (primary)</summary>

| Puzzle | Shortest | Opus 5.5 | Jev 1.13 | GPT-6 Luna | Clef |
|---|---|---|---|---|---|
| `primary-01` | 4 | ❌ time limit · 5:00.02 | ❌ move limit · 0:19.00 | ❌ move limit · 0:42.41 | ❌ move limit · 0:24.23 |
| `primary-02` | 5 | ❌ move limit · 3:36.42 | ❌ move limit · 0:18.22 | ❌ move limit · 0:45.34 | ❌ move limit · 0:22.92 |
| `primary-03` | 4 | ❌ time limit · 5:00.03 | ❌ move limit · 0:17.89 | ❌ move limit · 0:40.48 | ❌ move limit · 0:21.68 |
| `primary-04` | 5 | ❌ time limit · 5:00.01 | ❌ move limit · 0:19.83 | ❌ move limit · 0:16.24 | ❌ move limit · 0:25.45 |
| `primary-05` | 4 | ❌ time limit · 5:00.02 | ❌ move limit · 0:19.33 | ❌ move limit · 0:15.87 | ❌ move limit · 0:24.05 |
| `primary-06` | 5 | ❌ time limit · 5:00.01 | ❌ move limit · 0:20.14 | ❌ move limit · 0:47.95 | ❌ move limit · 0:25.33 |
| `primary-07` | 4 | ❌ time limit · 5:00.01 | ❌ move limit · 0:19.68 | ❌ move limit · 0:45.15 | ❌ move limit · 0:24.11 |
| `primary-08` | 5 | ❌ time limit · 5:00.02 | ❌ move limit · 0:22.60 | ❌ move limit · 0:18.11 | ❌ move limit · 0:27.41 |
| `primary-09` | 4 | ✅ 12 (+8) · 3:52.51 | ❌ move limit · 0:20.12 | ❌ move limit · 0:40.09 | ❌ move limit · 0:22.64 |
| `primary-10` | 5 | ❌ move limit · 4:39.13 | ❌ move limit · 0:19.16 | ❌ move limit · 0:16.17 | ❌ move limit · 0:26.65 |

</details>

### Warm-up (3–4 turn scrambles)

| Model | Type | Trials | Success rate | Avg latency / move | Median | p95 | Avg total time | Avg moves | Avg moves (solved) vs shortest | Mean optimality gap | Gap = 0 | Forfeited turns | Refusals | Malformed outputs | Retries | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Opus 5.5** (`anthropic/claude-opus-5.5`) | Frontier LLM | 2 | **50%** (1/2) | **19.96 s** | 21.61 s | 31.63 s | 3:10.60 | 9.5 | 5.0 vs 3.0 | **+2.00** | 0 | 0 | 0 | 0 | 0 | $0.443 |
| **Jev 1.13** (`typesafe/jev-1.13`) | Decision | 2 | **0%** (0/2) | **627 ms** | 593 ms | 771 ms | 0:18.81 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.002 |
| **GPT-6 Luna** (`openai/gpt-6-luna-decisions`) | Decision | 2 | **0%** (0/2) | **1.33 s** | 1.40 s | 1.70 s | 0:39.79 | 5.5 | – vs – | **–** | 0 | 49 | 49 | 0 | 98 | $0.000 |
| **Clef** (`cloudflare/clef`) | Decision | 2 | **0%** (0/2) | **788 ms** | 658 ms | 1.69 s | 0:23.63 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.002 |


<details><summary>Per-puzzle results (warmup)</summary>

| Puzzle | Shortest | Opus 5.5 | Jev 1.13 | GPT-6 Luna | Clef |
|---|---|---|---|---|---|
| `warmup-01` | 3 | ✅ 5 (+2) · 1:21.20 | ❌ move limit · 0:18.90 | ❌ move limit · 0:42.94 | ❌ move limit · 0:21.70 |
| `warmup-02` | 4 | ❌ time limit · 5:00.01 | ❌ move limit · 0:18.71 | ❌ move limit · 0:36.64 | ❌ move limit · 0:25.56 |

</details>

### Extension (15–20 turn scrambles, best-known reference)

| Model | Type | Trials | Success rate | Avg latency / move | Median | p95 | Avg total time | Avg moves | Avg moves (solved) vs shortest | Mean optimality gap | Gap = 0 | Forfeited turns | Refusals | Malformed outputs | Retries | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Opus 5.5** (`anthropic/claude-opus-5.5`) | Frontier LLM | 2 | **0%** (0/2) | **6.14 s** | 5.96 s | 9.54 s | 3:04.18 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.207 |
| **Jev 1.13** (`typesafe/jev-1.13`) | Decision | 2 | **0%** (0/2) | **709 ms** | 687 ms | 827 ms | 0:21.29 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.002 |
| **GPT-6 Luna** (`openai/gpt-6-luna-decisions`) | Decision | 2 | **0%** (0/2) | **1.07 s** | 1.16 s | 1.85 s | 0:32.02 | 15.5 | – vs – | **–** | 0 | 29 | 29 | 0 | 58 | $0.001 |
| **Clef** (`cloudflare/clef`) | Decision | 2 | **0%** (0/2) | **913 ms** | 773 ms | 2.08 s | 0:27.40 | 30.0 | – vs – | **–** | 0 | 0 | 0 | 0 | 0 | $0.002 |


<details><summary>Per-puzzle results (extension)</summary>

| Puzzle | Shortest | Opus 5.5 | Jev 1.13 | GPT-6 Luna | Clef |
|---|---|---|---|---|---|
| `extension-01` | 15* | ❌ move limit · 2:59.97 | ❌ move limit · 0:21.73 | ❌ move limit · 0:47.82 | ❌ move limit · 0:28.95 |
| `extension-02` | 20* | ❌ move limit · 3:08.39 | ❌ move limit · 0:20.84 | ❌ move limit · 0:16.22 | ❌ move limit · 0:25.85 |

</details>
