import { CIRCUITS, getCircuit, TAPEOUT, mintTxUrl } from '../src/circuits.js';
import { createMatch, ATTACK } from '../src/engine.js';
import { pickCircuit, createReadPolicy } from '../src/ai.js';
import { randomSeed } from '../src/rng.js';
import { ERAS, resolveEra, eraConfig } from '../src/eras.js';
import { VERSION } from '../src/version.js';
import { createStarfield } from './starfield.js';
import { createWallet, detectProvider, txUrl, READ_FEE_LABEL, BURN_ADDRESS, readTransaction } from '../src/wallet.js';
import { randomSalt, computeCommitment, commitCalldata, commitmentPreimage, parseCommitCalldata, verifyMatch } from '../src/commit.js';
import { localEvaluator, evaluateLocal } from '../src/evaluators/local.js';
import { createTapeoutEvaluator } from '../src/evaluators/tapeout.js';
import { t, getLang, setLang, onLangChange, applyStatic, circuitText, eraText } from './i18n.js';
import { designGuideHtml } from './i18n/guide.js';
import { brainSvg, startThinking } from './brainviz.js';
import { eraSkyHtml } from './eraviz.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// 默认用 X Layer 链上的真实电路计算；断网或 RPC 不可用时可以切到本地模拟。
const EVALUATORS = { chain: () => createTapeoutEvaluator(), local: () => localEvaluator };
let evaluator;
let evaluatorKind = 'chain';

const X_URL = 'https://x.com/boostbob';
const TELEGRAM_URL = 'https://t.me/+BI5wArStnKBmZTJl';
const $ = (id) => document.getElementById(id);
const actionWord = (a) => t(a === ATTACK ? 'action.attack' : 'action.coop');
const actionText = (a) => `<span class="${a === ATTACK ? 'attack' : 'coop'}">${actionWord(a)}</span>`;
const brainLabel = (id) => `#${id} ${circuitText(id).name}`;
const txLink = (hash, key = 'status.viewTx') => `<a href="${txUrl(hash)}" target="_blank" rel="noopener noreferrer">${t(key)}</a>`;

// 报错翻译：钱包取消等标准错误码，以及库里带 i18n 键名的错误；其他情况显示原始信息。
function errorText(err) {
  if (err?.code === 4001) return t('err.wallet.rejected');
  if (err?.code === -32002) return t('err.wallet.pending');
  if (err?.i18n) return t(`err.wallet.${err.i18n.key}`, err.i18n.params);
  return err?.message ?? String(err);
}

// 背景：三体星系实时引力模拟，跟随纪元切换。未知纪元在对局中统一画乱纪元，不泄露真实纪元。
const starfield = createStarfield($('starfield'));
let destroyedAtStart = 0; // 开局时背景里三体文明累计毁灭次数，结算时算出本局毁灭了几次
let destroyedThisMatch = 0;
const ERA_SKY = { stable: 'stable', chaotic: 'chaotic', triple: 'triple', flying: 'flying', unknown: 'chaotic' };

let selected = 1;
let selectedEra = 'stable';
let era; // { era, hidden }：本局实际纪元，hidden 表示玩家选的是未知纪元
let match;
let matchStarted = false;
let aiCircuit;
let aiPolicy;
let seed;
let roundNo = 1;
let logRows = []; // 每轮结算结果，切换语言时用它重画对局记录
// 读心付费：开局勾选后，每次读心先在 X Layer 上烧 0.0001 OKB，交易确认后才读心。
const wallet = createWallet({ getProvider: () => detectProvider(window) });
let payToRead = false;
let readTxs = {}; // round → 读心交易哈希
// 开局承诺：本局秘密（含 salt）和上链交易，赛后公开并可链上验证
let commitSecret = null;
let commitTx = null;
let verifyState = null; // null | { loading } | { error } | { tx, result }
const brainChecks = {}; // 大脑说明弹窗里的链上核对结果：id → { state, values, error }
let openDialog = null; // 当前打开的大脑弹窗：{ type: 'brain', id } | { type: 'guide' }

// 对局提示区：当前的渲染函数存起来，切换语言时重画。渲染函数只负责显示，不能有副作用。
let view = null;
let rerendering = false;
function setView(fn) {
  view = fn;
  fn();
}

