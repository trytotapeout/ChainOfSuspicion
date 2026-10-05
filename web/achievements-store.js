// 成就记录：存在浏览器本地（localStorage），只有这台设备、这个浏览器能看到。
// 格式：{ 成就 id: 第一次解锁的时间戳 }

const KEY = 'chainofsuspicion.achievements';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function unlocked() {
  return read();
}

// 记录本局解锁的成就，返回其中第一次解锁的（界面标“新解锁”）
export function record(ids) {
  const saved = read();
  const fresh = ids.filter((id) => !(id in saved));
  for (const id of fresh) saved[id] = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // 隐私模式下可能写不进去：只是记不住，不影响游戏
  }
  return fresh;
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}
