# Machine-Learning Stack — Association Rules Mining · Recommender Systems · Word Embedding

> Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md). That document says **where things run**;
> this one says **what they are built from and why** — libraries, algorithms, hyper-parameters,
> published artefacts, evaluation, and the production patterns each choice imitates.
>
> **This is a design and specification document, not a code listing.** Every component is described
> by its inputs, outputs, parameters and failure modes, so the implementation can be written
> directly from it — in a notebook, a module, or both.
>
> Target: the lab deliverable for *Exploring Intelligent Systems, Semester II-2026*, built the way a
> real e-commerce recommender is built rather than as three disconnected notebooks.

---

## Table of contents

- [0. The stack at a glance](#0-the-stack-at-a-glance)
- [1. How real systems are built (and what we copy)](#1-how-real-systems-are-built-and-what-we-copy)
- [2. Shared foundation](#2-shared-foundation)
- [3. Topic 1 — Association Rules Mining](#3-topic-1--association-rules-mining)
- [4. Topic 2 — Word Embedding](#4-topic-2--word-embedding)
- [5. Topic 3 — Recommender Systems](#5-topic-3--recommender-systems)
- [6. Serving integration with the Express API](#6-serving-integration-with-the-express-api)
- [7. Evaluation and experimentation](#7-evaluation-and-experimentation)
- [8. Dependencies and containers](#8-dependencies-and-containers)
- [9. Four-week delivery plan mapped to the rubric](#9-four-week-delivery-plan-mapped-to-the-rubric)
- [10. Version matrix and references](#10-version-matrix-and-references)

---

## 0. The stack at a glance

| Layer | Choice | Why this one |
| --- | --- | --- |
| Language / runtime | **Python 3.12** | Assignment mandates Python/Jupyter; 3.12 has full wheel coverage for gensim, faiss and torch (3.13, which is installed on this machine, is still patchy for some scientific wheels — see §2.1) |
| Environment manager | **uv** (fallback: venv + pip) | Fast, lockfile-based, reproducible — a grader can rebuild the exact environment |
| Dataframes | **pandas** + **pyarrow** | Parquet intermediates; pyarrow is what makes the extract → train boundary cheap |
| ARM | **mlxtend** (FP-Growth, Apriori, rule metrics) | Reference implementation with a clean metrics table; `efficient-apriori` as an independent cross-check |
| ARM at scale | **PySpark FPGrowth** *(discussed, not required)* | The honest answer to "what happens at 100M baskets" — worth a paragraph in the essay |
| Text preprocessing | **spaCy** (small English model) + **scikit-learn** for the TF-IDF baseline | Lemmatisation and stop-word removal that survives product-copy noise |
| Word embeddings | **gensim** Word2Vec / FastText | Trains on a small in-domain corpus; the topic's canonical algorithm |
| Item embeddings | **gensim Word2Vec over baskets** (*Prod2Vec*) | The trick that turns Word2Vec into a recommender — see §4.4 |
| Sentence embeddings | **sentence-transformers** (`all-MiniLM-L6-v2`, 384-d) | Pretrained semantic quality that 9–500 products can never learn from scratch |
| Vector search | **pgvector** (HNSW) in-database; **faiss-cpu** / **hnswlib** in the notebook | Artefacts live where the API already is (ADR-007) |
| Ranking | Weighted fusion + **Reciprocal Rank Fusion**; **LightGBM** learning-to-rank as the optional upgrade | RRF needs no training data; LightGBM is the standard learning-to-rank workhorse |
| Collaborative filtering *(optional 4th signal)* | **implicit** (ALS) | Rounds out the hybrid and gives the essay a CF-vs-content comparison |
| Serving | **FastAPI** + **uvicorn** + **pydantic**, or direct SQL from Express | Both topologies in ARCHITECTURE §10.4 |
| Tracking | **MLflow** (or a `model_runs` table) | "Result Evaluation" is 15% of the grade; runs must be comparable |
| Metrics | precision@k, recall@k, MAP@k, NDCG@k, coverage, novelty, diversity, CTR, add-to-cart rate | §7 |

---

## 1. How real systems are built (and what we copy)

### 1.1 Four reference architectures

| System | What it does | What we take |
| --- | --- | --- |
| **Amazon — item-to-item collaborative filtering** (Linden, Smith & York, 2003) | Precomputes an item→item similarity table offline; online is a table lookup on the current item | The entire shape of tier 1: **an offline-built, indexed item→item table read online in constant time**. "Frequently bought together" is association rules with a shipping deadline. |
| **YouTube — deep candidate generation and ranking** (Covington et al., RecSys 2016) | Hundreds of candidates from cheap retrieval, then an expensive ranker over that shortlist | The **two-stage split** (ARCHITECTURE §10.2). It is the single most transferable idea in industrial recommender systems. |
| **Netflix — offline / nearline / online** (Netflix Tech Blog, 2013) | Explicit latency tiers, each with different freshness and compute budgets | The **tier taxonomy**, and the rule that nothing is trained on the request path. |
| **Airbnb — listing embeddings** (Grbovic & Cheng, KDD 2018) *and* **Prod2Vec** (Grbovic et al., KDD 2015) | Word2Vec applied to sequences of *items* rather than words; the booked listing as a global context | The **Prod2Vec trick** (§4.4) — the bridge between the Word Embedding essay and the recommender. |

### 1.2 The pattern, stated once

```
        OFFLINE (minutes)                ARTEFACT STORE               ONLINE (< 100 ms)
┌──────────────────────────┐      ┌───────────────────────┐      ┌────────────────────────┐
│ extract → train → eval   │ ───► │ arm_rules             │ ───► │ retrieve candidates    │
│ (notebooks + CLI, Python)│      │ product_embeddings    │      │ fuse → rank → filter   │
│ reproducible, versioned  │      │ model_runs (metrics)  │      │ lookups only, no train │
└──────────────────────────┘      └───────────────────────┘      └────────────────────────┘
```

Three invariants follow from it, and this stack obeys them everywhere:

1. **Nothing is trained on the request path.** The online tier only reads indexed artefacts.
2. **Every artefact carries a model version.** A response can be traced to a training run, and two
   versions can serve side by side during an A/B test.
3. **Every recommendation carries a reason.** Not decoration — it is how a ranking bug gets found,
   and the rubric explicitly rewards explanation.

### 1.3 Why a *hybrid* rather than one model

| Signal | Strength | Blind spot | Covered by |
| --- | --- | --- | --- |
| Association rules | Real purchase evidence; highly explainable ("83% of baskets with A also had B") | Needs traffic; nothing for new products; can only relate items that have actually been bought together | embeddings, popularity |
| Text embeddings | Works from day one; handles cold-start items; captures semantic similarity | Confuses *similar* with *complementary* — it will recommend a second phone to someone buying a phone | association rules |
| Popularity | Never empty; robust | Identical for everyone; rich-get-richer feedback loop | rules, embeddings |

The hybrid exists because the blind spots are complementary. That sentence is the thesis of the
Recommender Systems essay, and §5.3 makes it measurable through an ablation table.

---

## 2. Shared foundation

### 2.1 Environment

| Step | Action | Note |
| --- | --- | --- |
| 1 | Create a virtual environment on **Python 3.12** | Pin it in a `.python-version` file so the choice is explicit |
| 2 | Install the package in editable mode with its dev extras | The notebooks import the package; they never redefine it |
| 3 | Generate and **commit the lockfile** | The lockfile *is* the reproducibility claim the grader can act on |
| 4 | Register the environment as a Jupyter kernel | So the notebooks run against exactly this environment, not the system Python |

> **Practical note.** This machine has Python 3.13.15. Building gensim or faiss from source on a very
> new interpreter is a classic way to lose an afternoon. Target 3.12. If only 3.13 is available, drop
> faiss (pgvector plus scikit-learn's exact nearest-neighbour search covers every need at this
> catalogue size) and confirm a gensim wheel resolves before committing to it.

### 2.2 Package layout

```
ml/
├── pyproject.toml
├── .python-version                 # 3.12
├── uv.lock
├── notebooks/                      # ← the graded artefacts (see §9)
│   ├── 01_dataset.ipynb
│   ├── 02_association_rules.ipynb
│   ├── 03_word_embeddings.ipynb
│   ├── 04_hybrid_recommender.ipynb
│   └── 05_evaluation.ipynb
├── src/signal_ml/
│   ├── config.py                   # settings from env; same database URL as the API
│   ├── data/
│   │   ├── extract.py              # SQL → parquet  (the "documented dataset" deliverable)
│   │   └── synth.py                # seeded synthetic basket generator
│   ├── arm/
│   │   ├── mine.py                 # frequent itemsets + rule metrics
│   │   └── publish.py              # rules → arm_rules table
│   ├── embeddings/
│   │   ├── corpus.py               # products → documents; baskets → sequences
│   │   ├── train.py                # Word2Vec / FastText / SBERT / Prod2Vec
│   │   ├── index.py                # vector upsert + nearest-neighbour queries
│   │   └── publish.py
│   ├── hybrid/
│   │   ├── candidates.py           # tier 1..4 retrievers
│   │   ├── fusion.py               # weighted / reciprocal-rank
│   │   ├── rank.py                 # learning-to-rank (optional)
│   │   └── filters.py              # stock, dedupe, diversity
│   ├── eval/
│   │   ├── split.py                # temporal + leave-one-basket-out
│   │   ├── metrics.py              # precision/recall/MAP/NDCG/coverage/novelty/diversity
│   │   └── offline.py              # runs the ablation grid
│   ├── service/app.py              # FastAPI (Option B)
│   └── pipeline.py                 # CLI entry point
└── artifacts/                      # gitignored: parquet, model files, vectors
```

**The notebooks import `signal_ml`; they never redefine it.** This is the difference between a lab
that can be deployed and a lab that is a transcript. Each notebook narrates and visualises; the logic
lives in the package and is what the CLI and the FastAPI service also call.

### 2.3 Configuration

One settings object, read identically by the notebooks, the CLI and the service. Every stochastic
step reads the same seed; every published artefact is stamped with the same model version.

| Setting | Default | Governs |
| --- | --- | --- |
| `database_url` | the API's development URL | Extraction and publication; one connection string for the whole system |
| `artifacts_dir` | `ml/artifacts` | Where parquet and model files land |
| `random_seed` | 42 | Synthetic generation, train/test splits, embedding initialisation |
| `model_version` | `v1` | Stamped on every published row; echoed in the API response |
| `min_support` | 0.01 | ARM — see the threshold table in §3.4 |
| `min_confidence` | 0.20 | ARM |
| `min_lift` | 1.10 | ARM |
| `max_itemset_len` | 3 | ARM — caps the combinatorial explosion |
| `embedding_backend` | `sbert` | One of: SBERT, Word2Vec, FastText, Prod2Vec |
| `sbert_model` | `all-MiniLM-L6-v2` | Must agree with `embedding_dim` |
| `embedding_dim` | 384 | Must match the vector column width in the database |
| `weight_arm` / `weight_emb` / `weight_pop` | 0.55 / 0.30 / 0.15 | Weighted fusion, when not using reciprocal-rank fusion |
| `candidate_pool` | 200 | How many candidates reach the ranking stage |

### 2.4 Extraction — the dataset deliverable

The assignment grades "Dataset (source and structure)". That makes extraction a **documented,
versioned pipeline stage**, not an ad-hoc query in a cell. It produces three parquet files:

| Output | Columns | Source and filter |
| --- | --- | --- |
| `products.parquet` | id, name, description, price, rating, tags, active, category, category slug | Products joined to their category. No filter — inactive products are kept, because they still appear in historical baskets and must be filterable *at serving time* rather than missing from *training*. |
| `baskets.parquet` | order id, product id, quantity, unit price, order timestamp | Order items joined to their order. **Excludes cancelled orders** and **excludes rows whose product id is null**. Ordered by time, so the temporal split (§7.1) is a slice rather than a sort. |
| `events.parquet` | session id, event type, product id, metadata, timestamp | The full interaction log, ordered by time. |

The mining stage consumes a derived view: baskets grouped by order id into a **sorted set of distinct
product ids**.

Two modelling decisions worth a paragraph each in the report:

- **Quantity is discarded when forming itemsets.** Support is a property of transactions, not units:
  buying two chargers is still one occurrence of "charger". A quantity-weighted variant exists and is
  a good "future work" sentence.
- **Rows with a null product id are dropped, not imputed from the stored product name.** Imputation
  would invent co-occurrences. The report should state how many rows this removes — on the current
  seed it is zero, but the pipeline must not assume that.

### 2.5 The bootstrapping problem, honestly

The seed has **3 orders of 2 items each** (ARCHITECTURE §6.5). With three transactions, the minimum
non-zero support is 33% and every observed co-occurrence has confidence 1.0. Any rule mined from it
is arithmetic, not evidence. Two legitimate ways forward:

| Option | How | Trade-off |
| --- | --- | --- |
| **A — Synthetic baskets** (recommended) | A generator with a **declared generative model**: a category affinity matrix, a handful of deliberately planted complementary pairs (phone → case, phone → charger, headphones → cable), item popularity drawn from a Zipf distribution, basket size from a truncated Poisson — all under the configured seed. Around 2,000–5,000 baskets, shipped as migration `V4`. | ✅ End-to-end system with a real data flow, and **the ground truth is known**, so you can show the miner recovering the planted rules — an unusually strong "Result Evaluation" section. ⚠️ Must be labelled synthetic on every chart, and you cannot claim real consumer insight. |
| **B — Public dataset** | Instacart Online Grocery, UCI Online Retail II, or a Kaggle e-commerce basket set, mapped onto the existing products/orders schema. | ✅ Genuine consumer behaviour, defensible scale. ⚠️ Its catalogue is not Signal Shop's, so the storefront demo and the mined rules describe different worlds unless the catalogue is remapped. |

**Recommended: A for the running system, B as a validation appendix** — mine both and show that the
method transfers. That single decision, clearly argued, addresses the "Dataset" and "Extension
ability" rubric rows at once.

---

## 3. Topic 1 — Association Rules Mining

### 3.1 The concepts the essay must pin down

For a rule `X ⇒ Y` over a transaction database `D` with `N` transactions:

| Metric | Definition | Reading | Range |
| --- | --- | --- | --- |
| Support | fraction of transactions containing `X ∪ Y` | How often the whole pattern occurs | [0, 1] |
| Confidence | `support(X ∪ Y) / support(X)` | `P(Y | X)` — reliability of the rule | [0, 1] |
| **Lift** | `confidence / support(Y)` | How many times more likely `Y` is given `X` than at random. **> 1 positive association, 1 independence, < 1 substitution** | [0, ∞) |
| Leverage | `support(X ∪ Y) − support(X) · support(Y)` | Excess co-occurrence in absolute terms — deflates rare-item noise | [−0.25, 0.25] |
| Conviction | `(1 − support(Y)) / (1 − confidence)` | How much more often `X` would occur without `Y` under independence; infinite for a perfect rule | [0, ∞) |
| Zhang's metric | normalised difference between confidence and `support(Y)` | Signed strength that handles negative association symmetrically | [−1, 1] |

**The confidence trap — the single most important paragraph in this essay.** If 80% of all baskets
contain a USB-C cable, then "anything ⇒ cable" has confidence around 0.80 and looks excellent, while
its lift is about 1.0: the cable is not associated with anything, it is simply everywhere. Ranking by
confidence recommends the most popular item to everyone. **Rank by lift, floor by support,
sanity-check with leverage.** Every real "frequently bought together" shelf is built on that ordering.

### 3.2 Algorithms

| Algorithm | Mechanism | Complexity intuition | Use when |
| --- | --- | --- | --- |
| **Apriori** (Agrawal & Srikant, 1994) | Breadth-first, level-wise; prunes using the downward-closure property (*every subset of a frequent itemset is frequent*) | One full database pass per level — expensive on long baskets | Teaching the mechanism; small data. **Use it in the notebook to show candidate generation step by step.** |
| **FP-Growth** (Han, Pei & Yin, 2000) | Compresses the database into a prefix tree, then mines it recursively — no candidate generation | Two passes total; dramatically faster in practice | **Production default.** Use it for the artefacts you publish. |
| **ECLAT** | Depth-first over vertical transaction-id lists, intersecting sets | Fast on sparse data, memory-hungry | A cross-check and a comparison row in the essay |
| **Spark FPGrowth** | Distributed FP-Growth | Scales to billions of transactions | The "how would this work at Amazon scale" paragraph |

Showing Apriori and FP-Growth returning **identical itemsets** at the same minimum support, with a
timing comparison, is a cheap and very convincing figure.

### 3.3 The mining stage, step by step

| Step | What happens | Why it matters |
| --- | --- | --- |
| 1 | Group basket rows by order id into sets of distinct product ids | Classical ARM is defined over sets (§2.4) |
| 2 | Encode transactions as a **sparse** boolean item matrix — one row per basket, one column per product | The dense shape is *N × catalogue size*; fine for thousands of products, catastrophic for millions, which is exactly why the distributed implementations exist. Use the sparse path from the start. |
| 3 | Mine frequent itemsets with FP-Growth at the configured minimum support, capped at `max_itemset_len` | The cap is the main defence against combinatorial blow-up |
| 4 | **Fail loudly if the result is empty**, reporting the smallest achievable non-zero support for the basket count | Silent empty output is how a broken threshold reaches a report unnoticed |
| 5 | Derive rules, thresholded on lift, then filtered on confidence | Lift first, confidence second — §3.1 |
| 6 | Keep **single-consequent rules only** | The serving contract is "given this anchor, recommend one item". Multi-item consequents cannot be ranked into a flat shelf. |
| 7 | Compute a serving sort key — lift × confidence | One column the online query can order by with an index, rather than a runtime expression |
| 8 | Sort by lift, then confidence, then support | Deterministic output, so two runs of the same data produce byte-identical artefacts |

> **API-churn warning.** The `association_rules` signature in mlxtend changed across releases (0.24
> added an extra argument used by some metrics). **Pin the version** and record it in the notebook —
> an undocumented version bump silently changing your rule table is a textbook reproducibility
> failure, and worth one honest sentence in the report.

### 3.4 Choosing thresholds — the part that is actually hard

Thresholds are not hyper-parameters to grid-search; they are **business decisions with statistical
consequences**. Report them as a chosen operating point with a sensitivity curve.

| Parameter | Start at | Symptom if too low | Symptom if too high |
| --- | --- | --- | --- |
| Minimum support | the larger of 0.01 and "at least 5 supporting baskets" | Combinatorial explosion, memory death, rules derived from two customers | Only bestsellers survive; the long tail gets nothing |
| Minimum confidence | 0.20 | Noise | Only near-deterministic pairs; recall collapses |
| Minimum lift | 1.10 | Ubiquitous items pollute every shelf | Too few rules to fill a four-slot shelf |
| Maximum itemset length | 3 | Exponential blow-up; unusable at serving time | Misses genuine three-item bundles (phone + case + charger) |

**Two figures the report should contain:**

1. Minimum support on a log axis against *number of frequent itemsets* and *mining time* — this shows
   the combinatorial cliff and justifies the chosen value.
2. A lift-versus-confidence scatter, one point per rule, sized by support — this instantly exposes
   the high-confidence / low-lift cluster that the confidence trap produces.

### 3.5 Known pitfalls to name explicitly

| Pitfall | What happens | Mitigation |
| --- | --- | --- |
| **Confidence trap** | Popular items dominate every shelf | Rank by lift; floor by support |
| **Rare-item problem** | A single two-item basket yields confidence 1.0 | Absolute support floor (at least 5 baskets) *and* leverage |
| **Multiple comparisons / spurious rules** | Thousands of candidates mean some look significant purely by chance | Fisher's exact test, or a Benjamini–Hochberg false-discovery-rate correction across rules; or hold-out validation of rule stability |
| **Cross-support patterns** | A very frequent and a very rare item end up in one rule | Filter on the support ratio between antecedent and consequent |
| **Correlation is not causation** | "Buyers of A buy B" may be a merchandising artefact — they were on the same landing page | State it; validate against an A/B result rather than the rule table |
| **Temporal leakage** | Mining on all data, then evaluating on data the model has already seen | Split by order timestamp **before** mining (§7.1) |
| **Symmetry illusion** | `A ⇒ B` and `B ⇒ A` share support and lift but not confidence | Publish directed rules; never reverse one at serving time |

### 3.6 Published artefact — the rules table

Created by migration `V5`.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | bigserial primary key | — |
| `antecedent` | integer array | The condition items. An array so a rule can be keyed on the anchor *plus* the current cart. |
| `consequent` | integer, foreign key to products | The recommended item; single-valued by construction (§3.3 step 6) |
| `support`, `confidence`, `lift`, `leverage` | numeric | The interest measures, carried through to the explanation string |
| `conviction` | numeric, nullable | Null encodes infinity, which occurs whenever confidence is exactly 1 |
| `rule_strength` | numeric | Lift × confidence — the precomputed serving sort key |
| `model_version` | varchar | Which training run produced this row |
| `created_at` | timestamptz | Staleness monitoring |

**Indexes.** A GIN index on `antecedent` (to support array-containment lookups) and a composite index
on model version plus descending rule strength (to support the ordered scan within one version).

**Serving semantics.** Given the anchor product and the current cart, the online query asks for every
rule whose antecedent is **contained in** that set, excluding consequents already present, ordered by
rule strength, limited to roughly 50 candidates. With the GIN index this is an index probe, not a
scan — it is the Amazon item-to-item lookup expressed in PostgreSQL.

**Publication semantics.** Publishing is an **atomic swap inside one transaction**: delete the rows
for this model version, insert the new batch, commit. Readers on the previous model version never
observe a partially written table.

### 3.7 Real-world framing for the essay

- **Amazon "Frequently bought together"** — the commercial archetype; item-to-item precomputation.
- **Instacart and grocery generally** — the canonical ARM domain, with large baskets and strong
  complementarity.
- **Retail planogramming** — rules drive shelf adjacency in physical stores, a non-recommender use
  worth mentioning for "extension ability".
- **Beyond retail** — web-log sequence mining, medical co-morbidity and co-prescription analysis,
  intrusion-detection alert correlation. The algorithm is about co-occurrence, not shopping.
- **The beer-and-nappies story is almost certainly apocryphal.** Saying so, with the reason — it is
  repeated everywhere and sourced nowhere — signals genuine critical reading.

---

## 4. Topic 2 — Word Embedding

### 4.1 What the corpus is here

Signal Shop's text is short and domain-specific: a name of at most 160 characters, one description
sentence, a category, and three or four tags. That shape drives every decision below.

**Document construction.** Each product becomes one lowercase document by concatenating its fields,
with the most identity-bearing fields **repeated** to weight them:

| Field | Repetitions | Why |
| --- | --- | --- |
| Name | ×2 | The strongest single signal of what the item is |
| Tags | ×2 | Curated, high-precision keywords |
| Category | ×1 | Coarse but reliable grouping |
| Description | ×1 | Context and vocabulary, but also the noisiest marketing copy |

On a corpus this small, this crude weighting matters considerably more than the choice of model.
Whitespace is normalised and tokenisation keeps alphanumerics and hyphens so that terms like `usb-c`
survive as one token.

### 4.2 The three approaches, and when each is correct

| Approach | Library | Dimensions | Trains on | Right when |
| --- | --- | --- | --- | --- |
| **TF-IDF + cosine** | scikit-learn | sparse | this corpus | **The baseline.** Fast, interpretable, and on nine products it often beats everything. Never skip it — "we beat TF-IDF by X" is the only claim that means anything. |
| **Word2Vec / FastText** | gensim | 100–300 | this corpus | The essay's core topic; learns *your* domain's semantics. FastText's subword n-grams additionally handle `usb-c` versus `usbc` and out-of-vocabulary terms. |
| **Sentence-BERT** | sentence-transformers | 384 | pretrained, inference only | **Best quality on a small catalogue.** The model already knows headphones and speakers are both audio; nine documents never could. |

**The honest constraint, stated up front:** Word2Vec needs millions of tokens to learn good vectors.
Nine product descriptions are roughly 300 tokens. Training Word2Vec on them produces vectors that are
formally correct and semantically meaningless. Three valid responses, all of which make good report
material:

1. **Augment the corpus** — add category descriptions, synthetic product copy, or a public
   e-commerce product-title corpus, then fine-tune.
2. **Use Prod2Vec instead** (§4.4) — train on *baskets*, where the synthetic dataset supplies
   thousands of sequences. The algorithm is identical; only the notion of "sentence" changes.
3. **Use pretrained sentence embeddings for serving, and train Word2Vec purely as an instructive
   comparison** — showing *why* it underperforms, with numbers, is a stronger result than a model
   that happens to work.

### 4.3 Training text embeddings — parameters and rationale

**Word2Vec hyper-parameters, calibrated for a small corpus** (the library defaults are tuned for
Wikipedia-scale data and are actively wrong here):

| Parameter | Value here | Why it differs from the default |
| --- | --- | --- |
| Architecture | **skip-gram** | More gradient updates per word than CBOW; the standard choice for small data |
| Vector size | 100 | 300 dimensions over ~300 tokens is pure over-parameterisation |
| Window | 5 | Product copy has no long-range syntax; a wide window approximates bag-of-words context |
| Minimum count | 1–2 | The usual default of 5 deletes most of a tiny vocabulary |
| Negative samples | 10 | More negatives per positive compensates for having few positives |
| Frequent-word subsampling | ~1e-3 | Keeps "the" and "with" from dominating |
| Epochs | 50–100 | The default of 5 sees a small corpus far too few times |
| Seed, single worker | fixed seed, one thread | Multi-threaded training is **not** bit-reproducible even with a fixed seed — worth a footnote in the report |

**FastText** uses the same settings plus character n-grams of length 3–6, which is what buys
robustness to hyphenation and unseen words.

**From word vectors to a product vector.** Word2Vec produces one vector per *word*; the recommender
needs one per *product*. Three pooling options, in increasing sophistication:

| Pooling | Description | When |
| --- | --- | --- |
| Mean | Average the word vectors in the document | The default; fine for a first pass |
| IDF-weighted mean | Weight each word by its inverse document frequency, so "wireless" does not drown out "headphones" | Recommended here — cheap and noticeably better on product copy |
| SIF (Arora et al., 2017) | Weight by a smoothed inverse frequency, then remove the first principal component | The principled version; a good "we also tried" paragraph |

All product vectors are **L2-normalised**, which makes cosine similarity equal to the inner product
and lets the database index do the work.

**Sentence-BERT** skips all of the above: documents go in, 384-dimensional normalised vectors come
out, with no training step. Batch the encoding and request normalised output directly.

### 4.4 Prod2Vec — the bridge to the recommender

The insight from Grbovic et al. (KDD 2015) and Airbnb (KDD 2018): **Word2Vec does not care that its
tokens are words.** Feed it sequences of product ids and it learns item embeddings in which proximity
means "appears in similar baskets".

| Concept | Word2Vec on text | Prod2Vec here |
| --- | --- | --- |
| Sentence | A sentence | One basket |
| Word | A word | One product id |
| Window | 5 — local syntax matters | **Very large (effectively the whole basket)** — a basket has no meaningful internal order, so every item is context for every other item |
| Minimum count | 1–2 | 3 — drop products too rare to place reliably |
| Vector size | 100 | 64 — fewer items than words, so fewer dimensions |
| Corpus filter | — | Baskets of size 1 are dropped; they contain no co-occurrence |

For *clickstream* sequences rather than baskets, order is real and a small window becomes correct
again — worth one sentence in the essay, because it shows the parameter is a modelling choice rather
than a constant.

This single idea is why the two essays are one lab. It is also a genuinely different signal from text
embeddings: **Prod2Vec learns complementarity** (phone ↔ case, because they share baskets), while
**SBERT learns similarity** (phone ↔ phone, because the words match). Placing the two neighbour lists
side by side for the same anchor product is one of the most illuminating tables the report can
contain.

### 4.5 Vector storage and nearest-neighbour search

| Option | Where it runs | Scale | Use here |
| --- | --- | --- | --- |
| **pgvector** (HNSW index) | inside PostgreSQL | ~10⁶ vectors comfortably | **Production path** — artefacts live with the data (ADR-007), no extra service |
| **faiss-cpu** | in-process Python | 10⁶–10⁹ | Notebook experiments; the Option B service |
| **hnswlib** | in-process Python | ~10⁷ | Lighter alternative, trivial to install |
| Exact brute-force search (scikit-learn) | in-process | ~10⁴ | The **correctness oracle** for measuring approximate-search recall |

**The embedding table** (migration `V6`):

| Column | Type | Purpose |
| --- | --- | --- |
| `product_id` | integer primary key, foreign key to products, cascading delete | One vector per product |
| `embedding` | vector, width = the configured embedding dimension | Must match the model that produced it |
| `model_version` | varchar | Allows two model versions to coexist during an A/B test |
| `updated_at` | timestamptz | Staleness monitoring |

The index is **HNSW over the cosine operator class**. HNSW is preferred over the alternative IVFFlat
index because it requires no training step on the existing data and its accuracy/latency trade-off is
tunable per query rather than per build.

**Three operational details that separate a working index from a fast one:**

1. **Order by the raw distance operator.** Wrapping the distance in an expression to turn it into a
   similarity inside the `ORDER BY` clause defeats the HNSW index and silently falls back to a
   sequential scan. Compute similarity in the select list; order by the bare distance.
2. **The search-effort parameter trades latency for recall.** Set it per session and measure recall
   against the brute-force oracle, then report the curve. That is exactly the kind of concrete
   engineering result the "Result Evaluation" row rewards.
3. **Filtering before approximate search is a trap.** A restrictive `WHERE` clause can leave the index
   returning fewer than the requested number of rows. Over-fetch — ask for 50 when the shelf shows 4
   — and filter afterwards, which is precisely why the architecture separates candidate generation
   from filtering.

**A note on the repository's no-raw-SQL rule.** Prisma has no vector type, so the nearest-neighbour
query is the one justified exception. It should be isolated inside the recommendation repository as a
single parameterised typed raw query, with a comment recording why. Everything else stays typed.

### 4.6 Evaluating embeddings

**Intrinsic — does the space make sense?**

- **Nearest-neighbour inspection** for five to ten anchor products: a table of anchor → top-5 with
  similarity scores. Cheap, and it immediately shows whether the space is sane.
- **Analogy probes** adapted to the domain (phone − case + headphones ≈ ?). On a small corpus these
  mostly fail; reporting the failure with an explanation is better than omitting it.
- **Category coherence**: mean intra-category versus inter-category cosine similarity. One number
  that captures whether the embedding recovered a taxonomy it was never told about.
- **Two-dimensional projection** (UMAP or t-SNE) coloured by category. The one figure every reader
  looks at — label the points, and state the projection parameters, because these layouts are not
  stable across runs.

**Extrinsic — does it improve the product?** Retrieval quality of the embedding-only recommender
against the TF-IDF baseline and the existing placeholder, measured with the §7 metrics. This is the
number that matters.

---

## 5. Topic 3 — Recommender Systems

### 5.1 The taxonomy the essay needs

| Family | Mechanism | Strengths | Weaknesses | In this project |
| --- | --- | --- | --- | --- |
| Content-based | Similarity in an item feature space | No cold start for items; explainable | Over-specialisation, filter bubble | **Embedding nearest neighbours (tier 2)** |
| Collaborative filtering — neighbourhood | User–user or item–item co-occurrence | Captures taste beyond content | Cold start; sparsity | **ARM is a close cousin (tier 1)**; item-item CF is the natural extension |
| Collaborative filtering — latent factor | Matrix factorisation (ALS, BPR) | Handles sparsity; strong accuracy | Opaque; needs retraining; cold start | Optional fourth signal |
| Association rules | Frequent itemsets over baskets | Highly explainable; captures complementarity | Needs traffic; not personalised | **Tier 1** |
| Knowledge / rule-based | Hand-written business rules | Full control; works on day one | Does not learn | The stock and diversity filter stage |
| Hybrid | Combines the above | Covers each other's blind spots | Complexity; harder to attribute | **This system** |

**Position ARM precisely.** It is *not* collaborative filtering: it models item→item co-occurrence
over transactions with no user identity, so it produces **contextual, non-personalised**
recommendations. That is why it fits a "frequently bought together" shelf perfectly and a
"recommended for you" homepage poorly — and why the hybrid needs the other signals.

### 5.2 The serving pipeline

**The candidate.** Every retriever emits the same record, and the fields are what make fusion and
explanation possible:

| Field | Meaning |
| --- | --- |
| Product id | The candidate item |
| Score | **Source-local, and not comparable across sources before normalisation** — a lift of 3.4 and a cosine of 0.87 are not on the same scale |
| Source | Which tier produced it: rules, embedding, co-visitation, popularity |
| Reason | The user-facing explanation string, filled from the artefact that generated the candidate |

**The four retrievers.** Rules keyed on the anchor plus the cart; embedding nearest neighbours of the
anchor; session co-visitation; and time-decayed popularity as the backstop. Each returns roughly 50
candidates.

**Fusion — two options; implement both and compare, because the comparison is itself a result:**

| Method | How it works | When to prefer it |
| --- | --- | --- |
| **Weighted sum** | Min–max normalise scores **within each source**, then combine using the configured weights | When you have enough evaluation data to tune the weights honestly |
| **Reciprocal rank fusion** (Cormack et al., 2009) | Each item scores the sum over sources of `1 / (k + rank)`, with `k` around 60 | **The right default.** It uses only ranks, so it needs no score calibration and no tuned weights — and it is remarkably hard to beat |

**Ranking (optional, with honest advice).** A gradient-boosted learning-to-rank model over features
such as rule lift, rule confidence, embedding similarity, popularity rank, price ratio, same-category
flag, stock and rating, trained on logged impressions with clicks as relevance labels. With a few
thousand synthetic baskets and no real click log, this ranker will overfit and a tuned reciprocal
rank fusion will beat it. Saying that — and showing the overfit — is a better result than shipping a
ranker that looks sophisticated and performs worse.

**Business filters, always last:** active, in stock, not the anchor, not already in the cart,
deduplicated, at most *k* items per category, then a diversity re-rank.

**Diversity.** Maximal Marginal Relevance (Carbonell & Goldstein, 1998) selects items one at a time,
each time maximising a blend of relevance and *dissimilarity to what is already selected*, controlled
by a single λ: λ = 1 is pure relevance and typically produces four near-identical cables; λ ≈ 0.7
produces a useful variety. A shelf of four almost-identical cables is technically optimal and
commercially useless. MMR is where the embedding space pays a second dividend — it supplies the
similarity function that diversity needs.

### 5.3 Ablation — the table that makes the report

| Variant | Tier 1 rules | Tier 2 embeddings | Fusion | Ranker | Precision@4 | Recall@4 | NDCG@4 | Coverage | Novelty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B0 Placeholder (category + featured) | – | – | – | – | | | | | |
| B1 Popularity only | – | – | – | – | | | | | |
| B2 TF-IDF neighbours | – | TF-IDF | – | – | | | | | |
| M1 Rules only | ✓ | – | – | – | | | | | |
| M2 SBERT neighbours only | – | ✓ | – | – | | | | | |
| M3 Rules + SBERT | ✓ | ✓ | reciprocal rank | – | | | | | |
| M4 M3 with weighted fusion | ✓ | ✓ | weighted | – | | | | | |
| M5 M4 with a learned ranker | ✓ | ✓ | weighted | ✓ | | | | | |
| M6 M4 with diversity re-ranking | ✓ | ✓ | weighted | – | | | | | |

Every row is one configuration change, so every row is attributable. **B0 is the existing
placeholder** — which is exactly why ARCHITECTURE §7.2 keeps it: the control arm already exists, and
"we beat the deployed baseline by X" is a stronger claim than a number with nothing to compare
against. Note that M6 will probably *lower* precision@4 while raising coverage and novelty; explaining
that trade-off is the recommender-systems essay in miniature.

### 5.4 Cold start

| Case | Signal available | Strategy |
| --- | --- | --- |
| New product, no purchases | Text only | **Tier 2** — embeddings work from the first second. The clearest argument for including the Word Embedding topic at all. |
| New session, no history | Nothing | Tier 3 popularity, or tier 4 category affinity |
| New product *and* no traffic | Category and price band | Tier 4, the existing placeholder |
| Anchor has rules but every consequent is out of stock | Rules, filtered to empty | Fall through to tier 2 — which is why the chain is ordered rather than a single blend |

### 5.5 Explainability

Each tier produces a template, filled from the artefact that generated the candidate:

| Tier | Template | Filled from |
| --- | --- | --- |
| Rules | "Bought together with **{anchor}** in **{confidence}** of baskets" | The rule's confidence |
| Rules (high lift) | "**{lift}×** more likely to be bought with **{anchor}**" | The rule's lift |
| Embedding | "Similar to **{anchor}**" — optionally naming the shared tags | Cosine similarity and tag intersection |
| Popularity | "Popular in **{category}** this week" | Time-decayed counts |

This costs one extra string in the response DTO and buys three things: a debugging surface, a UI
affordance the frontend can render as a chip, and a direct hit on the rubric's "clear explanation"
criterion.

---

## 6. Serving integration with the Express API

Recap of ARCHITECTURE §10.4 — **Option A (in-process)** is recommended for this lab; **Option B
(FastAPI sidecar)** is what larger systems do. The seam is the same either way.

### 6.1 Option A — TypeScript reads the published artefacts

Two new repository functions replace the placeholder's single query:

| Function | Reads | Returns | Notes |
| --- | --- | --- | --- |
| Rule candidates | `arm_rules` joined to products | product id, lift, confidence | Filters on model version, array containment of the antecedent, exclusion of items already held, active and in stock. Ordered by rule strength. Uses Prisma's parameterised query API. |
| Vector neighbours | `product_embeddings` joined to products | product id, similarity | Filters on model version, excludes the anchor, active and in stock. Ordered by the raw distance operator (§4.5). **The one justified raw-SQL exception.** |

The service then composes them: run both retrievals **in parallel**, fuse by reciprocal rank,
hydrate and filter the result, and — if fewer items survive than the requested limit — top up from
tier 3 and finally tier 4. The response reports the model version it used and the tier that actually
answered.

What does **not** change: the recommendation controller, the recommendation routes, and every file
under `client/`. That is the seam doing its job.

### 6.2 Option B — FastAPI sidecar

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /recommend` | anchor product id (optional), limit (1–12), current cart ids | model, strategy, and a list of items carrying product id, score, source and reason |
| `GET /health` | — | Liveness, for the compose health check and for Express's circuit decision |

The service performs exactly the §5.2 pipeline: four retrievers, fusion, filters, truncation. Express
proxies to it with a **hard timeout and a fallback**, never a bare awaited fetch:

| Concern | Rule |
| --- | --- |
| Timeout | Abort at the latency ceiling from ARCHITECTURE §13.1 (150 ms) using an abort signal |
| Non-2xx response | Treated identically to a timeout |
| On failure | Fall back to the tier-4 placeholder, and record the degradation in the strategy field |
| Hydration | Express still owns product hydration, so the wire DTO stays identical in both topologies |

**The rule this encodes:** a recommender is a *nice-to-have* on a page whose job is selling. It must
never take the page down. The fallback is not defensive padding — it is the design.

### 6.3 Caching

| Layer | Key | TTL | Note |
| --- | --- | --- | --- |
| In-process LRU | anchor + limit + model version | 5 min | Zero infrastructure; sufficient at this scale |
| Redis | same | 15 min | Only if a second API instance ever exists |
| Precomputed top-N table | product id → ordered item ids | rebuilt per training run | The Amazon approach: push the whole computation offline and make serving a single row read |

Always include the model version in the cache key, or a deploy will serve stale recommendations from
the previous model until the TTL expires.

---

## 7. Evaluation and experimentation

### 7.1 Splitting — get this wrong and every number is fiction

| Split | How | Use |
| --- | --- | --- |
| **Temporal** (primary) | Train on orders before a cut-off time, test on those after it — for example the last 20% of the time range | Mirrors reality: you always predict the future from the past |
| **Leave-one-basket-out** | Hide one item from each test basket; the task is to recover it from the rest | The natural fit for "complete the basket", which is what the UI actually shows |
| Random k-fold | ❌ **avoid** | Leaks the future into the past and inflates every metric |

Mine the rules and fit the embeddings on the **training slice only**. Re-extracting on the full
dataset "because it's just an embedding" is the most common silent leak in student recommender labs.

### 7.2 Offline metrics

| Metric | Definition | Answers |
| --- | --- | --- |
| Precision@k | relevant items in the top k, divided by k | Of what we showed, how much was right? |
| Recall@k | relevant items in the top k, divided by all relevant items | Of what was right, how much did we show? |
| MAP@k | mean average precision | Precision, weighted toward the top of the list |
| **NDCG@k** | discounted cumulative gain normalised by its ideal | Rank-aware quality. **The headline number** — position matters on a four-slot shelf. |
| Hit rate@k | fraction of test baskets with at least one hit | Blunt but very readable |
| **Coverage** | distinct items ever recommended, divided by the catalogue | Is the long tail reachable, or do five products take every slot? |
| **Novelty** | mean negative log popularity of the recommended items | Are we telling the user anything they did not already know? |
| Diversity | mean pairwise embedding *distance* within a shelf | Four cables, or a setup? |
| Serendipity | relevant **and** unexpected, relative to a popularity baseline | The metric that separates a recommender from a bestseller list |

**Report accuracy and beyond-accuracy metrics together.** A model that maximises precision@4 by
recommending the top four bestsellers to everyone will have near-zero coverage and no novelty. Showing
that trade-off explicitly is the difference between a lab that reports a number and one that
understands it.

### 7.3 Online metrics (the ones a business actually reads)

Computable from `user_events` joined to the impressions table (migration `V7`):

| Metric | Definition |
| --- | --- |
| Recommendation click-through rate | recommendation clicks divided by impressions |
| Add-to-cart rate | add-to-cart events whose source is a recommendation surface, divided by impressions |
| Attach rate | baskets containing at least one recommended item, divided by all baskets |
| Revenue per session | sessions exposed to recommendations versus those not |

**Impressions must be logged or the denominator does not exist.** This is the most common omission in
recommender projects: clicks are logged, opportunities are not, and click-through rate becomes
uncomputable after the fact. Migration `V7` exists for exactly this reason, and the client must start
emitting the already-schema-legal `recommendation_click` event.

### 7.4 Experiment design

- **A/B test** — hash the session id into a bucket, serve strategy A or B, compare click-through
  rates with a two-proportion test. Report the confidence interval, not just the point estimate.
- **Interleaving** — mix both rankings into one shelf and attribute each click to its source. Far more
  sample-efficient than an A/B test, which matters when a course project cannot run for six weeks.
- **Tracking** — MLflow, or the `model_runs` table from migration `V8`. Every run records its
  parameters, metrics, seed, git commit and a hash of the dataset. Reproducibility is a gradeable
  property here, and it is cheap to buy.

---

## 8. Dependencies and containers

### 8.1 Python dependencies, by role

| Role | Packages | Notes |
| --- | --- | --- |
| Data and I/O | pandas, numpy, pyarrow, SQLAlchemy, psycopg, pydantic-settings | Parquet interchange; the settings object from §2.3 |
| Association rules | **mlxtend (pinned)**, efficient-apriori | The pin is deliberate — see the churn warning in §3.3. The second package is an independent cross-check of the itemsets. |
| Embeddings | gensim, scikit-learn, sentence-transformers, torch, spaCy | scikit-learn also supplies the TF-IDF baseline and the exact-search oracle |
| Vector search | pgvector client, faiss-cpu | faiss is optional; drop it first if a wheel refuses to resolve |
| Ranking (optional) | LightGBM, implicit | Only needed for variants M5 and the optional CF signal |
| Serving | FastAPI, uvicorn | Option B only |
| Tracking and figures | MLflow, matplotlib, seaborn, umap-learn | The projection figure in §4.6 |
| Dev | JupyterLab, ipykernel, pytest, ruff, mypy | The notebooks and the quality gates |

Record **exact resolved versions in notebook 01** and commit the lockfile — that lockfile is the
reproducibility claim. If a wheel refuses to resolve, drop the optional groups (faiss, LightGBM,
implicit) before downgrading Python; pgvector plus scikit-learn covers the core lab.

### 8.2 Container changes

| Compose service | Change | Note |
| --- | --- | --- |
| `db` | Swap to a PostgreSQL 16 image that ships the vector extension | Required before migration `V6` can run |
| `trainer` | New, run on demand and exits; builds from `ml/` | Reads the same database URL; waits for the database to be healthy |
| `recsys` | New, long-lived; serves the FastAPI app | **Option B only** |

Both new services sit behind a compose profile, so the default startup still brings up only the
database and the migration runner.

### 8.3 Pipeline commands

The package exposes one CLI whose stages match §2.2, so the whole thing is runnable outside a
notebook:

| Stage | Does |
| --- | --- |
| extract | Database → parquet; this is what documents the dataset |
| synth | Seeded synthetic basket generation |
| arm | Frequent itemsets → rules → publish to the rules table |
| embed | Corpus → vectors → publish to the embedding table |
| eval | Runs the ablation grid and persists the metrics |
| all | Every stage above, in dependency order |

---

## 9. Four-week delivery plan mapped to the rubric

The assignment requires **two essays** (at least 1,000 words each), **one lab**, and **four weekly
journals**. Recommended mapping: essays on **Association Rules Mining** and **Word Embedding**; the
lab is the **hybrid Recommender System** that consumes both — which makes the third topic the
integrating narrative rather than a third, unbudgeted essay.

| Week | Build | Essay / writing | Journal answers "what was hard" |
| --- | --- | --- | --- |
| **1** | `ml/` scaffold; extraction; synthetic generator and the `V4` seed; notebook 01 (dataset and exploratory analysis) | ARM essay: problem, core concepts, support / confidence / lift / leverage / conviction | Why three seed orders cannot be mined; choosing synthetic versus public data |
| **2** | Apriori versus FP-Growth; threshold sensitivity; `V5` and the published rules; notebook 02 | ARM essay: algorithms, complexity, applications, pros and cons, the confidence trap | Threshold selection; pruning spurious rules |
| **3** | Corpus; TF-IDF baseline; Word2Vec and FastText; SBERT; Prod2Vec; `V6` and pgvector; notebook 03 | Word Embedding essay: the distributional hypothesis, skip-gram versus CBOW, negative sampling, static versus contextual embeddings | The tiny-corpus limits of Word2Vec; why pretrained wins here |
| **4** | Fusion, filters and diversity; Express integration; `V7` impressions and the click event; notebooks 04–05; the ablation table | Both essays finished; lab report: problem statement, dataset, implementation, output analysis | The accuracy-versus-coverage trade-off; what the ablation actually showed |

**Rubric coverage check:**

| Rubric row | Weight | Where it is earned |
| --- | --- | --- |
| Weekly reports — discipline | 10% | Four journals, submitted on time |
| Weekly reports — reflection quality | 10% | The "what was hard" column above, written honestly |
| Essays — knowledge and content | 15% | §3.1, §4.2 and §5.1 give the concept scaffolding |
| Essays — extension ability | 15% | §1.1 real-world architectures; §3.7 non-retail ARM; the distributed-scale paragraph |
| Essays — presentation and references | 10% | §10 reference list; the figures specified in §3.4 and §4.6 |
| Lab — problem design | 10% | "Complete-the-basket recommendation for a live storefront", grounded in a running system |
| Lab — implementation | 15% | The `ml/` package, the notebooks, and the Express integration |
| Lab — result evaluation | 15% | §5.3 ablation, §7 metrics, and the recovered-planted-rules check |

---

## 10. Version matrix and references

### 10.1 Versions

| Component | Target | Notes |
| --- | --- | --- |
| Python | 3.12.x | Not 3.13 — wheel coverage (§2.1) |
| pandas / numpy / pyarrow | current stable | Parquet interchange |
| mlxtend | **pinned** | The rule-derivation signature changed across releases (§3.3) |
| gensim | 4.3.x | Word2Vec, FastText, Prod2Vec |
| sentence-transformers | current stable | `all-MiniLM-L6-v2` → 384 dimensions, normalised |
| scikit-learn | current stable | TF-IDF baseline, exact-search oracle, metrics |
| pgvector | 0.7 or newer | HNSW index; requires a PostgreSQL image carrying the extension |
| faiss-cpu | current stable | Optional; notebook experiments |
| LightGBM | current stable | Optional learning-to-rank |
| FastAPI / uvicorn / pydantic | current stable | Option B service |
| MLflow | current stable | Experiment tracking |
| PostgreSQL | 16 | Shared with the API |
| Node / TypeScript / Prisma | 20+ / 5.7 / 6.19 | The existing API, unchanged |

Treat this table as the intent and the lockfile as the fact: resolve, lock, and record the resolved
versions in notebook 01.

### 10.2 References

**Association rule mining**
- Agrawal, R. & Srikant, R. (1994). *Fast Algorithms for Mining Association Rules in Large Databases.* VLDB. — Apriori.
- Han, J., Pei, J. & Yin, Y. (2000). *Mining Frequent Patterns without Candidate Generation.* SIGMOD. — FP-Growth.
- Brin, S., Motwani, R. & Silverstein, C. (1997). *Beyond Market Baskets: Generalizing Association Rules to Correlations.* SIGMOD. — lift and conviction.
- Tan, P.-N., Steinbach, M. & Kumar, V. *Introduction to Data Mining*, ch. 5–6. — the standard textbook treatment.

**Word embeddings**
- Mikolov, T. et al. (2013). *Efficient Estimation of Word Representations in Vector Space*; and *Distributed Representations of Words and Phrases and their Compositionality.* — Word2Vec, negative sampling.
- Bojanowski, P. et al. (2017). *Enriching Word Vectors with Subword Information.* TACL. — FastText.
- Pennington, J., Socher, R. & Manning, C. (2014). *GloVe: Global Vectors for Word Representation.* EMNLP.
- Arora, S., Liang, Y. & Ma, T. (2017). *A Simple but Tough-to-Beat Baseline for Sentence Embeddings.* ICLR. — SIF pooling.
- Reimers, N. & Gurevych, I. (2019). *Sentence-BERT.* EMNLP.

**Recommender systems**
- Linden, G., Smith, B. & York, J. (2003). *Amazon.com Recommendations: Item-to-Item Collaborative Filtering.* IEEE Internet Computing.
- Covington, P., Adams, J. & Sargin, E. (2016). *Deep Neural Networks for YouTube Recommendations.* RecSys. — two-stage retrieval.
- Grbovic, M. et al. (2015). *E-commerce in Your Inbox: Product Recommendations at Scale.* KDD. — Prod2Vec.
- Grbovic, M. & Cheng, H. (2018). *Real-time Personalization using Embeddings for Search Ranking at Airbnb.* KDD.
- Cormack, G., Clarke, C. & Büttcher, S. (2009). *Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods.* SIGIR.
- Carbonell, J. & Goldstein, J. (1998). *The Use of MMR, Diversity-Based Reranking for Reordering Documents.* SIGIR.
- Ricci, F., Rokach, L. & Shapira, B. (eds.). *Recommender Systems Handbook.*
- Netflix Technology Blog (2013). *System Architectures for Personalization and Recommendation.* — the offline/nearline/online split.

**Tools**
- mlxtend — https://rasbt.github.io/mlxtend/
- gensim — https://radimrehurek.com/gensim/
- sentence-transformers — https://www.sbert.net/
- pgvector — https://github.com/pgvector/pgvector
