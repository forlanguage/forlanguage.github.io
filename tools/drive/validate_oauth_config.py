#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'aptis/config/google-drive-oauth-v1.json'
CLIENT_ID=re.compile(r'^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$')
DRIVE_FILE='https://www.googleapis.com/auth/drive.file'
def main():
    cfg=json.loads(CONFIG.read_text(encoding='utf-8'))
    assert cfg['schema_version']=='1.0.0'
    assert cfg['provider']=='google'
    assert cfg['integration']=='google_drive_manual_sync'
    assert cfg['authorized_javascript_origins']==['https://forlanguage.github.io']
    assert cfg['scopes']==[DRIVE_FILE]
    assert cfg['token_model']=='browser_access_token'
    assert cfg['offline_access'] is False
    assert cfg['client_secret_required'] is False
    assert cfg['sync_mode']=='manual_only'
    assert 'client_secret' not in cfg and 'refresh_token' not in cfg and 'access_token' not in cfg
    if cfg['status']=='CONFIGURED':
        assert CLIENT_ID.fullmatch(cfg['client_id']), 'invalid Google OAuth web client ID'
    else:
        assert cfg['status'] in {'AWAITING_CLIENT_ID','DISABLED'}
        assert cfg['client_id']==''
    print(f"Google Drive OAuth config OK: {cfg['status']}")
if __name__=='__main__':
    try: main()
    except (AssertionError,KeyError,TypeError,ValueError) as exc:
        print(f'Google Drive OAuth config failed: {exc}',file=sys.stderr)
        raise SystemExit(1)