function renderCircuits() {
  // 说明按钮和选择按钮是兄弟元素（按钮不能嵌套按钮），用绝对定位放在卡片右上角。
  $('circuit-list').innerHTML =
    CIRCUITS.map((base) => {
      const c = circuitText(base.id);
      const label = brainLabel(c.id);
      const gates = c.netlist.length;
      return `<div class="circuit-card brain-${c.id}">
      <button type="button" class="circuit" role="radio" data-id="${c.id}" aria-checked="${c.id === selected}">
        ${brainSvg(c, { aria: t('viz.brain.aria', { name: label, gates }), gates: t('viz.gates', { gates }) })}
        <div class="name">${label}</div>
        <div class="meta">${t('card.gate', { gate: c.gate })}</div>
        ${c.nftId ? `<div class="meta chain">NFT #${c.nftId} · TapeID ${c.tapeoutId}</div>` : ''}
        <div class="desc">${c.desc}</div>
      </button>
      <button type="button" class="btn-info" data-info="${c.id}" aria-haspopup="dialog" aria-label="${t('card.info.aria', { name: label })}">!</button>
      ${c.mintTx ? `<a class="mint-link" href="${mintTxUrl(c.mintTx)}" target="_blank" rel="noopener noreferrer" aria-label="${t('card.mint.aria', { name: label })}">${t('card.mint')}</a>` : ''}
    </div>`;
    }).join('') +
    // 第 5 张卡：自定义大脑的设计指南，目前只做说明，不能出战。
    `<div class="circuit-card">
      <button type="button" class="circuit custom-brain" data-custom aria-haspopup="dialog">
        <div class="name">${t('custom.name')}</div>
        <div class="meta">${t('custom.meta')}</div>
        <div class="desc">${t('custom.desc')}</div>
      </button>
    </div>`;
  // 卡片重画后旧的 SVG 已经不在了，重新挂动画
  stopAllThinking();
  syncThinking();
}

// 大脑思考动画：选中的大脑一直在思考，鼠标悬停或键盘聚焦的大脑也会思考。
const thinking = new Map(); // id → 停止函数
function syncThinking() {
  const want = new Set([selected]);
  const hovered = document.querySelector('#circuit-list .circuit:hover, #circuit-list .circuit:focus-visible');
  if (hovered?.dataset.id) want.add(Number(hovered.dataset.id));
  for (const [id, stop] of thinking) {
    if (!want.has(id)) {
      stop();
      thinking.delete(id);
    }
  }
  for (const id of want) {
    if (thinking.has(id)) continue;
    const svg = document.querySelector(`#circuit-list .circuit[data-id="${id}"] .brainviz`);
    if (svg) thinking.set(id, startThinking(svg, getCircuit(id), reduceMotion.matches));
  }
}

function stopAllThinking() {
  for (const stop of thinking.values()) stop();
  thinking.clear();
}

function renderDesignGuide() {
  $('brain-title').textContent = t('custom.name');
  $('brain-body').innerHTML = designGuideHtml(getLang(), actionText);
}

// 对方连续 4 轮的动作，用来演示每个大脑怎么回应。
const DEMO_OPPONENT = [1, 0, 0, 1];

function renderBrainInfo(id) {
  const c = circuitText(id);
  const out = { 0: evaluateLocal(id, 0), 1: evaluateLocal(id, 1) };
  // 示例：第 1 轮默认输入交流，之后每轮的输入是对方上一轮的动作。
  const demo = DEMO_OPPONENT.map((opp, i) => {
    const input = i === 0 ? 1 : DEMO_OPPONENT[i - 1];
    return { round: i + 1, input, output: evaluateLocal(id, input), opp };
  });
  const check = brainChecks[id];
  const chainCell = (input) => {
    if (!check?.values || !(input in check.values)) return '—';
    const v = check.values[input];
    return v === out[input] ? `<span class="coop">✓ eval = ${v}</span>` : `<span class="attack">✗ eval = ${v}</span>`;
  };
  const verifyLabel = check?.state === 'loading' ? t('brain.verifying') : check?.state === 'done' ? t('brain.verified') : check?.state === 'error' ? t('brain.verifyFail') : t('brain.verify');
  $('brain-title').textContent = brainLabel(id);
  $('brain-body').innerHTML = `
    <p>${t('brain.intro', { desc: c.desc, gate: c.gate })}</p>
    <h3>${t('brain.io')}</h3>
    <p>${t('brain.ioText')}</p>
    <table class="log">
      <thead><tr><th scope="col">${t('brain.colIn')}</th><th scope="col">${t('brain.colOut')}</th><th scope="col">${t('brain.colChain')}</th></tr></thead>
      <tbody>
        <tr><td>1 ${actionWord(1)}</td><td>${actionText(out[1])}（${out[1]}）</td><td>${chainCell(1)}</td></tr>
        <tr><td>0 ${actionWord(0)}</td><td>${actionText(out[0])}（${out[0]}）</td><td>${chainCell(0)}</td></tr>
      </tbody>
    </table>
    ${check?.state === 'error' ? `<p class="attack">${errorText(check.error)}</p>` : ''}
    <h3>${t('brain.demo')}</h3>
    <table class="log">
      <thead><tr><th scope="col">${t('log.round')}</th><th scope="col">${t('brain.demoIn')}</th><th scope="col">${t('brain.demoOut')}</th><th scope="col">${t('brain.demoOpp')}</th></tr></thead>
      <tbody>${demo.map((d) => `<tr><td>${d.round}</td><td>${d.round === 1 ? t('brain.default') : `${d.input} ${actionWord(d.input)}`}</td><td>${actionText(d.output)}</td><td>${actionText(d.opp)}</td></tr>`).join('')}</tbody>
    </table>
    <h3>${t('brain.wiring')}</h3>
    <p>${c.wiring}</p>
    ${c.nftId ? `<p class="chain-line">${t('brain.chain', { nft: c.nftId, tape: c.tapeoutId })}<br>${t('brain.contract')} <a href="${TAPEOUT.explorer}" target="_blank" rel="noopener noreferrer"><code>${TAPEOUT.circuits}</code></a>${c.mintTx ? `<br>${t('brain.mintTx')} <a href="${mintTxUrl(c.mintTx)}" target="_blank" rel="noopener noreferrer"><code>${c.mintTx}</code></a>` : ''}</p>
    <button type="button" id="btn-brain-verify" data-verify="${id}" ${check?.state === 'loading' || check?.state === 'done' ? 'disabled' : ''}>${verifyLabel}</button>` : ''}`;
}

function renderOpenDialog() {
  if (openDialog?.type === 'brain') renderBrainInfo(openDialog.id);
  if (openDialog?.type === 'guide') renderDesignGuide();
}

// 直接调用链上 eval（免费只读），把结果填进真值表的“链上核对”列。
async function verifyBrainOnChain(id) {
  brainChecks[id] = { state: 'loading', values: {} };
  renderOpenDialog();
  const chain = createTapeoutEvaluator();
  try {
    for (const input of [1, 0]) brainChecks[id].values[input] = await chain.evaluate(id, input);
    brainChecks[id].state = 'done';
  } catch (err) {
    brainChecks[id] = { state: 'error', values: brainChecks[id].values, error: err };
  }
  if (openDialog?.type === 'brain' && openDialog.id === id) renderBrainInfo(id);
}

const eraMeta = (e) =>
  e.hidden ? t('era.meta.hidden') : t('era.meta', { rounds: e.rounds, rate: Math.round(e.interferenceRate * 100), read: t(e.allowRead ? 'era.read.yes' : 'era.read.no') });

function renderEras() {
  $('era-list').innerHTML = ERAS.map((base) => {
    const e = eraText(base.id);
    return `<button type="button" class="circuit era-card era-${e.id}" role="radio" data-era="${e.id}" aria-checked="${e.id === selectedEra}">
      ${eraSkyHtml(e.id, { temp: t('viz.temp'), light: t('viz.light'), lightValue: t(`viz.light.${e.id}`) })}
      <div class="name">${e.name}</div>
      <div class="meta chain">${eraMeta(e)}</div>
      <div class="desc">${e.desc}</div>
    </button>`;
  }).join('');
}

$('era-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-era]');
  if (!btn) return;
  selectedEra = btn.dataset.era;
  renderEras();
  starfield.setMode(ERA_SKY[selectedEra]);
});

