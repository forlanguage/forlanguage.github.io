#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / "aptis/data/listening/bank-v1.json"
MANIFEST = ROOT / "aptis/data/listening/manifest-v1.json"

bank = json.loads(BANK.read_text(encoding="utf-8"))
manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

seen_tests, seen_tasks, seen_audio, seen_items = set(), set(), set(), set()
counts = {"tests": 0, "tasks": 0, "audio": 0, "items": 0}

for test in bank.get("tests", []):
    test_id = test["test_id"]
    assert re.fullmatch(r"LT\d{2}", test_id), test_id
    assert test_id not in seen_tests, f"duplicate {test_id}"
    seen_tests.add(test_id)
    counts["tests"] += 1
    for task in test.get("tasks", []):
        task_id = task["task_id"]
        assert re.fullmatch(r"LT\d{2}-T\d{2}", task_id), task_id
        assert task_id not in seen_tasks, f"duplicate {task_id}"
        assert task["part"] in (1, 2, 3, 4)
        assert task["max_plays"] in (1, 2)
        seen_tasks.add(task_id)
        counts["tasks"] += 1
        audio = task["audio"]
        audio_id = audio["audio_id"]
        assert re.fullmatch(r"LT\d{2}-A\d{2}", audio_id), audio_id
        assert audio_id not in seen_audio, f"duplicate {audio_id}"
        assert audio.get("transcript"), f"missing transcript {audio_id}"
        assert audio.get("source") and audio.get("license"), f"missing provenance {audio_id}"
        seen_audio.add(audio_id)
        counts["audio"] += 1
        for item in task.get("items", []):
            item_id = item["item_id"]
            assert re.fullmatch(r"L\d{4}", item_id), item_id
            assert item_id not in seen_items, f"duplicate {item_id}"
            assert item["correct"] in "ABCDEFGHIJ"
            assert len(item.get("options", [])) >= 2
            seen_items.add(item_id)
            counts["items"] += 1

assert counts["tests"] == manifest["test_count"], counts
assert counts["tasks"] == manifest["task_count"], counts
assert counts["audio"] == manifest["audio_count"], counts
assert counts["items"] == manifest["item_count"], counts
assert manifest["published_test_count"] == sum(t.get("status") == "PUBLISHED_FINAL" for t in bank["tests"])

print(json.dumps({"status": "ok", **counts}, indent=2))
