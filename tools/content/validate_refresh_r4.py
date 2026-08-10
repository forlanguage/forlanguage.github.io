#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))

def exists_public(path):
    return (ROOT / path.lstrip("/")).exists()

def asserts_original_provenance(note):
    lower = note.lower()
    assert "original forlanguage" in lower
    assert "no recalled" in lower or "no reported" in lower

# Canonical bank stays unchanged.
core = load("aptis/data/manifest.json")
reading = load("aptis/data/reading-manifest.json")
assert core["grammar_count"] == 1000
assert core["vocabulary_count"] == 1000
assert core["reading_count"] == 696
assert core["total_item_count"] == 2696
assert core["reading_test_count"] == 24
assert reading["item_count"] == 696 and reading["test_count"] == 24

# Supplemental high-yield bank.
hy = load("aptis/data/targeted/high-yield-v1.json")
assert hy["schema_version"] == "1.0.0"
assert hy["release"]["release_id"] == "HY-2026.08-R1"
assert hy["release"]["status"] == "PUBLISHED_FINAL"
assert len(hy["grammar"]) == 30
assert len(hy["vocabulary"]) == 10
assert len(hy["reading_part2"]) == 4
assert len(hy["reading_part3"]) == 2

mcq = hy["grammar"] + hy["vocabulary"]
ids = [item["id"] for item in mcq]
assert len(ids) == len(set(ids))
for item in mcq:
    assert len(item["options"]) == 3
    assert item["answer"] in {"A", "B", "C"}
    assert item["explanation_vi"].strip()
    assert item.get("signal")

for block in hy["reading_part2"]:
    assert len(block["sentences"]) == 5
    labels = set(block["sentences"])
    order = block["answer_order"]
    assert len(order) == 5 and len(set(order)) == 5 and set(order) == labels
    assert block["explanation_vi"].strip()

for block in hy["reading_part3"]:
    people = block["people"]
    statements = block["statements"]
    labels = {p["label"] for p in people}
    assert labels == {"A", "B", "C"}
    assert len(statements) == 7
    assert all(q["answer"] in labels for q in statements)
    assert all(q["paraphrase"].strip() for q in statements)

for rel in ["aptis/targeted/index.html", "aptis/targeted/targeted-v1.css", "aptis/targeted/targeted-v1.js"]:
    assert (ROOT / rel).exists(), rel

# Writing R4.
widx = load("aptis/data/writing/r4/index.json")
assert widx["release"]["release_id"] == "WR-2026.08-R4"
assert len(widx["test_files"]) == 5
wtests = [load(path.lstrip("/")) for path in widx["test_files"]]
assert [t["test_id"] for t in wtests] == [f"WT{i:02d}" for i in range(16, 21)]
for test in wtests:
    assert test["status"] == "PUBLISHED_FINAL"
    asserts_original_provenance(test["source_note"])
    assert [task["part"] for task in test["tasks"]] == [1, 2, 3, 4, 4]
    p2 = next(t for t in test["tasks"] if t["part"] == 2)
    p3 = next(t for t in test["tasks"] if t["part"] == 3)
    p4 = [t for t in test["tasks"] if t["part"] == 4]
    assert (p2["min_words"], p2["max_words"]) == (20, 30)
    assert (p3["min_words"], p3["max_words"]) == (30, 40)
    assert (p4[0]["min_words"], p4[0]["max_words"]) == (40, 50)
    assert (p4[1]["min_words"], p4[1]["max_words"]) == (120, 150)
    assert all(task["status"] == "PUBLISHED_FINAL" for task in test["tasks"])

# Speaking R4. Image IDs can refer to base, R3, or R4 registries.
sbase = load("aptis/data/speaking/bank-v2.json")
sr3 = load("aptis/data/speaking/r3/index.json")
sr4 = load("aptis/data/speaking/r4/index.json")
assert sr4["release"]["release_id"] == "SPK-2026.08-R4"
assert len(sr4["test_files"]) == 5 and len(sr4["images"]) == 3
all_image_ids = {row["image_id"] for row in sbase.get("images", [])}
all_image_ids |= {row["image_id"] for row in sr3.get("images", [])}
all_image_ids |= {row["image_id"] for row in sr4.get("images", [])}
for image in sr4["images"]:
    assert image["license"] == "CC0-1.0"
    assert image["source"].startswith("ForLanguage original")
    assert exists_public(image["file_path"]), image["file_path"]

stests = [load(path.lstrip("/")) for path in sr4["test_files"]]
assert [t["test_id"] for t in stests] == [f"ST{i:02d}" for i in range(11, 16)]
for test in stests:
    assert test["status"] == "PUBLISHED_FINAL"
    asserts_original_provenance(test["source_note"])
    parts = [t["part"] for t in test["tasks"]]
    assert len(parts) == 10
    assert parts.count(1) == 3 and parts.count(2) == 3 and parts.count(3) == 3 and parts.count(4) == 1
    for task in test["tasks"]:
        assert set(task.get("image_ids", [])).issubset(all_image_ids)
        assert task["response_seconds"] == {1:30, 2:45, 3:45, 4:120}[task["part"]]
        assert task["preparation_seconds"] == (60 if task["part"] == 4 else 0)

# Registry and deliberate Listening freeze.
registry = load("aptis/module-registry-v6.json")
modules = {item["id"]: item for item in registry["modules"]}
assert registry["version"] == "6.0.0-beta.15"
assert registry["phase"] == "M6.8D"
assert modules["targeted"]["status"] == "available"
assert modules["targeted"]["bank_counts"] == {"grammar":30,"vocabulary":10,"reading_part2_sets":4,"reading_part3_sets":2}
assert modules["writing"]["release_id"] == "WR-2026.08-R4"
assert modules["writing"]["bank_counts"]["tests"] == 20
assert modules["writing"]["bank_counts"]["tasks"] == 100
assert modules["speaking"]["release_id"] == "SPK-2026.08-R4"
assert modules["speaking"]["bank_counts"]["tests"] == 15
assert modules["speaking"]["bank_counts"]["tasks"] == 150
assert modules["listening"]["release_id"] == "LST-2026.08-R2"
assert modules["listening"]["status"] == "content_batch_1"
assert modules["listening"]["bank_counts"]["full_tests"] == 2

print("M6.8D OK: canonical Core/Reading unchanged; High-Yield 40 MCQ + 6 Reading sets; Writing 20; Speaking 15; Listening frozen at R2")
