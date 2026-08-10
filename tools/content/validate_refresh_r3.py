#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))

def public_path(path):
    return ROOT / path.lstrip("/")

# Regression guards for the established Core/Reading bank.
core = load("aptis/data/manifest.json")
reading = load("aptis/data/reading-manifest.json")
assert core["total_item_count"] == 2696
assert core["grammar_count"] == 1000 and core["vocabulary_count"] == 1000
assert reading["test_count"] == 24 and reading["item_count"] == 696

# Writing R3: five additional original full tests.
widx = load("aptis/data/writing/r3/index.json")
assert widx["release"]["release_id"] == "WR-2026.08-R3"
assert len(widx["test_files"]) == 5
wtests = [load(path.lstrip("/")) for path in widx["test_files"]]
assert [t["test_id"] for t in wtests] == [f"WT{i:02d}" for i in range(11, 16)]
assert sum(len(t["tasks"]) for t in wtests) == 25
for test in wtests:
    assert test["status"] == "PUBLISHED_FINAL"
    assert [task["part"] for task in test["tasks"]] == [1, 2, 3, 4, 4]
    assert "Original ForLanguage" in test["source_note"]
    for task in test["tasks"]:
        assert task["status"] == "PUBLISHED_FINAL"
        assert "no official or recalled prompt copied verbatim" in task["review_note"]
    p2 = next(t for t in test["tasks"] if t["part"] == 2)
    p3 = next(t for t in test["tasks"] if t["part"] == 3)
    p4a, p4b = [t for t in test["tasks"] if t["part"] == 4]
    assert (p2["min_words"], p2["max_words"]) == (20, 30)
    assert (p3["min_words"], p3["max_words"]) == (30, 40)
    assert (p4a["min_words"], p4a["max_words"]) == (40, 50)
    assert (p4b["min_words"], p4b["max_words"]) == (120, 150)

# Speaking R3: five additional tests and seven new original images.
sbase = load("aptis/data/speaking/bank-v2.json")
sidx = load("aptis/data/speaking/r3/index.json")
assert sidx["release"]["release_id"] == "SPK-2026.08-R3"
assert len(sidx["test_files"]) == 5 and len(sidx["images"]) == 7
base_image_ids = {row["image_id"] for row in sbase.get("images", [])}
addon_image_ids = {row["image_id"] for row in sidx["images"]}
all_image_ids = base_image_ids | addon_image_ids
for image in sidx["images"]:
    path = public_path(image["file_path"])
    assert path.exists(), path
    assert hashlib.sha256(path.read_bytes()).hexdigest() == image["checksum"]
    assert image["license"] == "CC0-1.0"
stests = [load(path.lstrip("/")) for path in sidx["test_files"]]
assert [t["test_id"] for t in stests] == [f"ST{i:02d}" for i in range(6, 11)]
assert sum(len(t["tasks"]) for t in stests) == 50
for test in stests:
    assert len(test["tasks"]) == 10
    assert [t["part"] for t in test["tasks"]].count(1) == 3
    assert [t["part"] for t in test["tasks"]].count(2) == 3
    assert [t["part"] for t in test["tasks"]].count(3) == 3
    assert [t["part"] for t in test["tasks"]].count(4) == 1
    assert "No official or recalled prompt was copied verbatim" in test["source_note"]
    for task in test["tasks"]:
        assert set(task.get("image_ids", [])).issubset(all_image_ids)
        assert task["response_seconds"] == ({1:30, 2:45, 3:45, 4:120}[task["part"]])
        assert task["preparation_seconds"] == (60 if task["part"] == 4 else 0)

# Listening Batch 1: two original full tests, each 17 tasks / 25 answer slots.
lidx = load("aptis/data/listening/r2/index.json")
assert lidx["release"]["release_id"] == "LST-2026.08-R2"
assert len(lidx["tests"]) == 2
for meta in lidx["tests"]:
    tasks = []
    for path in meta["task_files"]:
        tasks.extend(load(path.lstrip("/")))
    tasks.sort(key=lambda row: row["display_order"])
    assert [t["display_order"] for t in tasks] == list(range(1, 18))
    assert [t["part"] for t in tasks].count(1) == 13
    assert [t["part"] for t in tasks].count(2) == 1
    assert [t["part"] for t in tasks].count(3) == 1
    assert [t["part"] for t in tasks].count(4) == 2
    assert all(t["max_plays"] == 2 for t in tasks)
    assert sum(len(t["items"]) for t in tasks) == 25
    for task in tasks:
        assert task["status"] if "status" in task else True
        assert "no recalled or official recording copied" in task["audio"]["source"]
        if task["part"] == 1:
            assert len(task["items"]) == 1 and len(task["items"][0]["options"]) == 3
        if task["part"] == 2:
            assert len(task["items"]) == 4 and all(len(i["options"]) == 6 for i in task["items"])
        if task["part"] == 3:
            assert len(task["items"]) == 4 and all(i["options"] == ["Man", "Woman", "Both"] for i in task["items"])
        if task["part"] == 4:
            assert len(task["items"]) == 2 and all(len(i["options"]) == 3 for i in task["items"])

manifest = load("aptis/data/listening/manifest-v1.json")
assert manifest["test_count"] == 4 and manifest["full_test_count"] == 2
assert manifest["task_count"] == 39 and manifest["item_count"] == 58
assert manifest["audio_status"] == "BROWSER_TTS_FALLBACK"

registry = load("aptis/module-registry-v6.json")
modules = {item["id"]: item for item in registry["modules"]}
assert registry["phase"] == "M6.8C"
assert modules["writing"]["bank_counts"]["tests"] == 15
assert modules["speaking"]["bank_counts"]["tests"] == 10
assert modules["listening"]["status"] == "content_batch_1"
assert modules["listening"]["bank_counts"]["full_tests"] == 2

print("Content Refresh R3 / Listening Batch 1 OK: Core 2696, Reading 24, Writing 15, Speaking 10, Listening 2 full tests")