$('circuit-list').addEventListener('click', (e) => {
  if (e.target.closest('[data-custom]')) {
    openDialog = { type: 'guide' };
    renderDesignGuide();
    brainDialog.showModal();
    return;
  }
  const info = e.target.closest('[data-info]');
  if (info) {
    openDialog = { type: 'brain', id: Number(info.dataset.info) };
    renderBrainInfo(openDialog.id);
    brainDialog.showModal();
    return;
  }
  const btn = e.target.closest('.circuit');
  if (!btn) return;
  selected = Number(btn.dataset.id);
  renderCircuits();
});

for (const type of ['mouseover', 'mouseout', 'focusin', 'focusout']) {
  $('circuit-list').addEventListener(type, () => requestAnimationFrame(syncThinking));
}
reduceMotion.addEventListener('change', () => {
  stopAllThinking();
  syncThinking();
});

$('brain-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-verify]');
  if (btn) verifyBrainOnChain(Number(btn.dataset.verify));
});

function show(section) {
  for (const id of ['setup', 'game', 'result']) $(id).hidden = id !== section;
}

function setActions(buttons) {
  const box = $('actions');
  box.innerHTML = '';
  for (const { label, cls, onClick } of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', onClick, { once: true });
    box.appendChild(b);
  }
  // 切换语言重画时不抢焦点，焦点留在语言按钮上
  if (!rerendering) box.querySelector('button')?.focus();
}

