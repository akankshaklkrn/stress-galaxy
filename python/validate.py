import json
import numpy as np

WORKERS_PATH    = "data/processed/workers.json"
CLUSTERS_PATH   = "data/processed/clusters.json"
SIMILARITY_PATH = "data/processed/similarity.json"

PASS = "  ✅"
FAIL = "  ❌"

def check(condition, msg):
    print(f"{PASS if condition else FAIL} {msg}")
    return condition

# ─── LOAD ─────────────────────────────────────────────
print("\n=== LOADING FILES ===")
with open(WORKERS_PATH)    as f: workers    = json.load(f)
with open(CLUSTERS_PATH)   as f: clusters   = json.load(f)
with open(SIMILARITY_PATH) as f: similarity = json.load(f)
print(f"  workers.json    : {len(workers)} records")
print(f"  clusters.json   : {len(clusters)} records")
print(f"  similarity.json : {len(similarity)} records")

# ─── WORKERS ──────────────────────────────────────────
print("\n=== WORKERS.JSON ===")

check(len(workers) == 5000, f"Exactly 5000 workers (got {len(workers)})")

REQUIRED_KEYS = ["id","x","y","cluster","cluster_name","stress","burnout",
                 "wellbeing","sleep_strain","demands","resources",
                 "age","gender","industry","job_role","region",
                 "work_location","access_mh","neighbors"]

w = workers[0]
missing_keys = [k for k in REQUIRED_KEYS if k not in w]
check(len(missing_keys) == 0, f"All required keys present (missing: {missing_keys})")

ids = [w["id"] for w in workers]
check(ids == list(range(5000)), "IDs are 0-4999 with no gaps or duplicates")

xs = [w["x"] for w in workers]
ys = [w["y"] for w in workers]
check(all(isinstance(v, float) for v in xs), "All x values are floats")
check(all(isinstance(v, float) for v in ys), "All y values are floats")
check(len(set(zip(xs, ys))) == 5000, "All (x, y) coordinates are unique")

cluster_ids_in_workers = set(w["cluster"] for w in workers)
check(min(cluster_ids_in_workers) == 0, f"Cluster IDs start at 0 (min={min(cluster_ids_in_workers)})")
print(f"  ℹ️  Cluster IDs found: {sorted(cluster_ids_in_workers)}")

INDEX_FIELDS = ["stress","burnout","wellbeing","sleep_strain","demands","resources"]
for field in INDEX_FIELDS:
    vals = [w[field] for w in workers]
    has_nan  = any(v != v for v in vals)
    has_none = any(v is None for v in vals)
    in_range = all(0 < v < 10 for v in vals)
    check(not has_nan and not has_none, f"'{field}' has no NaN or None values")
    check(in_range, f"'{field}' values in plausible range (min={min(vals):.3f}, max={max(vals):.3f})")

CAT_FIELDS = {
    "age":           {"18-25","26-35","36-45","46-55","56+"},
    "gender":        {"Male","Female","Prefer not to say"},
    "work_location": {"Remote","Onsite","Hybrid"},
    "access_mh":     {"Yes","No"},
}
for field, expected in CAT_FIELDS.items():
    actual = set(w[field] for w in workers)
    check(actual <= expected, f"'{field}' contains only valid values (found: {actual})")

neighbors_ok = all(
    isinstance(w["neighbors"], list) and len(w["neighbors"]) == 5
    for w in workers
)
check(neighbors_ok, "Every worker has exactly 5 neighbors")

no_self_ref = all(
    w["id"] not in w["neighbors"]
    for w in workers
)
check(no_self_ref, "No worker references themselves as a neighbor")

# ─── CLUSTERS ─────────────────────────────────────────
print("\n=== CLUSTERS.JSON ===")

n_clusters = len(clusters)
check(2 <= n_clusters <= 8, f"Between 2-8 clusters (got {n_clusters})")

CLUSTER_KEYS = ["id","name","color","count","centroid_x","centroid_y",
                "avg_stress","avg_burnout","avg_wellbeing",
                "avg_sleep_strain","avg_demands","avg_resources",
                "industry_breakdown","age_breakdown","location_breakdown"]
