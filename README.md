# 猜疑链 Chain of Suspicion

中文 | [English](README.en.md)

在线试玩：https://trytotapeout.github.io/ChainOfSuspicion/

一个基于 [TapeOut](https://tapeout.net) 的链上博弈游戏。三体人的大脑是在 X Layer 上流片的真实电路：思考透明、相同输入一定得到相同输出，任何人都能复算。游戏里的每一次计算，都通过链上调用电路的 `eval` 完成。

> 地球环境日益恶化，人类派你乘坐星舰去殖民三体星球。三体人不会撒谎，思考透明。你的大脑被注入了读心术，可以消耗 OKB 使用。但要注意：三体大脑打击了你，也可能是智子在作祟。

## 游戏规则

### 一局怎么玩

你和电脑对手各选一个大脑出战，连续相遇若干轮。每一轮，大脑根据对方上一轮的动作自动输出本轮动作：交流（1）或打击（0）。第 1 轮默认对方上一轮是交流。对局中你看不到对方选了哪个大脑，赛后才公开。

你只需要做两个决定：开局选哪个大脑，以及被打击时要不要读心。

### 四个大脑

| 大脑 | 电路 | 对方交流时 | 对方打击时 | TapeID | 铸造交易 |
|---|---|---|---|---|---|
| #1 执剑人 | 传递 | 交流 | 打击 | 1.2.271 | [0x18a70855…](https://www.oklink.com/zh-hans/x-layer/evm/tx/0x18a70855fa03cdb0373e0cf25e8e4b1bd94541bbae0dd7ac5ab5435a51e62423) |
| #2 逆行者 | 取反 | 打击 | 交流 | 2.2.271 | [0x7c6ec250…](https://www.oklink.com/zh-hans/x-layer/evm/tx/0x7c6ec250b7bbb37000c548ca147247fcf0262fa77de448c927e505cbc3bd25c3) |
| #3 拯救派 | 恒 1 | 交流 | 交流 | 3.2.271 | [0x036e8cf6…](https://www.oklink.com/zh-hans/x-layer/evm/tx/0x036e8cf69e81ff5ef3a5399939e8fd62d748cb270c01f05aad7e8902b158c2f2) |
| #4 清理者 | 恒 0 | 打击 | 打击 | 4.2.271 | [0xae48453a…](https://www.oklink.com/zh-hans/x-layer/evm/tx/0xae48453a32e898279c041c2bc8f591240791979afddcce004ab9d1506608a04b) |

### 计分

| 情况 | 你 | 对方 |
|---|---|---|
| 都交流 | 3 | 3 |
| 你打击，对方交流 | 5 | 0 |
| 你交流，对方打击 | 0 | 5 |
| 都打击 | 1 | 1 |

单看一轮，打击总能多拿分；可如果大家都打击，所有人都只剩 1 分。这就是黑暗森林。

### 智子干扰

每一轮，双方各自有一定概率被智子操控：大脑被临时换成 #4 清理者，打出一次并非本意的打击。电路本身永远诚实，撒谎只发生在游戏调度层。你自己被干扰时界面会提示你；对方有没有被干扰，要到赛后才公开。

一次误会可能引发无休止的互相报复，这就是猜疑链。

### 读心

被打击时，可以花 1 分读心：用对方原本的大脑在链上重新计算这一轮。

- 算出来是交流：说明是智子干扰。这一轮改回真实动作，读心费退还，猜疑链被切断。
- 算出来还是打击：说明对方本性如此，扣 1 分。

开局勾选“读心时用钱包烧 OKB”后，每次读心还要用钱包在 X Layer 上发一笔交易，把 0.0001 OKB 打进黑洞地址 `0x000000000000000000000000000000000000dEaD`。这笔 OKB 不论结果如何都不退还，交易确认后才会读心。这是真实的链上消耗，不可撤销；不勾选时读心只扣游戏分。

### 开局承诺（规则提前上链）

开局勾选“把本局规则的哈希承诺写上 X Layer”后，开打前会用钱包发一笔给自己的 0 OKB 交易（只花 Gas，由当前钱包支付），交易 data 是：

```
"chainofsuspicion:commit:" + keccak256(chainofsuspicion:v1|seed=…|salt=…|era=…|ai=…|rounds=…|rate=…)
```

承诺里包含整局的干扰计划（由 seed 生成）、真实纪元和对手大脑。赛后公开原文，结果页的“链上验证”按钮会用公共 RPC 读回这笔交易，核对哈希，并用 seed 重放干扰计划，确认本局规则在开局前就已上链、对局中没有被改过。验证不需要钱包，任何人都能做。

单机模式下 seed 由你的浏览器生成，承诺能证明“计划中途没改过”，但不能防止玩家自己提前看到计划。要做到双方都无法预知，需要 PvP 双方共同提交秘密，或者用游戏合约加 VRF，这是后续路线。

### 纪元

开局选择纪元，决定轮数、智子干扰率和能否读心：

| 纪元 | 轮数 | 干扰率 | 读心 |
|---|---|---|---|
| 恒纪元 | 10 | 5% | 可以 |
| 乱纪元 | 10 | 40% | 可以 |
| 三日凌空 | 6 | 30% | 禁止 |
| 飞星纪元 | 10 | 20% | 可以 |
| 未知纪元 | 10 | 随机 | 可以，从恒纪元、乱纪元里随机抽一个，赛后公开 |

页面背景是三体星系的实时引力模拟：三颗太阳的运动是数值积分算出来的，跟随纪元切换。恒纪元是 8 字形周期解，乱纪元是混沌运动，三日凌空是三颗太阳排成一线的共线解，飞星纪元是一颗近处的太阳加上远处两颗互相绕转的飞星。三体星球坠入太阳或被甩出星系，就记一次文明毁灭；每局结束时会告诉你这场相遇中三体星球毁灭了几次，以及你的殖民任务是凯旋而归还是拯救地球失败。

更多例子见游戏页面右上角的“帮助 / 规则”，每个大脑的输入输出说明见卡片右上角的“!”。“#5 设计你的大脑”卡片介绍了用三位输入设计更聪明大脑的方法，自定义大脑出战暂未开放。

## 链上信息

- 链：X Layer 主网（chainId 196）
- 电路合约：[`0x2503025c0355a005a60cd93c971e4e816456c8bd`](https://www.oklink.com/zh-hans/x-layer/evm/address/0x2503025c0355A005a60CD93c971E4e816456c8bd)
- 调用方式：`eval(uint256 电路号, bytes 输入)`，免费的只读调用；输入输出按小端位序打包，bit0 是 IN0 / OUT0
- 4 个大脑的 NFT 编号就是电路号 1～4，链上网表分别是 4、3、4、5 个 NAND，共 16 个

## 开发

需要 Node.js 18 或更高版本，项目没有任何第三方依赖，不需要 `npm install`。

```bash
npm start              # 启动本地服务器：http://localhost:5173/web/（可用 PORT 环境变量改端口）
npm test               # 运行单元测试
npm run verify-chain   # 联网核对：用链上 eval 跑 4 个大脑的真值表，和本地模拟对比
npm run simulate       # 批量模拟各大脑两两对战的平均得分，用来调平衡
npm run build          # 打包到 docs/，用于 GitHub Pages 发布
npm run preview        # 打包后在 http://localhost:5173/ChainOfSuspicion/ 预览打包结果
```

`npm run simulate` 可以带参数：`npm run simulate -- 干扰率 轮数 局数`，例如 `npm run simulate -- 0.4 10 2000`。

页面右上角可以切换中文 / English，选择会记在浏览器里；第一次打开时按浏览器语言决定。页面底部显示版本号。

本地服务器只监听 `127.0.0.1`，没有鉴权，只用于本地开发和试玩。

开局可以选“本地模拟（离线）”，这时电路由代码模拟，不访问网络，适合断网时开发。

### 发布到 GitHub Pages

浏览器直接加载原生 ES module，所以“打包”只是把 `web/` 和 `src/` 原样复制到 `docs/`，入口页提到 `docs/index.html`。页面里的路径都是相对路径，部署在 `https://<用户>.github.io/ChainOfSuspicion/` 这种子路径下也能用。`docs/.nojekyll` 让 GitHub Pages 跳过 Jekyll 处理。

1. 改完代码后运行 `npm run build`，把更新后的 `docs/` 一起提交推送。
2. GitHub 仓库 Settings → Pages → Build and deployment → Source 选 “Deploy from a branch”，分支选 `main`，目录选 `/docs`，保存。
3. 几分钟后访问 https://trytotapeout.github.io/ChainOfSuspicion/ 。

GitHub Pages 只在主仓库 [trytotapeout/ChainOfSuspicion](https://github.com/trytotapeout/ChainOfSuspicion)（公开）上开启，备份仓库不开。

`docs/` 是生成目录，不要手动修改，改源码后重新运行 `npm run build`。

### 目录结构

```
src/
  engine.js            对局规则：计分、智子干扰、读心
  circuits.js          4 个大脑的元数据（TapeID、NFT 编号、接法）和合约地址
  eras.js              纪元参数
  ai.js                电脑对手：选大脑、决定是否读心
  wallet.js            钱包：连接、切换 X Layer、读心烧币交易、开局承诺交易、读取链上交易
  version.js           版本号（和 package.json 一致）
  rng.js               可复现的伪随机数（同一个 seed 生成同一份干扰计划）
  netlist.js           按链上网表模拟电路（门格式见文件注释）
  commit.js            开局承诺：生成承诺原文和哈希、编码交易 data、赛后验证
  keccak.js            keccak256 的纯 JS 实现（无依赖）
  threebody.js         三体运动数值模拟（蛙跳法积分），驱动背景动画
  evaluators/
    tapeout.js         链上 evaluator：调用 X Layer 上的 eval
    local.js           本地 evaluator：用代码模拟 4 个电路
web/                   浏览器界面（原生 HTML / CSS / JS 模块）
  i18n.js              中英文切换：当前语言、翻译函数、静态文案套用
  i18n/                界面文案（zh.js、en.js 键名一一对应）、大脑和纪元的英文、设计指南
  starfield.js         背景：三体星系实时引力模拟的 Canvas 渲染，随纪元切换
  brainviz.js          大脑卡片：线框大脑 + 链上 NAND 网表，悬停 / 选中时信号逐门传播
  eraviz.js            纪元卡片：天空、温度计、光照条（只营造氛围，不影响计分）
scripts/               本地服务器、打包、批量模拟、链上核对
docs/                  npm run build 的输出，GitHub Pages 从这里发布（生成目录，不要手改）
test/                  单元测试（node:test）
BRAIN_SPEC.md          玩家自定义大脑的接口规范和准入检查（后续扩展）
```

### 扩展点

引擎只通过 evaluator 接口调用电路：

```js
evaluate(circuitId, input) → Promise<0 | 1>
```

更换电路来源（比如接入玩家自己流片的电路）只需要新增一个 evaluator，计分、干扰、读心和界面都不用改。玩家自定义大脑的接口和准入规则见 [BRAIN_SPEC.md](BRAIN_SPEC.md)。

## 参与共建

欢迎一起把猜疑链做得更好：修 bug、加新的大脑和纪元、调平衡、改进界面和文案、补翻译，都可以直接提 PR 到 [trytotapeout/ChainOfSuspicion](https://github.com/trytotapeout/ChainOfSuspicion)。也欢迎先开 Issue 聊想法。

提 PR 前请确认：

1. `npm test` 全部通过；改了电路相关逻辑的，再跑一次 `npm run verify-chain`。
2. 改了界面的，运行 `npm run build`，把更新后的 `docs/` 一起提交。
3. 新增的界面文字在 `web/i18n/zh.js` 和 `en.js` 里都要有。

想设计自己的三位输入大脑，可以先读 [BRAIN_SPEC.md](BRAIN_SPEC.md)。

## 开源协议

本项目以 [GNU General Public License v3.0](LICENSE) 或更高版本（GPL-3.0-or-later）开源。你可以自由使用、修改和分发；分发修改后的版本（包括把改过的网页部署给别人访问）时，需要同样以 GPL-3.0 或更高版本公开源代码。“或更高版本”指的是：将来自由软件基金会发布新版 GPL 时，你也可以选择按新版条款使用本项目。

协议只覆盖本仓库的代码和文档。链上电路 NFT 的归属由链上持有权决定；《三体》相关的名称与设定版权归原作者所有，本项目是致敬性质的同人作品。
