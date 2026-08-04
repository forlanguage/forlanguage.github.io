#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BANK=ROOT/'aptis/data/speaking/bank-v2.json';MANIFEST=ROOT/'aptis/data/speaking/manifest-v2.json'
TEST=re.compile(r'^ST\d{2,3}$');TASK=re.compile(r'^ST\d{2,3}-P[1-4]-Q\d+$');TOPIC=re.compile(r'^SPK-TOP-[A-Z0-9-]+$');RUBRIC=re.compile(r'^SPK-RUB-[A-Z0-9-]+$');IMAGE=re.compile(r'^SPK-IMG-[A-Z0-9-]+$');PUBLIC={'PUBLISHED_DEMO','PUBLISHED_FINAL'}
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def main():
 b=load(BANK);m=load(MANIFEST);assert b['schema_version']=='2.0.0' and m['schema_version']=='2.0.0';assert b['release']['release_id']==m['release_id']
 topics={x['topic_id'] for x in b['topics']};assert len(topics)==len(b['topics']) and all(TOPIC.fullmatch(x) for x in topics)
 rubrics={x['rubric_id'] for x in b['rubrics']};assert len(rubrics)==len(b['rubrics']) and all(RUBRIC.fullmatch(x) for x in rubrics)
 images={x['image_id'] for x in b['images']};assert len(images)==len(b['images']) and all(IMAGE.fullmatch(x) for x in images)
 tests=set();tasks=set();count=0
 for t in b['tests']:
  assert TEST.fullmatch(t['test_id']) and t['test_id'] not in tests;tests.add(t['test_id']);assert t['rubric_id'] in rubrics and t['status'] in PUBLIC
  parts=[]
  for q in t['tasks']:
   assert TASK.fullmatch(q['task_id']) and q['task_id'].startswith(t['test_id']+'-') and q['task_id'] not in tasks;tasks.add(q['task_id']);count+=1;parts.append(q['part'])
   assert q['topic_id'] in topics and q['status'] in PUBLIC and q['response_seconds']>0 and q['preparation_seconds']>=0
   assert set(q.get('image_ids',[]))<=images
  assert {1,2,3,4}.issubset(parts)
 assert m['test_count']==len(tests) and m['task_count']==count and m['topic_count']==len(topics) and m['rubric_count']==len(rubrics) and m['image_count']==len(images)
 print(f'Speaking bank v2 OK: {len(tests)} tests, {count} tasks, {len(images)} images')
if __name__=='__main__':
 try:main()
 except (AssertionError,KeyError,TypeError,ValueError) as e:print(f'Speaking bank validation failed: {e}',file=sys.stderr);raise SystemExit(1)
