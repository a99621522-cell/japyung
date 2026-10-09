/* mundap_ui.js — 문답(자유 대화) 패널
 *
 * 「묻는다」는 물음 하나에 상담글 하나를 준다. 이 패널은 그 아래에 붙어서
 * 노트북LM처럼 같은 명식에 대해 계속 묻고 답한다 — 개념도, 근거도, 내 명식도.
 * 대화 이력은 이 접속(화면) 안에서만 산다. 새 명식을 넣거나 새로고침하면 사라진다.
 *
 * 기존 index.html의 전역을 그대로 쓴다: 현재(명식·입력), 중계(서버 주소), 꾸밈(마크다운+형광펜)
 * 서버에는 POST 중계+'/문답' 로 { 명식, 출생연도, 성별, 절기날수, 질문, 이력 } 를 보낸다.
 */
(function(){
  let 이력 = [];            // [{질문, 답}]
  let 이력명식 = null;      // 어느 명식의 이력인지 — 바뀌면 비운다
  let 보내는중 = false;

  const 스타일 = `
  .문답감{margin:18px 0 6px;border:1px solid var(--border,#E3DACB);border-radius:14px;background:var(--card,#fff);overflow:hidden}
  .문답머리{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--card2,#F4EEE2);cursor:pointer;user-select:none}
  .문답머리 b{font-size:14px;color:var(--text,#2C2620)}
  .문답머리 small{color:var(--muted,#7A7264);font-size:12px;margin-left:8px}
  .문답머리 .화살{transition:transform .2s;color:var(--dim,#A39A88)}
  .문답감.닫힘 .문답몸{display:none}
  .문답감.닫힘 .화살{transform:rotate(-90deg)}
  .문답몸{padding:12px 16px 14px}
  .문답로그{display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow:auto;padding:2px 2px 6px}
  .문답말{max-width:92%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.65;word-break:keep-all}
  .문답말.나{align-self:flex-end;background:var(--card2,#F4EEE2);color:var(--text,#2C2620)}
  .문답말.앱{align-self:flex-start;background:#fff;border:1px solid var(--border,#E3DACB)}
  .문답말.앱 mark, .문답말.앱 .형광{background:rgba(201,168,76,.28);padding:0 2px;border-radius:3px}
  .문답말.기다림{color:var(--muted,#7A7264);font-style:italic}
  .문답입력줄{display:flex;gap:8px;margin-top:10px}
  .문답입력줄 input{flex:1;padding:10px 12px;border:1px solid var(--border,#E3DACB);border-radius:10px;font-size:14px;background:var(--bg,#F6F2EA);color:var(--text,#2C2620)}
  .문답입력줄 button{padding:10px 14px;border:0;border-radius:10px;background:var(--gold,#A8802F);color:#fff;font-weight:700;cursor:pointer}
  .문답입력줄 button[disabled]{opacity:.5;cursor:default}
  .문답도움{font-size:12px;color:var(--dim,#A39A88);margin-top:8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .문답도움 a{color:var(--gold,#A8802F);text-decoration:none}
  .문답예{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .문답예 button{font-size:12px;padding:5px 9px;border:1px solid var(--border,#E3DACB);border-radius:999px;background:transparent;color:var(--muted,#7A7264);cursor:pointer}
  .문답예 button:hover{border-color:var(--gold,#A8802F);color:var(--gold,#A8802F)}
  `;
  const 예시물음 = ['방금 그 말이 무슨 뜻이에요?', '더 쉽게 설명해 주세요', '그 판정의 원문 근거가 뭐예요?',
                   '식신이 뭐예요?', '왜 저한테 그 글자가 그 십성이에요?', '만약 시주가 달랐으면 격이 바뀌나요?'];

  function 명식키(){ try { return JSON.stringify(현재 && 현재.r && 현재.r.명식); } catch(e){ return null; } }

  // 「묻는다」의 첫 상담글을 이 패널이 이력의 첫 줄로 물려받는다.
  // 그래야 두 번째 물음부터 도입부를 다시 펼치지 않고 이어서 답한다.
  window.문답이력 = () => { if (이력명식 !== 명식키()) { 이력 = []; 이력명식 = 명식키(); } return 이력.slice(); };
  window.문답추가 = function(질문, 답){
    if (이력명식 !== 명식키()) { 이력 = []; 이력명식 = 명식키(); }
    이력.push({ 질문:String(질문||''), 답:String(답||'') });
    const 감 = document.querySelector('.문답감'); if (!감) return;
    const 로그 = 감.querySelector('.문답로그');
    if (로그) { 말풍선(로그, '나', 질문); 말풍선(로그, '앱', 답); }
    const 안내 = 감.querySelector('.문답안내');
    if (안내) 안내.textContent = '위 답에 이어서 계속 물어보실 수 있습니다.';
  };
  window.문답씨앗 = function(질문, 답){
    이력 = [{ 질문:String(질문||''), 답:String(답||'') }];
    이력명식 = 명식키();
    const 감 = document.querySelector('.문답감'); if (!감) return;
    const 로그 = 감.querySelector('.문답로그'); if (로그) 로그.innerHTML = '';
    const 안내 = 감.querySelector('.문답안내');
    if (안내) 안내.textContent = '위 상담글에 이어서 답합니다 — 무엇이든 물어보세요.';
    감.classList.remove('닫힘');
  };

  function 몸만들기(질문){
    const m = 현재.r.명식;
    const 몸 = { 명식:{yeonGan:m.yeonGan,yeonJi:m.yeonJi,wolGan:m.wolGan,wolJi:m.wolJi,ilGan:m.ilGan,ilJi:m.ilJi},
                 출생연도: 현재.입력.년, 성별: 현재.입력.성별, 질문, 이력 };
    if (!현재.입력.시모름) { 몸.명식.siGan = m.siGan; 몸.명식.siJi = m.siJi; }
    const 대 = 현재.r.만세력 && 현재.r.만세력.대운; if (대 && 대.날수 != null) 몸.절기날수 = 대.날수;
    return 몸;
  }

  function 그리기(html){ try { const x = (typeof 꾸밈 === 'function') ? 꾸밈(html) : (typeof 마크다운 === 'function' ? 마크다운(html) : html); return (typeof 이해단추 === 'function') ? 이해단추(x) : x; } catch(e){ return html; } }   // 이해 안 됨 단추(2026-10-07)

  function 말풍선(로그, 누구, 내용, 추가클래스){
    const el = document.createElement('div');
    el.className = '문답말 ' + 누구 + (추가클래스 ? ' ' + 추가클래스 : '');
    if (누구 === '앱') el.innerHTML = 그리기(내용); else el.textContent = 내용;
    로그.appendChild(el); 로그.scrollTop = 로그.scrollHeight; return el;
  }

  async function 보내기(감){
    if (보내는중 || !현재) return;
    const 입력 = 감.querySelector('.문답입력줄 input'), 단추 = 감.querySelector('.문답입력줄 button'), 로그 = 감.querySelector('.문답로그');
    const 질문 = 입력.value.trim(); if (!질문) { 입력.focus(); return; }
    if (이력명식 !== 명식키()) { 이력 = []; 이력명식 = 명식키(); }
    입력.value = ''; 보내는중 = true; 단추.disabled = true;
    말풍선(로그, '나', 질문);
    const 기다림 = 말풍선(로그, '앱', '소스를 뒤져 답을 쓰는 중입니다…', '기다림');
    const 타이머 = setTimeout(()=>{ 기다림.textContent = '간명 중입니다 — 처음엔 30초쯤 걸릴 수 있습니다'; }, 8000);
    const 그만 = new AbortController(); const 시간초과 = setTimeout(()=>그만.abort(), 150000);
    try {
      const res = await fetch(중계 + '/문답', { method:'POST', signal: 그만.signal,
        headers:{'Content-Type':'application/json'}, body: JSON.stringify(몸만들기(질문)) });
      const d = await res.json();
      clearTimeout(타이머); 기다림.remove();
      if (d && d.성공 && d.본문) {
        const 앱말 = 말풍선(로그, '앱', d.본문);
        // 답 검사 결과 — 회색 한 줄(만든 사람용). 통과·경고 없음이면 생략
        if (d.검사 && (d.검사.다시씀 || (d.검사.오류||[]).length || (d.검사.경고||[]).length)) {
          const 조각 = [];
          if (d.검사.다시씀) 조각.push('첫 답이 검사에 걸려 다시 썼습니다');
          if ((d.검사.오류||[]).length) 조각.push('남은 오류 ' + d.검사.오류.length + '건: ' + d.검사.오류.map(x=>x.split(':')[0]).join('·'));
          if ((d.검사.경고||[]).length) 조각.push('경고 ' + d.검사.경고.length + '건: ' + d.검사.경고.map(x=>x.split(':')[0]).join('·'));
          const 줄 = document.createElement('div'); 줄.className = '검사줄'; 줄.textContent = '검사 — ' + 조각.join(' · ');
          줄.title = (d.검사.오류||[]).concat(d.검사.경고||[]).join('\n');
          (앱말 || 로그).appendChild ? (앱말 || 로그).appendChild(줄) : 로그.appendChild(줄);
        }
        이력.push({ 질문, 답: d.본문 });
      } else if (d && d.출처 === '엔진 답' && d.본문) {
        // 31차: Gemini 가 답하지 못하면 서버가 엔진 판정만으로 물음에 맞춘 짧은 답을 보낸다 — 이력에는 넣지 않는다(다음 물음은 풀어 쓴 답을 다시 시도)
        말풍선(로그, '앱', '지금은 문장으로 풀어 쓰는 모델이 답하지 못해, 엔진 판정만으로 짧게 답합니다.' + (d.사유 ? ' (' + d.사유 + ')' : ''), '기다림');
        말풍선(로그, '앱', d.본문);
      } else {
        말풍선(로그, '앱', '지금은 답을 만들지 못했습니다.' + (d && d.사유 ? ' (' + d.사유 + ')' : '') + ' 잠시 뒤 다시 물어 주세요.', '기다림');
      }
    } catch(e) {
      clearTimeout(타이머); 기다림.textContent = (e.name === 'AbortError') ? '1분을 넘겨 멈췄습니다. 다시 물어 주세요.' : '연결이 되지 않았습니다. 잠시 뒤 다시 시도해 주세요.';
    } finally {
      clearTimeout(시간초과); 보내는중 = false; 단추.disabled = false; 입력.focus();
    }
  }

  function 패널HTML(){
    return `<div class="문답머리" onclick="this.parentNode.classList.toggle('닫힘')">
      <div><b>문답</b><small>같은 명식에 대해 자유롭게 묻고 답합니다 — 개념·근거·내 명식 무엇이든</small></div>
      <span class="화살">▾</span></div>
    <div class="문답몸">
      <div class="문답안내" style="font-size:12px;color:var(--muted,#7A7264);margin-bottom:8px">먼저 위에서 한 번 물어보시면, 그 상담글에 이어서 자유롭게 문답합니다.</div>
      <div class="문답로그"></div>
      <div class="문답예">${예시물음.map(q=>`<button type="button" data-q="${q}">${q}</button>`).join('')}</div>
      <div class="문답입력줄">
        <input placeholder="이 명식에 대해 무엇이든 물어보세요" aria-label="문답 입력">
        <button type="button">묻기</button>
      </div>
      <div class="문답도움">
        <span>자평진전·궁통보감과 이 앱의 판정 안에서만 답합니다. 그 밖의 것은 「없다」고 말합니다.</span>
        <a href="#" class="문답새로">새 대화</a>
      </div>
    </div>`;
  }

  function 붙이기(){
    const 상담칸 = document.getElementById('상담칸');
    if (!상담칸 || document.querySelector('.문답감')) return;
    const 감 = document.createElement('div'); 감.className = '문답감 닫힘'; 감.innerHTML = 패널HTML();
    상담칸.parentNode.insertBefore(감, 상담칸.nextSibling);
    const 입력 = 감.querySelector('.문답입력줄 input');
    감.querySelector('.문답입력줄 button').onclick = () => 보내기(감);
    입력.onkeydown = e => { if (e.key === 'Enter') 보내기(감); };
    감.querySelectorAll('.문답예 button').forEach(b => b.onclick = () => { 입력.value = b.dataset.q; 감.classList.remove('닫힘'); 보내기(감); });
    감.querySelector('.문답새로').onclick = e => { e.preventDefault();
      이력 = 이력.length ? [이력[0]] : [];        // 첫 상담글은 바닥으로 남긴다
      감.querySelector('.문답로그').innerHTML = ''; };
    // 새 명식이면 이력 비움 (같은 화면에서 다른 사람을 넣었을 때)
    if (이력명식 !== 명식키()) { 이력 = []; 이력명식 = 명식키(); }
  }

  const st = document.createElement('style'); st.textContent = 스타일; document.head.appendChild(st);
  new MutationObserver(붙이기).observe(document.body, { childList:true, subtree:true });
  붙이기();
})();
