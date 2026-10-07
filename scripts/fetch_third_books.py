#!/usr/bin/env python3
"""scripts/fetch_third_books.py — 셋째 책 조사(docs/PROMPTS.md 10) 원문 창고 만들기 (2026-10-07)

  python3 scripts/fetch_third_books.py [--from DIR]   # DIR 에 받아 둔 raw wikitext 가 있으면 다시 받지 않는다

滴天髓(輯要, 劉基 원문·소주, wikisource 滴天髓/01~42)와 三命通會(萬民英, wikisource 卷一~卷九 — 卷十~十二 결락)의 raw wikitext 를 받아
위키 마크업({{color|…}}·{{+|…}}·''·[[…]]·<…>·: 들여쓰기)을 벗기고 docs/jeokcheonsu_wonmun.txt · docs/sammyeong_wonmun.txt 로 쓴다.
장 머리는 '## 제목 (wiki/경로)'. 조사 보고서(docs/third_book.md)의 인용은 이 두 파일의 줄만 쓴다. 子平粹言(徐樂吾 1938)은 공개 전문을 찾지 못해 창고가 없다.
"""
import re, sys, os, time, urllib.request, urllib.parse
뿌리 = os.path.join(os.path.dirname(__file__), '..')
src = None
if '--from' in sys.argv: src = sys.argv[sys.argv.index('--from') + 1]

def raw(title):
    if src:
        p = os.path.join(src, title_to_file(title))
        if os.path.exists(p): return open(p, encoding='utf-8').read()
    url = 'https://zh.wikisource.org/w/index.php?title=' + urllib.parse.quote(title) + '&action=raw'
    req = urllib.request.Request(url, headers={'User-Agent': 'japyung-corpus/1.0 (research; contact via github a99621522-cell/japyung)'})
    with urllib.request.urlopen(req, timeout=90) as r: t = r.read().decode('utf-8')
    time.sleep(1.5); return t

def title_to_file(title):
    if title.startswith('滴天髓/'): return 'dts_' + title.split('/')[1] + '.txt'
    return 'smth_' + title.split('卷')[1] + '.txt'

def clean(w):
    w = re.sub(r'<onlyinclude>|</onlyinclude>|<noinclude>.*?</noinclude>|__TOC__|__NOTOC__', '', w, flags=re.S)
    w = re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', w, flags=re.S)
    w = re.sub(r'<br\s*/?>', '\n', w)
    w = re.sub(r'<[^>]+>', '', w)
    # 템플릿: {{color|red|{{+|글}}}} → 글, {{Novel|…}}·{{header|…}} 류는 지움, 그 밖 {{a|b|c}} 는 마지막 인자
    for _ in range(6):
        w = re.sub(r'\{\{(?:Novel|header|textquality|Header|PD-old|pd|頭|footer)\b[^{}]*\}\}', '', w, flags=re.I)
        w = re.sub(r'\{\{\+\|([^{}]*)\}\}', r'\1', w)
        w = re.sub(r'\{\{color\|[^|{}]*\|([^{}]*)\}\}', r'\1', w)
        w = re.sub(r'\{\{[^{}|]*\|([^{}]*)\}\}', lambda m: m.group(1).split('|')[-1], w)
        w = re.sub(r'\{\{[^{}]*\}\}', '', w)
    w = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', w)
    w = re.sub(r"'''?", '', w)
    out = []
    for l in w.split('\n'):
        l = l.strip()
        l = re.sub(r'^[:;*#]+\s*', '', l)
        m = re.match(r'^(={2,})\s*(.+?)\s*\1$', l)
        if m: l = '### ' + m.group(2)
        l = l.replace('　', '')
        if l: out.append(l)
    return '\n'.join(out)

def build(name, titles, 설명):
    lines = ['# ' + 설명, '']
    for t in titles:
        try: w = raw(t)
        except Exception as e: print('받기 실패', t, e); continue
        lines.append(f'## {t} (wiki/{urllib.parse.quote(t)})'); lines.append(clean(w)); lines.append('')
        print(t, len(w))
    p = os.path.join(뿌리, 'docs', name)
    open(p, 'w', encoding='utf-8').write('\n'.join(lines))
    print('→', p, sum(1 for _ in open(p, encoding='utf-8')), '줄')

장 = ['通天論','天干論','地支論','形象論','方局論','格局論','從化論－真','從化論－假','歲運論','體用論','精神論','衰旺論','中和論','剛柔論','順逆論','寒暖論','月令論','生時論','源流論','通隔論','清濁論','真假論','隱顯論','眾寡論','奮鬱論','恩怨論','順反論','戰合論','震兌論','坎離論','君臣論','母子論','才德論','性情論','疾病論','閒神論','絆神論','六親論','出身論','地位論','貴賤貧富吉凶壽夭論','貞元論']
build('jeokcheonsu_wonmun.txt', [f'滴天髓/{i:02d}' for i in range(1, 43)],
      '滴天髓 원문 (wikisource zh 滴天髓/01~42 「滴天髓輯要」 — 劉基 저로 전하는 본문(붉은 구절)과 소주, 2026-10-07 수집, 번체). 장 이름 차례: ' + '·'.join(f'{i+1:02d} {n}' for i, n in enumerate(장)) + '. 조사 보고서 인용은 이 파일의 줄만 쓴다. 任鐵樵 闡微의 명례는 이 판에 없다.')
build('sammyeong_wonmun.txt', ['三命通會/卷' + k for k in '一二三四五六七八九'],
      '三命通會 원문 (wikisource zh 三命通會 卷一~卷九, 萬民英, 2026-10-07 수집, 번체 — 卷十~十二 결락). 납음·신살·격국 목록·육십갑자 성질 등 자평진전이 쓰지 않는 층이 많다. 조사 보고서 인용은 이 파일의 줄만 쓴다.')