function renderGameHeader() {
  $('era-name').textContent = matchStarted ? (era.hidden ? eraText('unknown').name : eraText(era.era.id).name) : '';
  $('round-label').textContent = t('game.round', { round: roundNo, total: era ? eraConfig(era.era).rounds : 10 });
  $('my-label').textContent = t('game.me', { brain: brainLabel(selected) });
}

$('btn-start').addEventListener('click', () => {
  era = resolveEra(selectedEra);
  seed = randomSeed();
  aiCircuit = pickCircuit();
  commitTx = null;
  verifyState = null;
  const config = eraConfig(era.era);
  commitSecret = { seed, salt: randomSalt(), eraId: era.era.id, aiCircuit, rounds: config.rounds, interferenceRate: config.interferenceRate };
  if ($('opt-commit').checked) commitThenStart();
  else startMatch();
});

// 钱包操作进行中的提示：状态键名 + 交易哈希
const statusView = (key, hash) => () => {
  $('prompt').innerHTML = `${t(`status.${key}`, { fee: READ_FEE_LABEL })}…${hash ? `<br>${txLink(hash)}` : ''}`;
};

// 开局前先把承诺写上链，确认后再开打。失败时可以重试，也可以不上链直接开始。
async function commitThenStart() {
  matchStarted = false;
  roundNo = 1;
  logRows = [];
  renderLog();
  renderGameHeader();
  show('game');
  setActions([]);
  try {
    commitTx = await wallet.commitMatch({
      data: commitCalldata(computeCommitment(commitSecret)),
      onStatus: (key, hash) => {
        setView(statusView(key, hash));
        updateWalletStatus();
      },
    });
  } catch (err) {
    updateWalletStatus();
    setView(() => {
      $('prompt').innerHTML = `<span class="attack">${t('err.commit', { reason: errorText(err) })}</span>`;
      setActions([
        { label: t('btn.retryCommit'), cls: 'primary', onClick: commitThenStart },
        { label: t('btn.skipCommit'), onClick: startMatch },
      ]);
    });
    return;
  }
  startMatch();
}

function startMatch() {
  const config = eraConfig(era.era);
  aiPolicy = createReadPolicy();
  evaluatorKind = document.querySelector('input[name="evaluator"]:checked')?.value ?? 'chain';
  evaluator = EVALUATORS[evaluatorKind]();
  payToRead = $('opt-pay').checked;
  readTxs = {};
  logRows = [];
  roundNo = 1;
  matchStarted = true;
  updateEvaluatorStatus();
  // 玩家是 A，电脑是 B
  match = createMatch({ circuits: { A: selected, B: aiCircuit }, evaluator, seed, config });
  renderGameHeader();
  starfield.setMode(era.hidden ? 'chaotic' : era.era.id);
  destroyedAtStart = starfield.destroyed;
  $('my-score').textContent = '0';
  $('ai-score').textContent = '0';
  renderLog();
  show('game');
  nextRound();
}

