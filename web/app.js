import { CIRCUITS, getCircuit, TAPEOUT, mintTxUrl } from '../src/circuits.js';
import { createMatch, ATTACK } from '../src/engine.js';
import { pickCircuit, createReadPolicy } from '../src/ai.js';
import { randomSeed } from '../src/rng.js';
import { ERAS, resolveEra, eraConfig } from '../src/eras.js';
import { createStarfield } from './starfield.js';
import { createWallet, detectProvider, friendlyWalletError, txUrl, READ_FEE_LABEL, BURN_ADDRESS } from '../src/wallet.js';
import { localEvaluator } from '../src/evaluators/local.js';
import { createTapeoutEvaluator } from '../src/evaluators/tapeout.js';

// 默认用 X Layer 链上的真实电路计算；断网或 RPC 不可用时可以切到本地模拟。
const EVALUATORS = { chain: () => createTapeoutEvaluator(), local: () => localEvaluator };
let evaluator;

const $ = (id) => document.getElementById(id);
const actionText = (a) => (a === ATTACK ? '<span class="attack">打击</span>' : '<span class="coop">交流</span>');

// 背景：三体星系实时引力模拟，跟随纪元切换。未知纪元在对局中统一画乱纪元，不泄露真实纪元。
const starfield = createStarfield($('starfield'));
let destroyedAtStart = 0; // 开局时背景里三体文明累计毁灭次数，结算时算出本局毁灭了几次
const ERA_SKY = { stable: 'stable', chaotic: 'chaotic', triple: 'triple', flying: 'flying', unknown: 'chaotic' };

let selected = 1;
let selectedEra = 'stable';
let era; // { era, hidden }：本局实际纪元，hidden 表示玩家选的是未知纪元
let match;
let aiCircuit;
let aiPolicy;
let seed;
// 读心付费：开局勾选后，每次读心先在 X Layer 上烧 0.0001 OKB，交易确认后才读心。
const wallet = createWallet({ getProvider: () => detectProvider(window) });
let payToRead = false;
let readTxs = {}; // round → 读心交易哈希

