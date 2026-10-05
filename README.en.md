# Chain of Suspicion 猜疑链

[中文](README.md) | English

Play online: https://trytotapeout.github.io/ChainOfSuspicion/

An on-chain strategy game built on [TapeOut](https://tapeout.net). The Trisolaran brains are real circuits taped out on X Layer: their thinking is transparent, the same input always gives the same output, and anyone can recompute it. Every computation in the game is an on-chain call to the circuit’s `eval`.

> Earth’s environment is collapsing, and humanity sends you aboard a starship to colonize the Trisolaran world. Trisolarans cannot lie: their thoughts are transparent. Your brain has been given a mind-reading ability that costs OKB to use. But be careful: when a Trisolaran brain strikes you, it may be the sophons at work.

## Game rules

### How a match works

You and a computer opponent each pick a brain and meet for several rounds. Each round, a brain looks at the opponent’s previous move and automatically plays this round’s move: Cooperate (1) or Strike (0). In round 1 the opponent is assumed to have cooperated. You cannot see which brain the opponent picked until the match is over.

You only make two decisions: which brain to pick, and whether to read the opponent’s mind when you are struck.

### The four brains

| Brain | Circuit | Opponent cooperated | Opponent struck | TapeID | Mint tx |
|---|---|---|---|---|---|
| #1 Swordholder | pass-through | Cooperate | Strike | 1.2.271 | [0x18a70855…](https://www.oklink.com/x-layer/evm/tx/0x18a70855fa03cdb0373e0cf25e8e4b1bd94541bbae0dd7ac5ab5435a51e62423) |
| #2 Contrarian | NOT | Strike | Cooperate | 2.2.271 | [0x7c6ec250…](https://www.oklink.com/x-layer/evm/tx/0x7c6ec250b7bbb37000c548ca147247fcf0262fa77de448c927e505cbc3bd25c3) |
| #3 Redemptionist | constant 1 | Cooperate | Cooperate | 3.2.271 | [0x036e8cf6…](https://www.oklink.com/x-layer/evm/tx/0x036e8cf69e81ff5ef3a5399939e8fd62d748cb270c01f05aad7e8902b158c2f2) |
| #4 Cleaner | constant 0 | Strike | Strike | 4.2.271 | [0xae48453a…](https://www.oklink.com/x-layer/evm/tx/0xae48453a32e898279c041c2bc8f591240791979afddcce004ab9d1506608a04b) |

### Scoring

| Situation | You | Opponent |
|---|---|---|
| Both cooperate | 3 | 3 |
| You strike, opponent cooperates | 5 | 0 |
| You cooperate, opponent strikes | 0 | 5 |
| Both strike | 1 | 1 |

In a single round striking always scores more, but if everyone strikes, everyone gets only 1 point. That is the dark forest.

### Sophon interference

Each round, each side has a chance of being hijacked by the sophons: its brain is temporarily replaced by #4 Cleaner and strikes against its will. The circuits themselves are always honest; the lie happens only in the game’s scheduling layer. You are told when your own brain is interfered with; whether the opponent was interfered with is revealed only after the match.

A single misunderstanding can trigger endless retaliation. That is the chain of suspicion. The match screen draws it as a real chain: one link per round, intact when both cooperate, cracked when one side strikes, split when both strike, and welded when mind-reading catches the sophons. The opponent brain is a face-down card that flips over after the match.

Each match ends with a title based on that chain (such as “Sophon Breaker” or “Dark Forest Hunter”) and unlocks achievements, 10 in total, saved in your browser. The result page can generate a 1200×630 battle report image and a ready-to-post text for X.

### Mind-reading

When struck, you can spend 1 point to read the opponent’s mind: the round is re-evaluated on chain with the opponent’s original brain.

- If it comes out as Cooperate, it was the sophons. The round is set back to the real moves, your fee is refunded, and the chain of suspicion is cut.
- If it is still Strike, that is the opponent’s nature, and you lose 1 point.

With “burn OKB for each mind-read” ticked, each read also sends a transaction on X Layer from your wallet that burns 0.0001 OKB to the address `0x000000000000000000000000000000000000dEaD`. That OKB is never refunded, whatever the result, and the read only happens after the transaction confirms. This is a real, irreversible on-chain cost; without the option, mind-reading only costs game points.
### Pre-match commitment (rules on chain before play)

With “commit a hash of the match rules to X Layer” ticked, your wallet sends a 0 OKB transaction to itself before play (gas only, paid by the connected wallet). Its data is:

```
"chainofsuspicion:commit:" + keccak256(chainofsuspicion:v1|seed=…|salt=…|era=…|ai=…|rounds=…|rate=…)
```

The commitment covers the whole interference plan (generated from the seed), the real era and the opponent brain. The preimage is revealed after the match, and the “Verify on chain” button on the result page reads the transaction back through a public RPC, checks the hash, and replays the interference plan from the seed. That proves the rules were on chain before play and were not changed during the match. Verification needs no wallet; anyone can do it.

In single-player mode the seed is generated by your own browser, so the commitment proves the plan was not changed mid-match, but it cannot stop players from peeking at their own plan. Making the plan unpredictable to both sides needs PvP with secrets from both players, or a game contract with VRF; that is on the roadmap.

### Eras

The era you pick sets the number of rounds, the sophon interference rate and whether mind-reading is allowed:

| Era | Rounds | Interference | Mind-reading |
|---|---|---|---|
| Stable Era | 10 | 5% | Yes |
| Chaotic Era | 10 | 40% | Yes |
| Tri-Solar Day | 6 | 30% | No |
| Flying Star Era | 10 | 20% | Yes |
| Unknown Era | 10 | Random | Yes; secretly Stable or Chaotic, revealed after the match |

The page background is a live gravity simulation of the Trisolaran system: the three suns are numerically integrated and follow the selected era. The Stable Era is the figure-eight periodic orbit, the Chaotic Era is chaotic motion, the Tri-Solar Day is the collinear solution with all three suns in a line, and the Flying Star Era is one nearby sun plus two distant suns orbiting each other. Each time the Trisolaran planet falls into a sun or is flung out of the system, its civilization is destroyed. At the end of each match the game tells you how many times that happened during the encounter, and whether your colony mission returned in triumph or failed to save Earth.

More examples are under “Help / Rules” at the top right of the page, and each brain’s inputs and outputs are explained behind the “!” on its card. The “#5 Design your brain” card explains how to design smarter brains with three inputs; custom brains cannot play yet.

## On-chain details

- Chain: X Layer mainnet (chainId 196)
- Circuit contract: [`0x2503025c0355a005a60cd93c971e4e816456c8bd`](https://www.oklink.com/x-layer/evm/address/0x2503025c0355A005a60CD93c971E4e816456c8bd)
- Call: `eval(uint256 circuitId, bytes input)`, a free read-only call; inputs and outputs are packed in little-endian bit order, bit0 is IN0 / OUT0
- The NFT ids of the four brains are circuit ids 1 to 4; their on-chain netlists use 4, 3, 4 and 5 NANDs, 16 in total

## Development

Requires Node.js 18 or later. The project has no third-party dependencies, so there is no `npm install`.

```bash
npm start              # local server: http://localhost:5173/web/ (change the port with PORT)
npm test               # unit tests
npm run verify-chain   # online check: run all 4 brains' truth tables through on-chain eval and compare with the local simulation
npm run simulate       # batch-simulate every brain matchup to tune balance
npm run build          # build into github_pages/ for GitHub Pages
npm run preview        # build, then preview the result at http://localhost:5173/ChainOfSuspicion/
```

`npm run simulate` takes arguments: `npm run simulate -- rate rounds games`, for example `npm run simulate -- 0.4 10 2000`.

Switch between 中文 and English at the top right of the page. The choice is saved in the browser; on the first visit the browser language decides. The footer shows the version.

The local server only listens on `127.0.0.1` and has no authentication; it is for local development and play only.

You can choose “Local simulation (offline)” at the start: the circuits are then simulated in code without any network access, which is handy for offline development.

### Publishing to GitHub Pages

Browsers load native ES modules directly, so “building” just copies `web/` and `src/` into `github_pages/` as they are and lifts the entry page to `github_pages/index.html`. All paths in the page are relative, so it works under a sub-path such as `https://<user>.github.io/ChainOfSuspicion/`. `github_pages/.nojekyll` tells GitHub Pages to skip Jekyll processing.

1. After changing code, run `npm run build` and commit and push the updated `github_pages/` along with it.
2. On push to `main`, GitHub Actions (`.github/workflows/pages.yml`) publishes `github_pages/` to Pages. In Settings → Pages, Source must be “GitHub Actions”.
3. A minute or two later, open https://trytotapeout.github.io/ChainOfSuspicion/ .

GitHub Pages is enabled only on the main repository [trytotapeout/ChainOfSuspicion](https://github.com/trytotapeout/ChainOfSuspicion) (public), not on the backup.

`github_pages/` is generated output; do not edit it by hand. Change the source and run `npm run build` again.

### Layout

```
src/
  engine.js            match rules: scoring, sophon interference, mind-reading
  circuits.js          metadata of the 4 brains (TapeID, NFT id, wiring, netlist) and the contract address
  eras.js              era parameters
  ai.js                computer opponent: picks a brain, decides when to read minds
  wallet.js            wallet: connect, switch to X Layer, mind-reading burn tx, commitment tx, read txs
  version.js           version number (kept equal to package.json)
  rng.js               reproducible PRNG (the same seed gives the same interference plan)
  netlist.js           simulates a circuit from its on-chain netlist (gate format in the file comments)
  achievements.js      titles and achievements computed from a match
  chain.js             chain of suspicion: link state per round, where the chain started
  commit.js            pre-match commitment: preimage and hash, tx data encoding, post-match verification
  keccak.js            dependency-free keccak256 in plain JS
  threebody.js         three-body numerical simulation (leapfrog integrator) for the background
  evaluators/
    tapeout.js         on-chain evaluator: calls eval on X Layer
    local.js           local evaluator: simulates the 4 circuits in code
web/                   browser UI (plain HTML / CSS / JS modules)
  i18n.js              language switch: current language, translate function, static text
  i18n/                UI strings (zh.js and en.js with matching keys), English brain and era text, design guide
  starfield.js         background: Canvas rendering of the live three-body simulation, follows the era
  brainviz.js          brain cards: wireframe brain + on-chain NAND netlist, signals propagate on hover / select
  eraviz.js            era cards: sky, thermometer, light gauge (flavor only, not scored)
  chainviz.js          chain of suspicion: one link per round, intact / welded / cracked / split
  sharecard.js         battle report image (Canvas, 1200×630)
  achievements-store.js achievement records (saved in the browser)
scripts/               local server, build, batch simulation, on-chain check
github_pages/          output of npm run build, published to Pages by GitHub Actions (generated, do not edit)
test/                  unit tests (node:test)
BRAIN_SPEC.md          interface spec and admission checks for player-designed brains (future work; in Chinese)
```

### Extension point

The engine only calls circuits through the evaluator interface:

```js
evaluate(circuitId, input) → Promise<0 | 1>
```

Switching the circuit source, for example to circuits taped out by players, only needs a new evaluator; scoring, interference, mind-reading and the UI stay the same. The interface and admission rules for player-designed brains are in [BRAIN_SPEC.md](BRAIN_SPEC.md).

## Contributing

Help make Chain of Suspicion better: bug fixes, new brains and eras, balance tuning, UI and copy improvements, translations — open a PR against [trytotapeout/ChainOfSuspicion](https://github.com/trytotapeout/ChainOfSuspicion). Feel free to open an Issue first to discuss ideas.

Before opening a PR:

1. `npm test` passes; if you touched circuit logic, also run `npm run verify-chain`.
2. If you changed the UI, run `npm run build` and commit the updated `github_pages/` too.
3. Any new UI text exists in both `web/i18n/zh.js` and `en.js`.

To design your own 3-input brain, start with [BRAIN_SPEC.md](BRAIN_SPEC.md).

## License

This project is open source under the [GNU General Public License v3.0](LICENSE) or any later version (GPL-3.0-or-later). You may use, modify and distribute it freely; if you distribute a modified version (including deploying a modified web page for others to use), you must release its source code under GPL-3.0 or a later version as well. “Or later” means that when the Free Software Foundation publishes a new version of the GPL, you may also choose to follow its terms.

The license covers only the code and docs in this repository. Ownership of the on-chain circuit NFTs is determined by on-chain holdings, and the names and setting from *The Three-Body Problem* belong to their original author; this project is a fan tribute.