function updateEvaluatorStatus() {
  const calls = typeof evaluator?.calls === 'number' ? t('evaluator.calls', { n: evaluator.calls }) : '';
  $('evaluator-name').textContent = t(`evaluator.${evaluatorKind}`) + calls;
}

// 链上调用要等网络：期间显示提示；失败时给出重试按钮。
// 引擎在 eval 全部成功后才推进状态，所以重试同一步是安全的。
async function runStep(labelKey, fn) {
  setActions([]);
  setView(() => {
    $('prompt').innerHTML = `${t(labelKey)}…`;
  });
  try {
    return await fn();
  } catch (err) {
    setView(() => {
      $('prompt').innerHTML = `<span class="attack">${t('err.step', { reason: errorText(err) })}</span>`;
      setActions([{ label: t('btn.retry'), cls: 'primary', onClick: () => runStep(labelKey, fn) }]);
    });
    return undefined;
  } finally {
    updateEvaluatorStatus();
  }
}

function nextRound() {
  return runStep('step.compute', async () => renderRound(await match.startRound()));
}

function renderRound({ round, observed, self }) {
  roundNo = round;
  renderGameHeader();
  const canRead = match.config.allowRead;
  // 电脑是否读心在这里决定一次；下面的显示函数可以因切换语言重复调用，不能再问 AI。
  const aiReads = canRead && aiPolicy.shouldRead(observed.A);
  setView(() => {
    let base = t('round.outputs', { me: actionText(observed.A), opp: actionText(observed.B) });
    // 只看自己的 self.A，对方是否被干扰要到赛后才公开。
    if (self.A.interfered) {
      base +=
        '<br>' +
        (self.A.intended === observed.A
          ? t('round.interferedSame', { action: actionText(observed.A) })
          : t('round.interfered', { intended: actionText(self.A.intended) }));
    }
    if (observed.B === ATTACK && !canRead) {
      $('prompt').innerHTML = `${base}<br>${t('round.noRead')}`;
      setActions([{ label: t('btn.hold'), cls: 'primary', onClick: () => resolve({ A: false, B: false }) }]);
    } else if (observed.B === ATTACK) {
      const fee = payToRead ? t('round.fee', { fee: READ_FEE_LABEL }) : '';
      $('prompt').innerHTML = `${base}<br>${t('round.struck', { fee })}`;
      setActions([
        { label: payToRead ? t('btn.readPaid', { fee: READ_FEE_LABEL }) : t('btn.read'), cls: 'primary', onClick: () => readMind(round, aiReads) },
        { label: t('btn.hold'), onClick: () => resolve({ A: false, B: aiReads }) },
      ]);
    } else {
      $('prompt').innerHTML = base;
      setActions([{ label: t('btn.settle'), cls: 'primary', onClick: () => resolve({ A: false, B: aiReads }) }]);
    }
  });
}

// 玩家读心：需要付费时，先在钱包里签名一笔交易并等它确认，再在链上 eval 读心。
// 付款失败或取消时留在本轮，可以重试，也可以改为忍下。
async function readMind(round, aiReads) {
  if (payToRead && !readTxs[round]) {
    setActions([]);
    try {
      readTxs[round] = await wallet.payForRead({
        seed,
        round,
        onStatus: (key, hash) => {
          setView(statusView(key, hash));
          updateWalletStatus();
        },
      });
    } catch (err) {
      updateWalletStatus();
      setView(() => {
        $('prompt').innerHTML = `<span class="attack">${t('err.pay', { reason: errorText(err) })}</span>`;
        setActions([
          { label: t('btn.retryRead'), cls: 'primary', onClick: () => readMind(round, aiReads) },
          { label: t('btn.hold'), onClick: () => resolve({ A: false, B: aiReads }) },
        ]);
      });
      return;
    }
  }
  return resolve({ A: true, B: aiReads });
}

function resolve(reads) {
  return runStep(reads.A ? 'step.read' : 'step.resolve', async () => renderResolve(await match.resolveRound(reads)));
}

