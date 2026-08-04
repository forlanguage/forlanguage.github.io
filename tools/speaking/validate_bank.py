#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BANK=ROOT/'aptis/data/speaking/bank-v2.json';MANIFEST=ROOT/'aptis/data/speaking/manifest-v2.json'
TEST=re.compile(r'^ST\d{2,3}$');TASK=re.compile(r'^ST\d{2,3}-P[1-4]-Q\d+$');TOPIC=re.compile(r'^SPK-TOP-[A-Z0-9-]+$');RUBRIC=re.compile(r'^SPK-RUB-[A-Z0-9-]+$');IMAGE=re.compile(r'^SPK-IMG-[A-Z0-9-]+$');SHA256=re.compile(r'^[a-f0-9]{64}$');PUBLIC={'PUBLISHED_DEMO','PUBLISHED_FINAL'}
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def main():
 b=load(BANK);m=load(MANIFEST);assert b['schema_version']=='2.0.0' and m['schema_version']=='2.0.0';assert b['release']['release_id']==m['release_id']=='SPK-2026.08-R2'
 topics={x['topic_id'] for x in b['topics']};assert len(topics)==len(b['topics']) and all(TOPIC.fullmatch(x) for x in topics)
 rubrics={x['rubric_id'] for x in b['rubrics']};assert len(rubrics)==len(b['rubrics']) and all(RUBRIC.fullmatch(x) for x in rubrics)
 images={x['image_id']:x for x in b['images']};assert len(images)==len(b['images']) and all(IMAGE.fullmatch(x) for x in images)
 for image in images.values():
  assert image['status'] in PUBLIC and image['source']=='ForLanguage original vector artwork' and image['license']=='CC0-1.0' and SHA256.fullmatch(image['checksum'])
  path=ROOT/image['file_path'].lstrip('/');assert path.exists(),f'missing image file: {path}'
 tests=set();tasks=set();count=0
 for t in b['tests']:
  assert TEST.fullmatch(t['test_id']) and t['test_id'] not in tests;tests.add(t['test_id']);assert t['rubric_id'] in rubrics and t['status']=='PUBLISHED_FINAL'
  assert t.get('reviewed_by') and 'British Council' in t.get('format_reference','') and 'no official prompts' in t.get('source_note','').lower()
  assert len(t['tasks'])==10
  by_part={1:[],2:[],3:[],4:[]}
  for q in t['tasks']:
   assert TASK.fullmatch(q['task_id']) and q['task_id'].startswith(t['test_id']+'-') and q['task_id'] not in tasks;tasks.add(q['task_id']);count+=1;by_part[q['part']].append(q)
   assert q['topic_id'] in topics and q['status']=='PUBLISHED_FINAL' and q.get('review_note') and set(q.get('image_ids',[]))<=set(images)
  assert [len(by_part[p]) for p in (1,2,3,4)]==[3,3,3,1]
  assert all(q['response_seconds']==30 and q['preparation_seconds']==0 and not q['image_ids'] for q in by_part[1])
  assert all(q['response_seconds']==45 and q['preparation_seconds']==0 and len(q['image_ids'])==1 for q in by_part[2]);assert len({tuple(q['image_ids']) for q in by_part[2]})==1
  assert all(q['response_seconds']==45 and q['preparation_seconds']==0 and len(q['image_ids'])==2 for q in by_part[3]);assert len({tuple(q['image_ids']) for q in by_part[3]})==1
  assert by_part[4][0]['response_seconds']==120 and by_part[4][0]['preparation_seconds']==60 and not by_part[4][0]['image_ids'] and by_part[4][0]['prompt'].count('?')>=3
 assert m['test_count']==len(tests)==5 and m['task_count']==count==50 and m['topic_count']==len(topics) and m['rubric_count']==len(rubrics) and m['image_count']==len(images)==11
 assert m['format_alignment']['authority']=='British Council' and m['format_alignment']['official_content_copied'] is False and m['publishing']['final_release_ready'] is True
 print(f'Speaking bank v2 OK: {len(tests)} tests, {count} responses, {len(images)} original images')
if __name__=='__main__':
 try:main()
 except (AssertionError,KeyError,TypeError,ValueError) as e:print(f'Speaking bank validation failed: {e}',file=sys.stderr);raise SystemExit(1)
