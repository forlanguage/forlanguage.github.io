#!/usr/bin/env python3
"""Validate the ForLanguage Aptis Writing bank v2 without external packages."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = ROOT / "aptis/data/writing/bank-v2.json"
MANIFEST_PATH = ROOT / "aptis/data/writing/manifest-v2.json"

TEST_ID = re.compile(r"^WT\d{2,3}$")
TASK_ID = re.compile(r"^WT\d{2,3}-P[1-4](?:A|B)?$")
TOPIC_ID = re.compile(r"^WR-TOP-[A-Z0-9-]+$")
RUBRIC_ID = re.compile(r"^WR-RUB-[A-Z0-9-]+$")
PUBLIC = {"PUBLISHED_DEMO", "PUBLISHED_FINAL"}
EXPECTED_TYPES = {
    1: {"short_answers"},
    2: {"short_message"},
    3: {"social_responses"},
    4: {"informal_email", "formal_email"},
}


def fail(message: str) -> None:
    raise AssertionError(message)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    bank = load(BANK_PATH)
    manifest = load(MANIFEST_PATH)
    assert bank["schema_version"] == "2.0.0"
    assert manifest["schema_version"] == "2.0.0"
    assert bank["release"]["release_id"] == manifest["release_id"]

    topic_ids = set()
    for topic in bank["topics"]:
        tid = topic["topic_id"]
        assert TOPIC_ID.fullmatch(tid), f"invalid topic ID: {tid}"
        assert tid not in topic_ids, f"duplicate topic ID: {tid}"
        topic_ids.add(tid)

    rubric_ids = set()
    for rubric in bank["rubrics"]:
        rid = rubric["rubric_id"]
        assert RUBRIC_ID.fullmatch(rid), f"invalid rubric ID: {rid}"
        assert rid not in rubric_ids, f"duplicate rubric ID: {rid}"
        rubric_ids.add(rid)
        assert len(set(rubric["dimensions"])) == len(rubric["dimensions"])

    test_ids, task_ids = set(), set()
    task_count = 0
    for test in bank["tests"]:
        test_id = test["test_id"]
        assert TEST_ID.fullmatch(test_id), f"invalid test ID: {test_id}"
        assert test_id not in test_ids, f"duplicate test ID: {test_id}"
        test_ids.add(test_id)
        assert test["topic_id"] in topic_ids, f"unknown topic: {test['topic_id']}"
        assert test["rubric_id"] in rubric_ids, f"unknown rubric: {test['rubric_id']}"
        assert test["status"] in PUBLIC, f"non-public test in public bank: {test_id}"
        assert len(test["tasks"]) == 5, f"{test_id} must contain exactly five task records"

        part_types = {1: [], 2: [], 3: [], 4: []}
        for task in test["tasks"]:
            task_id = task["task_id"]
            assert TASK_ID.fullmatch(task_id), f"invalid task ID: {task_id}"
            assert task_id.startswith(test_id + "-"), f"task/test mismatch: {task_id}"
            assert task_id not in task_ids, f"duplicate task ID: {task_id}"
            task_ids.add(task_id)
            task_count += 1
            part = task["part"]
            part_types[part].append(task["type"])
            assert task["type"] in EXPECTED_TYPES[part], f"wrong type for {task_id}"
            assert task["min_words"] <= task["max_words"], f"invalid word range: {task_id}"
            assert task["status"] in PUBLIC, f"non-public task in public bank: {task_id}"
            if task["type"] == "short_answers":
                assert len(task.get("questions", [])) == 5, f"{task_id} requires five questions"
            if task["type"] == "social_responses":
                assert len(task.get("questions", [])) == 3, f"{task_id} requires three questions"

        assert part_types[1] == ["short_answers"]
        assert part_types[2] == ["short_message"]
        assert part_types[3] == ["social_responses"]
        assert sorted(part_types[4]) == ["formal_email", "informal_email"]

    assert manifest["test_count"] == len(test_ids)
    assert manifest["task_count"] == task_count
    assert manifest["topic_count"] == len(topic_ids)
    assert manifest["rubric_count"] == len(rubric_ids)
    assert set(manifest["compatibility"]["preserved_test_ids"]) <= test_ids
    print(f"Writing bank v2 OK: {len(test_ids)} tests, {task_count} tasks, {len(topic_ids)} topics")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, TypeError, ValueError) as error:
        print(f"Writing bank validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
