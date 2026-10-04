// 大脑和纪元的英文文案。中文以 src/circuits.js、src/eras.js 为准，这里只补英文。

export const CIRCUITS_EN = {
  1: { name: 'Swordholder', gate: 'pass-through', desc: 'I stay calm while you do, and always strike back if you strike', wiring: '4 NANDs in a chain, each with both inputs tied together (an inverter): four inversions cancel out, OUT0 = IN0.' },
  2: { name: 'Contrarian', gate: 'NOT', desc: 'I strike when you cooperate, and cooperate when you strike', wiring: '3 NANDs in a chain, each an inverter: three inversions, OUT0 = ¬IN0.' },
  3: { name: 'Redemptionist', gate: 'constant 1', desc: 'Always believes in good faith', wiring: 'A = NAND(IN0, IN0) = ¬IN0; B = NAND(IN0, A) = ¬(x ∧ ¬x) = 1; then 2 inverter NANDs: OUT0 = 1. 4 NANDs in total.' },
  4: { name: 'Cleaner', gate: 'constant 0', desc: 'Dark forest hunter, strikes at any light', wiring: 'The first two NANDs give constant 1 as in the Redemptionist, then 3 inverter NANDs: OUT0 = ¬1 = 0. 5 NANDs in total.' },
};

export const ERAS_EN = {
  stable: { name: 'Stable Era', desc: 'The three suns behave and the sophons rarely act. A strike is usually sincere, so mind-reading may waste your money.' },
  chaotic: { name: 'Chaotic Era', desc: 'The sky is in chaos and the sophons hijack brains often. A strike is usually a misunderstanding: read minds, or the chain of suspicion takes off.' },
  triple: { name: 'Tri-Solar Day', desc: 'All three suns rise at once and mind-reading fails. Misunderstandings cannot be cleared; your brain alone must survive the chain of suspicion.' },
  flying: { name: 'Flying Star Era', desc: 'One sun stays close while two drift far away as flying stars. The sky looks calm, but the sophons come and go: telling real strikes from fake ones is hardest here.' },
  unknown: { name: 'Unknown Era', desc: 'The game secretly draws Stable or Chaotic and reveals it only after the match. Judge the era yourself from how often you get struck.' },
};