for c in clusters:
    missing = [k for k in CLUSTER_KEYS if k not in c]
    check(len(missing) == 0, f"Cluster '{c.get('name','?')}' has all keys (missing: {missing})")

total_from_clusters = sum(c["count"] for c in clusters)
check(total_from_clusters == 5000, f"Cluster counts sum to 5000 (got {total_from_clusters})")

cluster_ids_in_clusters = set(c["id"] for c in clusters)
check(cluster_ids_in_workers == cluster_ids_in_clusters,
      f"Cluster IDs match between workers and clusters")

names = [c["name"] for c in clusters]
check(len(names) == len(set(names)), "All cluster names are unique")

for c in clusters:
    check(c["color"].startswith("#") and len(c["color"]) == 7,
          f"Cluster '{c['name']}' has valid hex color ({c['color']})")

print("\n  Cluster summary:")
for c in sorted(clusters, key=lambda x: x["id"]):
    print(f"    [{c['id']}] {c['name']:<35} n={c['count']:>4}  "
          f"stress={c['avg_stress']:.2f}  burnout={c['avg_burnout']:.2f}  "
          f"resources={c['avg_resources']:.2f}")

# ─── SIMILARITY ───────────────────────────────────────
print("\n=== SIMILARITY.JSON ===")

check(len(similarity) == 5000, f"Exactly 5000 entries (got {len(similarity)})")

sample_keys = list(similarity.keys())[:5]
check(all(k.isdigit() for k in sample_keys), "Keys are numeric strings (as expected from json.dump)")

all_five = all(len(v) == 5 for v in similarity.values())
check(all_five, "Every entry has exactly 5 neighbors")

no_self = all(int(k) not in v for k, v in similarity.items())
check(no_self, "No self-references in similarity")

all_valid_ids = all(
    all(0 <= n < 5000 for n in v)
    for v in similarity.values()
)
check(all_valid_ids, "All neighbor IDs are valid (0-4999)")

# ─── CROSS-FILE CHECKS ────────────────────────────────
print("\n=== CROSS-FILE CHECKS ===")

worker_neighbors = {str(w["id"]): w["neighbors"] for w in workers}
sim_sample = {k: similarity[k] for k in list(similarity.keys())[:10]}
workers_match_sim = all(
    worker_neighbors[k] == similarity[k]
    for k in list(similarity.keys())[:100]
)
check(workers_match_sim, "workers.json neighbors match similarity.json (sample of 100)")

cluster_name_map = {c["id"]: c["name"] for c in clusters}
names_match = all(
    w["cluster_name"] == cluster_name_map[w["cluster"]]
    for w in workers
)
check(names_match, "All cluster_name values in workers match clusters.json")

# ─── SUMMARY ──────────────────────────────────────────
print("\n=== QUICK STATS ===")
print(f"  Total workers       : {len(workers)}")
print(f"  Number of clusters  : {n_clusters}")
print(f"  X range             : [{min(xs):.3f}, {max(xs):.3f}]")
print(f"  Y range             : [{min(ys):.3f}, {max(ys):.3f}]")
print(f"  Stress range        : [{min(w['stress'] for w in workers):.3f}, {max(w['stress'] for w in workers):.3f}]")
print(f"  Burnout range       : [{min(w['burnout'] for w in workers):.3f}, {max(w['burnout'] for w in workers):.3f}]")
print(f"  Wellbeing range     : [{min(w['wellbeing'] for w in workers):.3f}, {max(w['wellbeing'] for w in workers):.3f}]")

age_dist = {}
for w in workers:
    age_dist[w["age"]] = age_dist.get(w["age"], 0) + 1
print(f"  Age distribution    : {dict(sorted(age_dist.items()))}")

loc_dist = {}
for w in workers:
    loc_dist[w["work_location"]] = loc_dist.get(w["work_location"], 0) + 1
print(f"  Work location dist  : {loc_dist}")

print("\nDone.\n")
