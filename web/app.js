import { CIRCUITS, getCircuit, TAPEOUT } from '../src/circuits.js';
import { createMatch, ATTACK } from '../src/engine.js';
import { pickCircuit, createReadPolicy } from '../src/ai.js';
import { randomSeed } from '../src/rng.js';
import { localEvaluator } from '../src/evaluators/local.js';
import { createTapeoutEvaluator } from '../src/evaluators/tapeout.js';

// 默认用 X Layer 链上的真实电路计算；断网或 RPC 不可用时可以切到本地模拟。
const EVALUATORS = { chain: () => createTapeoutEvaluator(), local: () => localEvaluator };
let evaluator;

const $ = (id) => document.getElementById(id);
const actionText = (a) => (a === ATTACK ? '<span class="attack">打击</span>' : '<span class="coop">交流</span>');

let selected = 1;
let match;
let aiCircuit;
let aiPolicy;
let seed;

function renderCircuits() {
  $('circuit-list').innerHTML = CIRCUITS.map(
    (c) => `<button type="button" class="circuit" role="radio" data-id="${c.id}" aria-checked="${c.id === selected}">
      <div class="name">#${c.id} ${c.name}</div>
      <div class="meta">电路：${c.gate}</div>
      ${c.nftId ? `<div class="meta chain">NFT #${c.nftId} · TapeID ${c.tapeoutId}</div>` : ''}
      <div class="desc">${c.desc}</div>
    </button>`,
  ).join('');
}

$('circuit-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.circuit');
  if (!btn) return;
  selected = Number(btn.dataset.id);
  renderCircuits();
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
  box.querySelector('button')?.focus();
}

$('btn-start').addEventListener('click', () => {
  const rounds = Math.min(30, Math.max(3, Number($('opt-rounds').value) || 10));
  const interferenceRate = Math.min(0.9, Math.max(0, Number($('opt-rate').value) || 0));
  seed = randomSeed();
  aiCircuit = pickCircuit();
  aiPolicy = createReadPolicy();
  evaluator = EVALUATORS[document.querySelector('input[name="evaluator"]:checked')?.value ?? 'chain']();
  updateEvaluatorStatus();
  // 玩家是 A，电脑是 B
  match = createMatch({ circuits: { A: selected, B: aiCircuit }, evaluator, seed, config: { rounds, interferenceRate } });
  $('my-circuit').textContent = `#${selected} ${getCircuit(selected).name}`;
  $('round-total').textContent = rounds;
  $('round-no').textContent = '1';
  $('my-score').textContent = '0';
  $('ai-score').textContent = '0';
  $('log-body').innerHTML = '';
  show('game');
  nextRound();
});

function updateEvaluatorStatus() {
  const calls = typeof evaluator?.calls === 'number' ? ` · 本局链上调用 ${evaluator.calls} 次` : '';
  $('evaluator-name').textContent = (evaluator ?? EVALUATORS.chain()).name + calls;
}

// 链上调用要等网络：期间显示提示；失败时给出重试按钮。
// 引擎在 eval 全部成功后才推进状态，所以重试同一步是安全的。
async function runStep(label, fn) {
  setActions([]);
  $('prompt').innerHTML = `${label}…`;
  try {
    return await fn();
  } catch (err) {
    $('prompt').innerHTML = `<span class="attack">${err.message}</span><br>可以重试；如果 RPC 一直不可用，可在开局时改用本地模拟。`;
    setActions([{ label: '重试', cls: 'primary', onClick: () => runStep(label, fn) }]);
    return undefined;
  } finally {
    updateEvaluatorStatus();
  }
}

function nextRound() {
  return runStep('大脑电路计算中', async () => renderRound(await match.startRound()));
}

function renderRound({ round, observed, self }) {
  $('round-no').textContent = round;
  const aiReads = aiPolicy.shouldRead(observed.A);
  let base = `本轮你的大脑输出：${actionText(observed.A)}，对方：${actionText(observed.B)}。`;
  // 只看自己的 self.A，对方是否被干扰要到赛后才公开。
  if (self.A.interfered) {
    base +=
      self.A.intended === observed.A
        ? `<br><span class="hit">你的大脑被智子操控了</span>，不过你本来也会${actionText(observed.A)}，这次干扰没有改变什么。`
        : `<br><span class="hit">你的大脑被智子操控了！</span>你本想${actionText(self.A.intended)}，却打出了一次打击。对方会不会读心发现你是被冤枉的？`;
  }

  if (observed.B === ATTACK) {
    $('prompt').innerHTML = `${base}<br>你被打击了。是智子干扰，还是对方本性如此？读心需要 1 分（若是干扰则退还）。`;
    setActions([
      { label: '读心（1 分）', cls: 'primary', onClick: () => resolve({ A: true, B: aiReads }) },
      { label: '忍下', onClick: () => resolve({ A: false, B: aiReads }) },
    ]);
  } else {
    $('prompt').innerHTML = base;
    setActions([{ label: '结算本轮', cls: 'primary', onClick: () => resolve({ A: false, B: aiReads }) }]);
  }
}

