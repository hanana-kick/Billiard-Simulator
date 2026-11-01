/** Removable native-operation waiters. Unlike Promise.race with one lifetime
 * loss promise, completed operations leave no reaction attached to that promise.
 * Only the bridge's actual device.lost observer may call deviceLost: cancellation,
 * timeout, or a host error does NOT establish completion of physical GPU work. */
export function createDeviceLossWaiters() {
  const pending = new Set();
  let lost = null;
  return Object.freeze({
    wait(nativeOperation) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (failed, value) => {
          if (settled) return;
          settled = true;
          pending.delete(onLoss);
          if (failed) reject(value); else resolve(value);
        };
        const onLoss = reason => settle(true, reason);
        // Always observe both native outcomes, including late outcomes after loss.
        Promise.resolve(nativeOperation).then(value => settle(false, value), error => settle(true, error));
        if (lost) onLoss(lost); else pending.add(onLoss);
      });
    },
    deviceLost(reason) {
      if (lost) return;
      lost = reason instanceof Error ? reason : new Error(String(reason ?? 'GPU device lost'));
      for (const reject of pending) reject(lost);
      pending.clear();
    },
    get pendingCount() { return pending.size; },
  });
}
