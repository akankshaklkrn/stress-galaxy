import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.impute import SimpleImputer
from sklearn.metrics.pairwise import cosine_similarity
import umap
import warnings
warnings.filterwarnings("ignore")

RAW_PATH       = "data/raw/stress_data.csv"
WORKERS_OUT    = "data/processed/workers.json"
CLUSTERS_OUT   = "data/processed/clusters.json"
SIMILARITY_OUT = "data/processed/similarity.json"

df = pd.read_csv(RAW_PATH)
print(f"Loaded {df.shape[0]} rows x {df.shape[1]} columns")

FREQ_5  = {"Never":1,"Sometimes":2,"Regularly":3,"Often":4,"Very often":5}
AGREE_5 = {"Strongly disagree":1,"Disagree":2,"Neutral":3,"Agree":4,"Strongly agree":5}
DASS_4  = {"Did not apply to me at all":1,"Applied to me to some degree, or some of the time":2,"Applied to me to a considerable degree or a good part of the time":3,"Applied to me very much or most of the time":4}
EE_7    = {"Never":1,"A few times per year":2,"Once a month":3,"A few times per month":4,"Once a week":5,"A few times per week":6,"Every day":7}
WB_6    = {"At no time":1,"Some of the time":2,"Less than half of the time":3,"More than half of the time":4,"Most of the time":5,"All of the time":6}
SFQ_4   = {"Not at all":1,"No more than usual":2,"Worse than usual":3,"Much more than usual":4}
SE_4    = {"Absolutely wrong":1,"Barely right":2,"Somewhat right":3,"Absolutely right":4}
OPTIM_5 = {"Totally disagree":1,"Disagree":2,"Neutral":3,"Agree":4,"Totally agree":5}
AGREE_4 = {"Strongly disagree":1,"Disagree":2,"Agree":3,"Strongly agree":4}
FIT_7   = {"No match":1,"Slight match":2,"Moderate match":3,"Somewhat match":4,"Good match":5,"Strong match":6,"Complete match":7}
CORS_5  = {"Great Loss":1,"Some Loss":2,"No Change":3,"Some Gain":4,"Great Gain":5}
ELT_7   = {"Strongly disagree":1,"Disagree":2,"Somewhat disagree":3,"Neutral":4,"Somewhat agree":5,"Agree":6,"Strongly agree":7}

def apply_map(df, cols, mapping):
    for col in cols:
        if col in df.columns:
            df[col] = df[col].map(mapping)
    return df

df = apply_map(df, [f"wp{i}" for i in range(1,5)] + [f"cogn{i}" for i in range(1,5)] + [f"emo{i}" for i in range(1,7)] + [f"auto{i}" for i in range(1,4)] + [f"soc{i}" for i in range(1,4)] + [f"feedb{i}" for i in range(1,4)] + [f"coach{i}" for i in range(1,6)], FREQ_5)
df = apply_map(df, [f"rolcon{i}" for i in range(1,5)] + [f"hassle{i}" for i in range(1,6)] + [f"SS{i}" for i in range(1,4)] + [f"CS{i}" for i in range(1,4)] + [f"OS{i}" for i in range(1,4)] + [f"FS{i}" for i in range(1,4)] + [f"auton{i}" for i in range(1,4)] + [f"comp{i}" for i in range(1,4)] + [f"Relat{i}" for i in range(1,4)], AGREE_5)
df = apply_map(df, [f"S{i}" for i in range(1,6)] + [f"A{i}" for i in range(1,6)] + [f"D{i}" for i in range(1,5)], DASS_4)
df = apply_map(df, [f"EE{i}" for i in range(1,8)], EE_7)
df = apply_map(df, [f"WB{i}" for i in range(1,6)], WB_6)
df = apply_map(df, [f"SFQ{i}" for i in range(1,10)], SFQ_4)
df = apply_map(df, [f"SE{i}" for i in range(1,5)], SE_4)
df = apply_map(df, [f"optim{i}" for i in range(1,5)], OPTIM_5)
df = apply_map(df, [f"ERI{i}" for i in range(1,11)] + [f"OC{i}" for i in range(1,7)], AGREE_4)
df = apply_map(df, [f"PJF{i}" for i in range(1,5)] + [f"POF{i}" for i in range(1,5)] + [f"PSF{i}" for i in range(1,6)], FIT_7)
df = apply_map(df, [f"CORS{i}" for i in range(1,7)], CORS_5)
df = apply_map(df, [f"ELT{i}" for i in range(1,5)], ELT_7)
for col in [f"CAS{i}" for i in range(1,13)]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

cat_cols = ["Age","Gender","Industry","JobRole","Region","WorkLocation","AccessMH"]
for col in cat_cols:
    df[col] = df[col].fillna(df[col].mode()[0])

numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
df[numeric_cols] = SimpleImputer(strategy="median").fit_transform(df[numeric_cols])

df = df.copy()

