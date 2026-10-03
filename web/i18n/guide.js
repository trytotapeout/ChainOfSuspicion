// “#5 设计你的大脑”弹窗的中英文内容。长文直接按语言各写一份，比逐句拆键名好维护。
// 三位输入：bit0 对方上一轮，bit1 对方上上轮，bit2 我方上一轮。

export const DESIGN_EXAMPLES = [
  { id: 'tolerant', hex: '0xEE', fn: (o1, o2) => o1 | o2 },
  { id: 'pavlov', hex: '0xA5', fn: (o1, o2, me) => (me === o1 ? 1 : 0) },
  { id: 'grudger', hex: '0x88', fn: (o1, o2) => o1 & o2 },
];

const EXAMPLE_TEXT = {
  zh: {
    tolerant: { name: '宽容执剑人', rule: '对方连续两轮打击才还手', gates: 'OUT = NAND(¬IN0, ¬IN1)，约 3 个 NAND' },
    pavlov: { name: '巴甫洛夫', rule: '赢了保持，输了就换：对方上轮交流就重复我上轮的动作，对方上轮打击就换一种动作', gates: 'OUT = IN0 同或 IN2（XNOR），约 5 个 NAND' },
    grudger: { name: '记仇者', rule: '对方连续两轮交流才肯交流', gates: 'OUT = ¬NAND(IN0, IN1)，约 2 个 NAND' },
  },
  en: {
    tolerant: { name: 'Generous Swordholder', rule: 'Strikes back only after two strikes in a row', gates: 'OUT = NAND(¬IN0, ¬IN1), about 3 NANDs' },
    pavlov: { name: 'Pavlov', rule: 'Win-stay, lose-shift: repeat my last move if the opponent cooperated, switch if it struck', gates: 'OUT = IN0 XNOR IN2, about 5 NANDs' },
    grudger: { name: 'Grudger', rule: 'Cooperates only after two cooperations in a row', gates: 'OUT = ¬NAND(IN0, IN1), about 2 NANDs' },
  },
};

const SPEC_URL = 'https://github.com/trytotapeout/ChainOfSuspicion/blob/main/docs/brain-spec.md';

// action(a) 返回带颜色的动作文字
export function designGuideHtml(lang, action) {
  const text = EXAMPLE_TEXT[lang];
  const [tolerant] = DESIGN_EXAMPLES;
  const rows = [];
  for (let i = 0; i < 8; i++) {
    const [o1, o2, me] = [i & 1, (i >> 1) & 1, (i >> 2) & 1];
    rows.push(`<tr><td>${i}</td><td>${me}</td><td>${o2}</td><td>${o1}</td><td>${action(tolerant.fn(o1, o2, me))}</td></tr>`);
  }
  const examples = DESIGN_EXAMPLES.map((e) => `<tr><td>${text[e.id].name}</td><td><code>${e.hex}</code></td><td>${text[e.id].rule}</td><td>${text[e.id].gates}</td></tr>`).join('');
  return lang === 'en' ? enGuide(text, rows.join(''), examples) : zhGuide(text, rows.join(''), examples);
}

function zhGuide(text, rows, examples) {
  return `
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
    <h3>3. 例子：${text.tolerant.name}（真值表 0xEE）</h3>
    <p>${text.tolerant.rule}。</p>
    <table class="log">
      <thead><tr><th scope="col">输入编号</th><th scope="col">IN2 我上轮</th><th scope="col">IN1 对方上上轮</th><th scope="col">IN0 对方上轮</th><th scope="col">输出</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>真值表可以记成一个 8 位数：第 i 位是输入编号为 i 时的输出。${text.tolerant.name}只有编号 0 和 4（对方连续两轮打击）输出打击，所以是 0xEE。</p>
    <h3>4. 更多思路</h3>
    <table class="log">
      <thead><tr><th scope="col">大脑</th><th scope="col">真值表</th><th scope="col">策略</th><th scope="col">NAND 实现</th></tr></thead>
      <tbody>${examples}</tbody>
    </table>
    <h3>5. 设计提示</h3>
    <ul>
      <li>智子干扰率高的纪元，宽容一点的大脑能扛住误会，少花读心费。</li>
      <li>太宽容会被偷袭者占便宜；太记仇会被一次误会拖进猜疑链。</li>
      <li>你的大脑在对局中是保密的，赛后才公开：设计时要想到对手也在研究你。</li>
    </ul>
    <p class="chain-line">自定义大脑出战暂未开放。接口规范和准入检查见项目文档 <a href="${SPEC_URL}" target="_blank" rel="noopener noreferrer">docs/brain-spec.md</a>。</p>`;
}

function enGuide(text, rows, examples) {
  return `
    <p>The four built-in brains have a single input: the opponent’s last move. A 1-input circuit can only behave in 4 ways, and those are exactly these four. A smarter brain needs to see more history.</p>
    <h3>1. The 3-input interface</h3>
    <table class="log">
      <thead><tr><th scope="col">Pin</th><th scope="col">Meaning</th></tr></thead>
      <tbody>
        <tr><td>IN0</td><td>Opponent’s move last round</td></tr>
        <tr><td>IN1</td><td>Opponent’s move two rounds ago</td></tr>
        <tr><td>IN2</td><td>My move last round</td></tr>
        <tr><td>OUT0</td><td>My move this round</td></tr>
      </tbody>
    </table>
    <p>1 = Cooperate, 0 = Strike. Missing history at the start is padded with 1 (Cooperate). 8 inputs, each mapped to 0 or 1, give 256 possible brains.</p>
    <h3>2. Design steps</h3>
    <ol>
      <li>Decide the strategy, for example “strike back only after two strikes in a row”.</li>
      <li>Write it as an 8-row truth table: what the brain outputs for every input combination.</li>
      <li>Build it from NANDs on the TapeOut canvas: 3 input pins, 1 output pin, no LATCH (sequential cells must be 0, so the same input always gives the same output).</li>
      <li>Self-check locally: toggle all 8 inputs and compare the output with the truth table.</li>
      <li>Tape out to X Layer to get the circuit NFT.</li>
    </ol>
    <h3>3. Example: ${text.tolerant.name} (truth table 0xEE)</h3>
    <p>${text.tolerant.rule}.</p>
    <table class="log">
      <thead><tr><th scope="col">Input #</th><th scope="col">IN2 me last</th><th scope="col">IN1 opp two ago</th><th scope="col">IN0 opp last</th><th scope="col">Output</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>A truth table can be written as an 8-bit number: bit i is the output for input #i. The ${text.tolerant.name} strikes only for inputs 0 and 4 (two opponent strikes in a row), so it is 0xEE.</p>
    <h3>4. More ideas</h3>
    <table class="log">
      <thead><tr><th scope="col">Brain</th><th scope="col">Truth table</th><th scope="col">Strategy</th><th scope="col">NAND build</th></tr></thead>
      <tbody>${examples}</tbody>
    </table>
    <h3>5. Design tips</h3>
    <ul>
      <li>In high-interference eras, a more forgiving brain absorbs misunderstandings and spends less on mind-reading.</li>
      <li>Too forgiving and strikers exploit you; too vengeful and one misunderstanding drags you into the chain of suspicion.</li>
      <li>Your brain stays secret during the match and is revealed after it: assume your opponent is studying you too.</li>
    </ul>
    <p class="chain-line">Custom brains cannot play yet. See the interface spec and admission checks in <a href="${SPEC_URL}" target="_blank" rel="noopener noreferrer">docs/brain-spec.md</a>.</p>`;
}
