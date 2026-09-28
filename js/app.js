(function () {
  const Q = window.QUESTIONS;
  const TOTAL = Q.length;
  const STORE_KEY = 'mbti-progress';
  const DIM_ORDER = ['EI', 'SN', 'TF', 'JP'];

  const $ = (sel) => document.querySelector(sel);
  const views = ['home', 'quiz', 'result', 'types'];

  let answers = new Array(TOTAL).fill(null); // 每题取值 1~7，4 为中立
  let index = 0;
  let advanceTimer = null;

  // ---------- 本地存储（隐私模式下可能不可用，全部做容错） ----------
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ answers, index })); } catch (e) {}
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      if (data && Array.isArray(data.answers) && data.answers.length === TOTAL) return data;
    } catch (e) {}
    return null;
  }
  function clearSaved() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // ---------- 视图切换 ----------
  function show(name) {
    views.forEach((v) => $('#view-' + v).classList.toggle('hidden', v !== name));
    window.scrollTo(0, 0);
  }

  function route() {
    clearTimeout(advanceTimer);
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash === 'quiz') return renderQuiz();
    if (hash === 'types') return renderTypes();
    if (hash.startsWith('result=')) {
      const parsed = parseResult(hash.slice(7));
      if (parsed) return renderResult(parsed.code, parsed.pcts);
    }
    if (hash.startsWith('type=')) {
      const code = hash.slice(5).toUpperCase();
      if (window.TYPES[code]) return renderResult(code, null);
    }
    renderHome();
  }

  function go(hash) {
    if (location.hash === '#' + hash) route();
    else location.hash = hash;
  }

  // ---------- 首页 ----------
  function renderHome() {
    const saved = load();
    const answered = saved ? saved.answers.filter((a) => a !== null).length : 0;
    const resume = $('#btn-resume');
    resume.classList.toggle('hidden', !(answered > 0 && answered < TOTAL));
    resume.textContent = `继续上次进度（${answered}/${TOTAL}）`;
    show('home');
  }

  // ---------- 答题 ----------
  function buildScale() {
    const scale = $('#scale');
    const labels = ['非常不同意', '不同意', '有点不同意', '中立', '有点同意', '同意', '非常同意'];
    scale.innerHTML = '';
    for (let v = 1; v <= 7; v++) {
      const b = document.createElement('button');
      const strength = Math.abs(v - 4);
      b.className = `dot s${strength} ${v < 4 ? 'neg' : v > 4 ? 'pos' : ''}`;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', labels[v - 1]);
      b.title = labels[v - 1];
      b.dataset.value = v;
      b.addEventListener('click', () => choose(v));
      scale.appendChild(b);
    }
  }

  function renderQuiz() {
    const q = Q[index];
    $('#q-index').textContent = `第 ${index + 1} 题`;
    $('#q-text').textContent = q.text;

    const done = answers.filter((a) => a !== null).length;
    const pct = Math.round((done / TOTAL) * 100);
    $('#progress-text').textContent = `${index + 1} / ${TOTAL}`;
    $('#progress-pct').textContent = pct + '%';
    $('#progress-bar').style.width = pct + '%';

    document.querySelectorAll('#scale .dot').forEach((d) => {
      d.setAttribute('aria-checked', String(Number(d.dataset.value) === answers[index]));
    });

    $('#btn-prev').disabled = index === 0;
    const next = $('#btn-next');
    next.disabled = answers[index] === null;
    next.textContent = index === TOTAL - 1 ? '查看结果' : '下一题';

    // 重新触发入场动画
    const card = $('.question-card');
    card.classList.remove('enter');
    void card.offsetWidth;
    card.classList.add('enter');

    show('quiz');
  }

  function choose(v) {
    answers[index] = v;
    save();
    renderQuiz();
    clearTimeout(advanceTimer);
    // 选择后稍作停顿再自动进入下一题，让用户看到自己的选择
    advanceTimer = setTimeout(next, 260);
  }

  function next() {
    clearTimeout(advanceTimer);
    if (answers[index] === null) return;
    if (index < TOTAL - 1) {
      index++;
      save();
      renderQuiz();
    } else {
      finish();
    }
  }

  function prev() {
    clearTimeout(advanceTimer);
    if (index > 0) {
      index--;
      save();
      renderQuiz();
    }
  }

  function startNew() {
    answers = new Array(TOTAL).fill(null);
    index = 0;
    save();
    go('quiz');
  }

  function resume() {
    const saved = load();
    if (saved) {
      answers = saved.answers;
      // 跳到第一道未作答的题
      const firstEmpty = answers.indexOf(null);
      index = firstEmpty === -1 ? TOTAL - 1 : firstEmpty;
    }
    go('quiz');
  }

  // ---------- 计分 ----------
  // 返回每个维度中左侧字母（E/S/T/J）的百分比
  function score() {
    const sums = { EI: 0, SN: 0, TF: 0, JP: 0 };
    const max = { EI: 0, SN: 0, TF: 0, JP: 0 };
    Q.forEach((q, i) => {
      const v = answers[i] - 4; // -3 ~ +3
      const sign = q.key === q.dim[0] ? 1 : -1;
      sums[q.dim] += v * sign;
      max[q.dim] += 3;
    });
    const pcts = DIM_ORDER.map((d) => Math.round(50 + (sums[d] / max[d]) * 50));
    const code = DIM_ORDER.map((d, i) => (pcts[i] >= 50 ? d[0] : d[1])).join('');
    return { code, pcts };
  }

  function finish() {
    const { code, pcts } = score();
    clearSaved();
    answers = new Array(TOTAL).fill(null);
    index = 0;
    go(`result=${code}-${pcts.join('-')}`);
  }

  function parseResult(str) {
    const m = /^([EI][SN][TF][JP])-(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})$/i.exec(str);
    if (!m) return null;
    const code = m[1].toUpperCase();
    const pcts = m.slice(2).map((n) => Math.min(100, Math.max(0, Number(n))));
    // 校验字母与百分比一致，避免手动篡改后出现矛盾的展示
    const consistent = DIM_ORDER.every((d, i) => (pcts[i] >= 50 ? d[0] : d[1]) === code[i]);
    return consistent ? { code, pcts } : { code, pcts: null };
  }

  // ---------- 结果 / 类型详情 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderResult(code, pcts) {
    const t = window.TYPES[code];
    const gKey = window.groupOf(code);
    const group = window.GROUPS[gKey];
    const isResult = Array.isArray(pcts);

    const hero = $('#result-hero');
    hero.className = `result-hero g-${group.color}`;
    hero.innerHTML = `
      <p class="label">${isResult ? '你的人格类型是' : '人格类型'}</p>
      <div class="code">${code}</div>
      <div class="name">${esc(t.name)}</div>
      <p class="tagline">${esc(t.tagline)}</p>
      <span class="badge">${esc(group.name)} · ${esc(group.desc)}</span>
      <p class="summary">${esc(t.summary)}</p>`;

    const dimsCard = $('#result-dims');
    dimsCard.className = `card g-${group.color}` + (isResult ? '' : ' hidden');
    if (isResult) {
      $('#dim-bars').innerHTML = DIM_ORDER.map((d, i) => {
        const info = window.DIMENSIONS[d];
        const leftPct = pcts[i];
        const leftWins = leftPct >= 50;
        const win = leftWins ? leftPct : 100 - leftPct;
        return `
          <div class="dim-row">
            <div class="dim-head">
              <span class="${leftWins ? 'on' : ''}">${info.left[1]} ${info.left[0]} · ${leftPct}%</span>
              <span class="${leftWins ? '' : 'on'}">${100 - leftPct}% · ${info.right[0]} ${info.right[1]}</span>
            </div>
            <div class="dim-track"><div class="dim-fill ${leftWins ? 'from-left' : 'from-right'}" style="width:0" data-w="${win}"></div></div>
            <div class="dim-hint">${info.hint}</div>
          </div>`;
      }).join('');
      // 下一帧再设宽度，触发进度条动画
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelectorAll('.dim-fill').forEach((el) => { el.style.width = el.dataset.w + '%'; });
      }));
    }

    const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    $('#result-body').innerHTML = `
      <div class="card"><h3>💪 优势</h3>${list(t.strengths)}</div>
      <div class="card"><h3>🔍 可能的盲点</h3>${list(t.weaknesses)}</div>
      <div class="card wide"><h3>💼 适合的职业方向</h3><div class="chips">${t.careers.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
      <div class="card wide"><h3>🌱 成长建议</h3><p>${esc(t.growth)}</p></div>`;

    const actions = $('#result-actions');
    actions.innerHTML = isResult
      ? `<button class="btn primary" data-act="share">复制结果链接</button>
         <button class="btn ghost" data-act="retake">重新测试</button>
         <button class="btn ghost" data-act="types">浏览 16 种类型</button>`
      : `<button class="btn primary" data-act="retake">开始测试</button>
         <button class="btn ghost" data-act="types">返回类型列表</button>`;

    document.title = `${code} ${t.name} · MBTI 性格测试`;
    show('result');
  }

  // ---------- 16 种类型列表 ----------
  function renderTypes() {
    const byGroup = { NT: [], NF: [], SJ: [], SP: [] };
    Object.keys(window.TYPES).forEach((code) => byGroup[window.groupOf(code)].push(code));
    $('#types-grid').innerHTML = Object.entries(byGroup).map(([g, codes]) => {
      const group = window.GROUPS[g];
      return `
        <div class="group-block">
          <h2>${esc(group.name)} <small>${esc(group.desc)}</small></h2>
          <div class="types-row">
            ${codes.map((c) => `
              <button class="type-card g-${group.color}" data-type="${c}">
                <b>${c}</b><span>${esc(window.TYPES[c].name)}</span>
                <small>${esc(window.TYPES[c].tagline)}</small>
              </button>`).join('')}
          </div>
        </div>`;
    }).join('');
    document.title = '16 种人格类型 · MBTI 性格测试';
    show('types');
  }

  // ---------- 提示 ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  async function share() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('链接已复制，发给朋友看看吧');
    } catch (e) {
      window.prompt('复制下面的链接：', url);
    }
  }

  // ---------- 事件绑定 ----------
  buildScale();
  $('#btn-start').addEventListener('click', startNew);
  $('#btn-resume').addEventListener('click', resume);
  $('#btn-next').addEventListener('click', next);
  $('#btn-prev').addEventListener('click', prev);

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-go]');
    if (nav) {
      e.preventDefault();
      document.title = 'MBTI 性格测试';
      go(nav.dataset.go === 'home' ? '' : nav.dataset.go);
      return;
    }
    const card = e.target.closest('[data-type]');
    if (card) return go('type=' + card.dataset.type);
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'share') share();
    if (act.dataset.act === 'retake') startNew();
    if (act.dataset.act === 'types') go('types');
  });

  document.addEventListener('keydown', (e) => {
    if ($('#view-quiz').classList.contains('hidden')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-7]$/.test(e.key)) choose(Number(e.key));
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') next();
  });

  // 直接访问 #quiz 时恢复进度，避免出现空白答题状态
  const saved = load();
  if (saved) {
    answers = saved.answers;
    index = Math.min(Math.max(0, saved.index | 0), TOTAL - 1);
  }

  window.addEventListener('hashchange', route);
  route();
})();