df["stress_index"]       = df[[f"S{i}" for i in range(1,6)]].mean(axis=1)
df["burnout_index"]      = df[[f"EE{i}" for i in range(1,8)]].mean(axis=1)
df["wellbeing_index"]    = df[[f"WB{i}" for i in range(1,6)]].mean(axis=1)
df["wellbeing_distress"] = df["wellbeing_index"].max() - df["wellbeing_index"]
df["sleep_strain_index"] = df[[f"SFQ{i}" for i in range(1,10)]].mean(axis=1)
df["demands_index"]      = df[[f"wp{i}" for i in range(1,5)] + [f"cogn{i}" for i in range(1,5)] + [f"emo{i}" for i in range(1,7)] + [f"rolcon{i}" for i in range(1,5)]].mean(axis=1)
df["resources_index"]    = df[[f"auto{i}" for i in range(1,4)] + [f"soc{i}" for i in range(1,4)] + [f"feedb{i}" for i in range(1,4)] + [f"coach{i}" for i in range(1,6)] + [f"auton{i}" for i in range(1,4)] + [f"comp{i}" for i in range(1,4)] + [f"Relat{i}" for i in range(1,4)]].mean(axis=1)

INDEX_COLS = ["stress_index","burnout_index","wellbeing_distress","sleep_strain_index","demands_index","resources_index"]

scaler = StandardScaler()
indices_scaled = scaler.fit_transform(df[INDEX_COLS])

print("Running UMAP...")
reducer = umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
embedding = reducer.fit_transform(indices_scaled)
df["umap_x"] = embedding[:, 0]
df["umap_y"] = embedding[:, 1]

print("Finding best K...")
sil_scores = {}
for k in range(3, 9):
    labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(indices_scaled)
    sil_scores[k] = round(silhouette_score(indices_scaled, labels), 4)
    print(f"  k={k}: silhouette={sil_scores[k]}")

best_k = max(sil_scores, key=sil_scores.get)
print(f"Best K = {best_k}")

km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
df["cluster"] = km_final.fit_predict(indices_scaled)

# Hardcoded based on actual cluster profiles from real data:
#   Cluster 0: stress=2.67  burnout=4.11  demands=3.45  resources=3.26  age=26-45  location=Onsite/Hybrid
#   Cluster 1: stress=3.05  burnout=2.74  demands=3.07  resources=2.76  age=18-35  location=Onsite
#   Cluster 2: stress=1.79  burnout=5.19  demands=2.54  resources=3.02  age=46-56+  location=Remote
cluster_name_map = {
    0: "Burning Mid-Career Professionals",
    1: "Overworked Young & Unsupported",
    2: "Stable Seniors, Hidden Exhaustion",
}

cluster_color_map = {
    0: "#FFD166",   # gold  — mid-level burnout warning, mid-career
    1: "#FF6B9D",   # pink  — highest stress, youngest and most at-risk
    2: "#00D4FF",   # cyan  — stable tone, senior workers
}

df["cluster_name"] = df["cluster"].map(cluster_name_map)

for cid, name in cluster_name_map.items():
    n = (df["cluster"] == cid).sum()
    print(f"  Cluster {cid} ({n} workers): {name}")

print("Computing similarity...")
sim_matrix = cosine_similarity(indices_scaled)
neighbors = {}
for i in range(len(sim_matrix)):
    row = sim_matrix[i].copy()
    row[i] = -1
    neighbors[i] = np.argsort(row)[::-1][:5].tolist()

workers = []
for i, row in df.iterrows():
    workers.append({
        "id":            int(i),
        "x":             round(float(row["umap_x"]), 4),
        "y":             round(float(row["umap_y"]), 4),
        "cluster":       int(row["cluster"]),
        "cluster_name":  row["cluster_name"],
        "stress":        round(float(row["stress_index"]), 3),
        "burnout":       round(float(row["burnout_index"]), 3),
        "wellbeing":     round(float(row["wellbeing_index"]), 3),
        "sleep_strain":  round(float(row["sleep_strain_index"]), 3),
        "demands":       round(float(row["demands_index"]), 3),
        "resources":     round(float(row["resources_index"]), 3),
        "age":           str(row["Age"]),
        "gender":        str(row["Gender"]),
        "industry":      str(row["Industry"]),
        "job_role":      str(row["JobRole"]),
        "region":        str(row["Region"]),
        "work_location": str(row["WorkLocation"]),
        "access_mh":     str(row["AccessMH"]),
        "neighbors":     neighbors[i],
    })

clusters_out = []
for cid, name in cluster_name_map.items():
    group = df[df["cluster"] == cid]
    clusters_out.append({
        "id":                int(cid),
        "name":              name,
        "color":             cluster_color_map[cid],
        "count":             int(len(group)),
        "centroid_x":        round(float(group["umap_x"].mean()), 4),
        "centroid_y":        round(float(group["umap_y"].mean()), 4),
        "avg_stress":        round(float(group["stress_index"].mean()), 3),
        "avg_burnout":       round(float(group["burnout_index"].mean()), 3),
        "avg_wellbeing":     round(float(group["wellbeing_index"].mean()), 3),
        "avg_sleep_strain":  round(float(group["sleep_strain_index"].mean()), 3),
        "avg_demands":       round(float(group["demands_index"].mean()), 3),
        "avg_resources":     round(float(group["resources_index"].mean()), 3),
        "industry_breakdown": group["Industry"].value_counts().to_dict(),
        "age_breakdown":      group["Age"].value_counts().to_dict(),
        "location_breakdown": group["WorkLocation"].value_counts().to_dict(),
    })

with open(WORKERS_OUT, "w") as f:
    json.dump(workers, f, separators=(",", ":"))

with open(CLUSTERS_OUT, "w") as f:
    json.dump(clusters_out, f, indent=2)

with open(SIMILARITY_OUT, "w") as f:
    json.dump(neighbors, f, separators=(",", ":"))

print(f"Done. workers.json: {len(workers)} | clusters.json: {len(clusters_out)} | similarity.json: {len(neighbors)}")