function renderCircuits() {
  // 说明按钮和选择按钮是兄弟元素（按钮不能嵌套按钮），用绝对定位放在卡片右上角。
  $('circuit-list').innerHTML = CIRCUITS.map(
    (c) => `<div class="circuit-card">
      <button type="button" class="circuit" role="radio" data-id="${c.id}" aria-checked="${c.id === selected}">
        <div class="name">#${c.id} ${c.name}</div>
        <div class="meta">电路：${c.gate}</div>
        ${c.nftId ? `<div class="meta chain">NFT #${c.nftId} · TapeID ${c.tapeoutId}</div>` : ''}
        <div class="desc">${c.desc}</div>
      </button>
      <button type="button" class="btn-info" data-info="${c.id}" aria-haspopup="dialog" aria-label="#${c.id} ${c.name} 的输入输出说明">!</button>
      ${c.mintTx ? `<a class="mint-link" href="${mintTxUrl(c.mintTx)}" target="_blank" rel="noopener noreferrer" aria-label="#${c.id} ${c.name} 的铸造交易（OKLink）">铸造交易 ↗</a>` : ''}
    </div>`,
  ).join('') +
    // 第 5 张卡：自定义大脑的设计指南，目前只做说明，不能出战。
    `<div class="circuit-card">
      <button type="button" class="circuit custom-brain" data-custom aria-haspopup="dialog">
        <div class="name">#5 设计你的大脑</div>
        <div class="meta">电路：三位输入 · 敬请期待</div>
        <div class="desc">看得更远、记得更多的三体大脑。点击查看设计方法。</div>
      </button>
    </div>`;
}

// 三位输入：bit0 对方上一轮，bit1 对方上上轮，bit2 我方上一轮。
const DESIGN_EXAMPLES = [
  { name: '宽容执剑人', hex: '0xEE', rule: '对方连续两轮打击才还手', fn: (o1, o2) => o1 | o2, gates: 'OUT = NAND(¬IN0, ¬IN1)，约 3 个 NAND' },
  { name: '巴甫洛夫', hex: '0xA5', rule: '赢了保持，输了就换：对方上轮交流就重复我上轮的动作，对方上轮打击就换一种动作', fn: (o1, o2, me) => (me === o1 ? 1 : 0), gates: 'OUT = IN0 同或 IN2（XNOR），约 5 个 NAND' },
  { name: '记仇者', hex: '0x88', rule: '对方连续两轮交流才肯交流', fn: (o1, o2) => o1 & o2, gates: 'OUT = ¬NAND(IN0, IN1)，约 2 个 NAND' },
];

function openDesignGuide() {
  const [tolerant] = DESIGN_EXAMPLES;
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const [o1, o2, me] = [i & 1, (i >> 1) & 1, (i >> 2) & 1];
    rows.push(`<tr><td>${i}</td><td>${me}</td><td>${o2}</td><td>${o1}</td><td>${actionText(tolerant.fn(o1, o2, me))}</td></tr>`);
  }
  $('brain-title').textContent = '#5 设计你的大脑';
  $('brain-body').innerHTML = `
    <p>内置的 4 个大脑只有 1 位输入：只看对方上一轮。1 位输入的电路一共只有 4 种行为，就是现在这 4 个。想要更聪明的大脑，就要让它看到更多历史。</p>
    <h3>1. 三位输入接口</h3>
    <table class="log">
      <thead><tr><th scope="col">输入引脚</th><th scope="col">含义</th></tr></thead>
      <tbody>
        <tr><td>IN0</td><td>对方上一轮的动作</td></tr>
        <tr><td>IN1</td><td>对方上上轮的动作</td></tr>
        <tr><td>IN2</td><td>我方上一轮的动作</td></tr>
        <tr><td>OUT0</td><td>我这一轮的动作</td></tr>
      </tbody>
    </table>
    <p>1 = 交流，0 = 打击。开局历史不够时一律补 1（视为交流）。8 种输入、每种输出 0 或 1，一共有 256 种大脑。</p>
    <h3>2. 设计步骤</h3>
    <ol>
      <li>想清楚策略：比如“对方连续两次打击我才还手”。</li>
      <li>把策略填成 8 行真值表：每一种输入组合，大脑该输出什么。</li>
      <li>在 TapeOut 画布上用 NAND 实现：3 个输入引脚、1 个输出引脚，不要用 LATCH（时序单元必须为 0，相同输入才一定得到相同输出）。</li>
      <li>本地自检：逐个切换 8 种输入，核对输出和真值表一致。</li>
      <li>流片到 X Layer，拿到电路 NFT。</li>
    </ol>
    <h3>3. 例子：宽容执剑人（真值表 ${tolerant.hex}）</h3>
    <p>${tolerant.rule}。</p>
    <table class="log">
      <thead><tr><th scope="col">输入编号</th><th scope="col">IN2 我上轮</th><th scope="col">IN1 对方上上轮</th><th scope="col">IN0 对方上轮</th><th scope="col">输出</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <p>真值表可以记成一个 8 位数：第 i 位是输入编号为 i 时的输出。宽容执剑人只有编号 0 和 4（对方连续两轮打击）输出打击，所以是 0xEE。</p>
    <h3>4. 更多思路</h3>
    <table class="log">
      <thead><tr><th scope="col">大脑</th><th scope="col">真值表</th><th scope="col">策略</th><th scope="col">NAND 实现</th></tr></thead>
      <tbody>${DESIGN_EXAMPLES.map((e) => `<tr><td>${e.name}</td><td><code>${e.hex}</code></td><td>${e.rule}</td><td>${e.gates}</td></tr>`).join('')}</tbody>
    </table>
    <h3>5. 设计提示</h3>
    <ul>
      <li>智子干扰率高的纪元，宽容一点的大脑能扛住误会，少花读心费。</li>
      <li>太宽容会被偷袭者占便宜；太记仇会被一次误会拖进猜疑链。</li>
      <li>你的大脑在对局中是保密的，赛后才公开：设计时要想到对手也在研究你。</li>
    </ul>
    <p class="chain-line">自定义大脑出战暂未开放。接口规范和准入检查见项目文档 <a href="https://github.com/trytotapeout/ChainOfSuspicion/blob/main/docs/brain-spec.md" target="_blank" rel="noopener noreferrer">docs/brain-spec.md</a>。</p>`;
  brainDialog.showModal();
}

// 对方连续 4 轮的动作，用来演示每个大脑怎么回应。
const DEMO_OPPONENT = [1, 0, 0, 1];
const plainAction = (a) => (a === ATTACK ? '打击' : '交流');

async function openBrainInfo(id) {
  const c = getCircuit(id);
  const [out0, out1] = [await localEvaluator.evaluate(id, 0), await localEvaluator.evaluate(id, 1)];
  // 示例：第 1 轮默认输入交流，之后每轮的输入是对方上一轮的动作。
  const demo = [];
  for (let i = 0; i < DEMO_OPPONENT.length; i++) {
    const input = i === 0 ? 1 : DEMO_OPPONENT[i - 1];
    demo.push({ round: i + 1, input, output: await localEvaluator.evaluate(id, input), opp: DEMO_OPPONENT[i] });
  }
  $('brain-title').textContent = `#${c.id} ${c.name}`;
  $('brain-body').innerHTML = `
    <p>${c.desc}。电路类型：${c.gate}。</p>
    <h3>输入和输出</h3>
    <p>输入 IN0 是对方上一轮的动作，输出 OUT0 是我这一轮的动作。1 = 交流，0 = 打击。第 1 轮没有上一轮，默认输入 1。</p>
    <table class="log">
      <thead><tr><th scope="col">输入 IN0（对方上一轮）</th><th scope="col">输出 OUT0（我这一轮）</th><th scope="col">链上核对</th></tr></thead>
      <tbody>
        <tr><td>1 交流</td><td>${actionText(out1)}（${out1}）</td><td id="brain-chain-1">—</td></tr>
        <tr><td>0 打击</td><td>${actionText(out0)}（${out0}）</td><td id="brain-chain-0">—</td></tr>
      </tbody>
    </table>
    <h3>例子：对方依次 交流、打击、打击、交流</h3>
    <table class="log">
      <thead><tr><th scope="col">轮</th><th scope="col">输入（对方上一轮）</th><th scope="col">我的输出</th><th scope="col">对方本轮</th></tr></thead>
      <tbody>${demo
        .map((d) => `<tr><td>${d.round}</td><td>${d.round === 1 ? '1（默认）' : `${d.input} ${plainAction(d.input)}`}</td><td>${actionText(d.output)}</td><td>${actionText(d.opp)}</td></tr>`)
        .join('')}</tbody>
    </table>
    <h3>电路接法</h3>
    <p>${c.wiring}</p>
    ${c.nftId ? `<p class="chain-line">链上：NFT #${c.nftId} · TapeID ${c.tapeoutId}<br>合约 <a href="${TAPEOUT.explorer}" target="_blank" rel="noopener noreferrer"><code>${TAPEOUT.circuits}</code></a>${c.mintTx ? `<br>铸造交易 <a href="${mintTxUrl(c.mintTx)}" target="_blank" rel="noopener noreferrer"><code>${c.mintTx}</code></a>` : ''}</p>
    <button type="button" id="btn-brain-verify">在链上核对真值表</button>` : ''}`;
  $('btn-brain-verify')?.addEventListener('click', () => verifyBrainOnChain(id));
  brainDialog.showModal();
}

// 直接调用链上 eval（免费只读），把结果填进真值表的“链上核对”列。
async function verifyBrainOnChain(id) {
  const btn = $('btn-brain-verify');
  btn.disabled = true;
  btn.textContent = '链上计算中…';
  const chain = createTapeoutEvaluator();
  try {
    for (const input of [1, 0]) {
      const [onChain, local] = [await chain.evaluate(id, input), await localEvaluator.evaluate(id, input)];
      $(`brain-chain-${input}`).innerHTML = onChain === local ? `<span class="coop">✓ eval = ${onChain}</span>` : `<span class="attack">✗ eval = ${onChain}</span>`;
    }
    btn.textContent = '链上核对完成';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '核对失败，点击重试';
    $('brain-chain-1').innerHTML = `<span class="attack">${err.message}</span>`;
  }
}

const eraMeta = (e) => (e.hidden ? '纪元：随机 · 赛后公开' : `${e.rounds} 轮 · 干扰率 ${Math.round(e.interferenceRate * 100)}% · ${e.allowRead ? '可读心' : '禁止读心'}`);

function renderEras() {
  $('era-list').innerHTML = ERAS.map(
    (e) => `<button type="button" class="circuit" role="radio" data-era="${e.id}" aria-checked="${e.id === selectedEra}">
      <div class="name">${e.name}</div>
      <div class="meta chain">${eraMeta(e)}</div>
      <div class="desc">${e.desc}</div>
    </button>`,
  ).join('');
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
    openDesignGuide();
    return;
  }
  const info = e.target.closest('[data-info]');
  if (info) {
    openBrainInfo(Number(info.dataset.info));
    return;
  }
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
  era = resolveEra(selectedEra);
  const config = eraConfig(era.era);
  const rounds = config.rounds;
  seed = randomSeed();
  aiCircuit = pickCircuit();
  aiPolicy = createReadPolicy();
  evaluator = EVALUATORS[document.querySelector('input[name="evaluator"]:checked')?.value ?? 'chain']();
  payToRead = $('opt-pay').checked;
  readTxs = {};
  updateEvaluatorStatus();
  // 玩家是 A，电脑是 B
  match = createMatch({ circuits: { A: selected, B: aiCircuit }, evaluator, seed, config });
  $('my-circuit').textContent = `#${selected} ${getCircuit(selected).name}`;
  $('round-total').textContent = rounds;
  $('round-no').textContent = '1';
  $('era-name').textContent = era.hidden ? '未知纪元' : era.era.name;
  starfield.setMode(era.hidden ? 'chaotic' : era.era.id);
  destroyedAtStart = starfield.destroyed;
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
  const canRead = match.config.allowRead;
  const aiReads = canRead && aiPolicy.shouldRead(observed.A);
  let base = `本轮你的大脑输出：${actionText(observed.A)}，对方：${actionText(observed.B)}。`;
  // 只看自己的 self.A，对方是否被干扰要到赛后才公开。
  if (self.A.interfered) {
    base +=
      self.A.intended === observed.A
        ? `<br><span class="hit">你的大脑被智子操控了</span>，不过你本来也会${actionText(observed.A)}，这次干扰没有改变什么。`
        : `<br><span class="hit">你的大脑被智子操控了！</span>你本想${actionText(self.A.intended)}，却打出了一次打击。对方会不会读心发现你是被冤枉的？`;
  }

  if (observed.B === ATTACK && !canRead) {
    $('prompt').innerHTML = `${base}<br>你被打击了。三日凌空，读心失效，只能忍下。`;
    setActions([{ label: '忍下', cls: 'primary', onClick: () => resolve({ A: false, B: false }) }]);
  } else if (observed.B === ATTACK) {
    const fee = payToRead ? `，并用钱包在 X Layer 上烧掉 ${READ_FEE_LABEL}（不退还）` : '';
    $('prompt').innerHTML = `${base}<br>你被打击了。是智子干扰，还是对方本性如此？读心需要 1 分（若是干扰则退还）${fee}。`;
    setActions([
      { label: payToRead ? `读心（1 分 + ${READ_FEE_LABEL}）` : '读心（1 分）', cls: 'primary', onClick: () => readMind(round, aiReads) },
      { label: '忍下', onClick: () => resolve({ A: false, B: aiReads }) },
    ]);
  } else {
    $('prompt').innerHTML = base;
    setActions([{ label: '结算本轮', cls: 'primary', onClick: () => resolve({ A: false, B: aiReads }) }]);
  }
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
        onStatus: (msg, hash) => {
          $('prompt').innerHTML = `${msg}…${hash ? `<br><a href="${txUrl(hash)}" target="_blank" rel="noopener noreferrer">在 OKLink 查看交易</a>` : ''}`;
          updateWalletStatus();
        },
      });
    } catch (err) {
      updateWalletStatus();
      $('prompt').innerHTML = `<span class="attack">读心付费没有完成：${friendlyWalletError(err)}</span>`;
      setActions([
        { label: '重试读心', cls: 'primary', onClick: () => readMind(round, aiReads) },
        { label: '忍下', onClick: () => resolve({ A: false, B: aiReads }) },
      ]);
      return;
    }
  }
  return resolve({ A: true, B: aiReads });
}