function resolve(reads) {
  const label = reads.A ? '读心中：正在链上重新计算对方的大脑' : '结算中';
  return runStep(label, async () => renderResolve(await match.resolveRound(reads)));
}

function renderResolve(r) {
  aiPolicy.learn(r.readResult.B);

  const notes = [];
  if (r.readResult.A === 'interference') notes.push('<span class="hit">你识破了智子干扰</span>，对方本轮改回交流，读心费退还');
  if (r.readResult.A === 'genuine') notes.push('读心结果：对方是真心打击，扣 1 分');
  if (r.readResult.B === 'interference') notes.push('对方读了你的心，发现你被智子干扰，你本轮改回真实动作');
  if (r.readResult.B === 'genuine') notes.push('对方读了你的心，确认你是真心打击');

  const readCell = [r.readResult.A && `我→${r.readResult.A === 'interference' ? '识破干扰' : '真打击'}`, r.readResult.B && `对方→${r.readResult.B === 'interference' ? '识破干扰' : '真打击'}`]
    .filter(Boolean)
    .join('<br>') || '—';
  $('log-body').insertAdjacentHTML(
    'beforeend',
    `<tr><td>${r.round}</td><td>${actionText(r.finalAction.A)}</td><td>${actionText(r.finalAction.B)}</td><td>${readCell}</td><td>${r.score.A} : ${r.score.B}</td></tr>`,
  );
  $('my-score').textContent = r.totals.A;
  $('ai-score').textContent = r.totals.B;
  $('prompt').innerHTML = `本轮结算：最终 我 ${actionText(r.finalAction.A)} / 对方 ${actionText(r.finalAction.B)}，得分 ${r.score.A} : ${r.score.B}。${notes.length ? '<br>' + notes.join('<br>') : ''}`;

  if (match.isOver) setActions([{ label: '查看结果', cls: 'primary', onClick: showResult }]);
  else setActions([{ label: '下一轮', cls: 'primary', onClick: nextRound }]);
}

function showResult() {
  const { plan, history } = match.reveal();
  const { A, B } = match.totals;
  const verdict = A > B ? '你的文明存活了下来。' : A < B ? '你的文明被压制了。' : '两个文明势均力敌。';
  const ai = getCircuit(aiCircuit);
  $('result-summary').innerHTML = `最终比分 ${A} : ${B}。${verdict}<br>对方出战的大脑是 <strong>#${ai.id} ${ai.name}</strong>（${ai.gate}）：${ai.desc}。`;
  $('reveal-body').innerHTML = history
    .map((r, i) => `<tr><td>${r.round}</td><td>${plan[i].A ? '<span class="hit">是</span>' : '否'}</td><td>${plan[i].B ? '<span class="hit">是</span>' : '否'}</td><td>${actionText(r.finalAction.A)} : ${actionText(r.finalAction.B)}</td></tr>`)
    .join('');
  $('seed').textContent = seed;
  show('result');
  $('btn-again').focus();
}

$('btn-again').addEventListener('click', () => show('setup'));

// 规则弹窗：默认隐藏，点“帮助 / 规则”打开；Esc、关闭按钮或点背景都能关闭。
const rules = $('rules');
$('btn-rules').addEventListener('click', () => rules.showModal());
rules.querySelector('.btn-close-rules').addEventListener('click', () => rules.close());
rules.addEventListener('click', (e) => {
  // 点在弹窗矩形外才算点背景；点弹窗内边距时 target 也是 dialog，不能只看 target。
  const box = rules.getBoundingClientRect();
  const outside = e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
  if (e.target === rules && outside) rules.close();
});

updateEvaluatorStatus();
$('contract-addr').textContent = TAPEOUT.circuits;
$('contract-link').href = TAPEOUT.explorer;
renderCircuits();