function renderResolve(r) {
  aiPolicy.learn(r.readResult.B);
  logRows.push(r);
  renderLog();
  $('my-score').textContent = r.totals.A;
  $('ai-score').textContent = r.totals.B;
  setView(() => {
    const notes = [];
    if (r.readResult.A === 'interference') notes.push(t('resolve.caught'));
    if (r.readResult.A === 'genuine') notes.push(t('resolve.genuine'));
    if (r.readResult.B === 'interference') notes.push(t('resolve.oppCaught'));
    if (r.readResult.B === 'genuine') notes.push(t('resolve.oppGenuine'));
    const summary = t('resolve.summary', { me: actionText(r.finalAction.A), opp: actionText(r.finalAction.B), a: r.score.A, b: r.score.B });
    $('prompt').innerHTML = `${summary}${notes.length ? '<br>' + notes.join('<br>') : ''}`;
    if (match.isOver) setActions([{ label: t('btn.result'), cls: 'primary', onClick: showResult }]);
    else setActions([{ label: t('btn.next'), cls: 'primary', onClick: nextRound }]);
  });
}

function renderLog() {
  const readWord = (res) => t(res === 'interference' ? 'log.interference' : 'log.genuine');
  $('log-body').innerHTML = logRows
    .map((r) => {
      const tx = readTxs[r.round] ? ` <a href="${txUrl(readTxs[r.round])}" target="_blank" rel="noopener noreferrer" title="${t('log.tx.title')}">${t('log.tx')}</a>` : '';
      const readCell =
        [r.readResult.A && t('log.readMe', { result: readWord(r.readResult.A) }) + tx, r.readResult.B && t('log.readOpp', { result: readWord(r.readResult.B) })]
          .filter(Boolean)
          .join('<br>') || '—';
      return `<tr><td>${r.round}</td><td>${actionText(r.finalAction.A)}</td><td>${actionText(r.finalAction.B)}</td><td>${readCell}</td><td>${r.score.A} : ${r.score.B}</td></tr>`;
    })
    .join('');
}

function showResult() {
  // 毁灭次数在结算这一刻定下来，之后背景继续运行也不影响本局结果
  destroyedThisMatch = starfield.destroyed - destroyedAtStart;
  if (era.hidden) starfield.setMode(era.era.id);
  view = null;
  renderResult();
  renderCommitBox();
  show('result');
  $('btn-again').focus();
}

function renderResult() {
  const { plan, history } = match.reveal();
  const { A, B } = match.totals;
  const outcome = A > B ? 'win' : A < B ? 'lose' : 'draw';
  const ai = circuitText(aiCircuit);
  // 结局：对比分数说明地球任务成败，再说这场对局里三体星球文明毁灭了几次。
  const sky = destroyedThisMatch > 0 ? t('sky.destroyed', { n: destroyedThisMatch }) : t('sky.safe');
  $('result-fate').className = outcome === 'lose' ? 'fate lost' : 'fate';
  $('result-fate').innerHTML = `${t(`fate.${outcome}`)}<small>${sky}</small>`;
  const eraLine = era.hidden ? t('result.era', { era: eraText(era.era.id).name, rate: Math.round(era.era.interferenceRate * 100) }) : '';
  $('result-summary').innerHTML = t('result.summary', { a: A, b: B, verdict: t(`verdict.${outcome}`), era: eraLine, brain: brainLabel(ai.id), gate: ai.gate, desc: ai.desc });
  const yes = `<span class="hit">${t('reveal.yes')}</span>`;
  $('reveal-body').innerHTML = history
    .map((r, i) => `<tr><td>${r.round}</td><td>${plan[i].A ? yes : t('reveal.no')}</td><td>${plan[i].B ? yes : t('reveal.no')}</td><td>${actionText(r.finalAction.A)} : ${actionText(r.finalAction.B)}</td></tr>`)
    .join('');
  $('seed').textContent = seed;
}

function renderCommitBox() {
  $('commit-box').hidden = !commitTx;
  if (!commitTx) return;
  $('commit-tx').href = txUrl(commitTx);
  $('commit-tx').textContent = commitTx;
  $('commit-hash').textContent = computeCommitment(commitSecret);
  $('commit-preimage').textContent = commitmentPreimage(commitSecret);
  renderVerdict();
}