function updateWalletStatus() {
  const el = $('wallet-status');
  if (!wallet.available) el.textContent = '未检测到钱包插件，可以先不付费试玩';
  else if (wallet.account) el.textContent = `已连接 ${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`;
  else el.textContent = '第一次读心时连接钱包';
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

  const tx = readTxs[r.round] ? ` <a href="${txUrl(readTxs[r.round])}" target="_blank" rel="noopener noreferrer" title="读心交易">交易</a>` : '';
  const readCell = [r.readResult.A && `我→${r.readResult.A === 'interference' ? '识破干扰' : '真打击'}${tx}`, r.readResult.B && `对方→${r.readResult.B === 'interference' ? '识破干扰' : '真打击'}`]
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
  // 结局：对比分数说明地球任务成败，再说这场对局里三体星球文明毁灭了几次。
  const destroyed = starfield.destroyed - destroyedAtStart;
  const fate = A > B ? '你凯旋而归，地球文明在三体星球站稳了脚跟。' : A < B ? '拯救地球失败：殖民舰队被压制，地球人没能等到你的捷报。' : '势均力敌：殖民计划陷入僵局，地球还在等待。';
  const sky = destroyed > 0 ? `这场相遇中，三体星球在三颗太阳的引力下毁灭了 ${destroyed} 次。` : '这场相遇中，三体星球文明安然无恙。';
  $('result-fate').className = A < B ? 'fate lost' : 'fate';
  $('result-fate').innerHTML = `${fate}<small>${sky}</small>`;
  if (era.hidden) starfield.setMode(era.era.id);
  const eraLine = era.hidden ? `本局其实是 <strong>${era.era.name}</strong>（干扰率 ${Math.round(era.era.interferenceRate * 100)}%）。<br>` : '';
  $('result-summary').innerHTML = `最终比分 ${A} : ${B}。${verdict}<br>${eraLine}对方出战的大脑是 <strong>#${ai.id} ${ai.name}</strong>（${ai.gate}）：${ai.desc}。`;
  $('reveal-body').innerHTML = history
    .map((r, i) => `<tr><td>${r.round}</td><td>${plan[i].A ? '<span class="hit">是</span>' : '否'}</td><td>${plan[i].B ? '<span class="hit">是</span>' : '否'}</td><td>${actionText(r.finalAction.A)} : ${actionText(r.finalAction.B)}</td></tr>`)
    .join('');
  $('seed').textContent = seed;
  show('result');
  $('btn-again').focus();
}

$('btn-again').addEventListener('click', () => show('setup'));

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

renderEras();
updateEvaluatorStatus();
// 没检测到钱包时默认不勾选，玩家仍可以不付费试玩；钱包晚注入时刷新一下状态。
$('burn-addr').textContent = BURN_ADDRESS;
if (!wallet.available) $('opt-pay').checked = false;
updateWalletStatus();
window.addEventListener('load', updateWalletStatus);
$('contract-addr').textContent = TAPEOUT.circuits;
$('contract-link').href = TAPEOUT.explorer;
renderCircuits();