function renderVerdict() {
  const el = $('commit-verdict');
  $('btn-verify-commit').disabled = Boolean(verifyState?.loading);
  if (!verifyState) el.textContent = '';
  else if (verifyState.loading) el.textContent = t('commit.reading');
  else if (verifyState.error) el.innerHTML = `<span class="attack">${errorText(verifyState.error)}</span>`;
  else {
    const { tx, result: r } = verifyState;
    const mark = (ok) => (ok ? '✓' : '✗');
    const ok = r.ok && tx.success;
    el.innerHTML = [
      `${mark(tx.success)} ${t('commit.block', { block: tx.blockNumber })}`,
      `${mark(r.commitmentOk)} ${t('commit.hashOk')}`,
      `${mark(r.planOk)} ${t('commit.planOk')}`,
      `<strong class="${ok ? 'coop' : 'attack'}">${t(ok ? 'commit.pass' : 'commit.fail')}</strong>`,
    ].join('<br>');
  }
}

// 赛后验证：用公共 RPC 读回开局交易，比对哈希，并用 seed 重放干扰计划。不需要钱包。
$('btn-verify-commit').addEventListener('click', async () => {
  verifyState = { loading: true };
  renderVerdict();
  try {
    const tx = await readTransaction(commitTx);
    const result = verifyMatch({ onChainCommitment: parseCommitCalldata(tx.data), secret: commitSecret, playedPlan: match.reveal().plan });
    verifyState = { tx, result };
  } catch (err) {
    verifyState = { error: err };
  }
  renderVerdict();
});

$('btn-again').addEventListener('click', () => show('setup'));

function updateWalletStatus() {
  const el = $('wallet-status');
  if (!wallet.available) el.textContent = t('wallet.none');
  else if (wallet.account) el.textContent = t('wallet.connected', { addr: `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}` });
  else el.textContent = t('wallet.idle');
}

// 弹窗：Esc、关闭按钮或点背景都能关闭。
function setupDialog(dialog) {
  dialog.querySelector('.btn-close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    // 点在弹窗矩形外才算点背景；点弹窗内边距时 target 也是 dialog，不能只看 target。
    const box = dialog.getBoundingClientRect();
    const outside = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
    if (e.target === dialog && outside) dialog.close();
  });
  return dialog;
}

// 规则弹窗默认隐藏，点“帮助 / 规则”打开。
const rules = setupDialog($('rules'));
$('btn-rules').addEventListener('click', () => rules.showModal());
const brainDialog = setupDialog($('brain-info'));
brainDialog.addEventListener('close', () => {
  openDialog = null;
});

function renderFooter() {
  $('footer-version').textContent = t('footer.version', { version: VERSION });
  // 标签文字跟语言走，链接文字显示网址本身
  const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  $('footer-x').innerHTML = t('footer.x') + link(X_URL, 'x.com/boostbob');
  $('footer-tg').innerHTML = t('footer.tg') + link(TELEGRAM_URL, TELEGRAM_URL.replace('https://', ''));
}

// 中英文切换：静态文案由 i18n.js 套用，动态内容在这里重画。
$('btn-lang').addEventListener('click', () => setLang(getLang() === 'zh' ? 'en' : 'zh'));
onLangChange(() => {
  rerendering = true;
  try {
    renderCircuits();
    renderEras();
    renderFooter();
    updateEvaluatorStatus();
    updateWalletStatus();
    renderOpenDialog();
    if (era) renderGameHeader();
    renderLog();
    if (!$('game').hidden) view?.();
    if (!$('result').hidden) {
      renderResult();
      renderCommitBox();
    }
  } finally {
    rerendering = false;
  }
});

applyStatic();
renderFooter();
renderEras();
updateEvaluatorStatus();
// 没检测到钱包时默认不勾选，玩家仍可以不付费试玩；钱包晚注入时刷新一下状态。
$('burn-addr').textContent = BURN_ADDRESS;
if (!wallet.available) {
  $('opt-pay').checked = false;
  $('opt-commit').checked = false;
}
updateWalletStatus();
window.addEventListener('load', updateWalletStatus);
$('contract-addr').textContent = TAPEOUT.circuits;
$('contract-link').href = TAPEOUT.explorer;
renderCircuits();
