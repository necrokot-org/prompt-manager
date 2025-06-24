import sinon from 'sinon';

/**
 * Helper function to wrap test code with fake timers
 * Automatically sets up and tears down fake timers for you
 * 
 * @param cb - Callback function that receives the fake timer clock
 * @returns Promise that resolves with the callback's return value
 * 
 * @example
 * ```ts
 * import { withFakeTimers } from '../fakeTimers';
 * 
 * it('debounces refresh', () =>
 *   withFakeTimers(async clock => {
 *     controller.refresh();
 *     clock.tick(300);
 *     expect(spy.calledOnce).to.be.true;
 *   }));
 * ```
 */
export async function withFakeTimers<T>(
  cb: (clock: sinon.SinonFakeTimers) => Promise<T> | T,
): Promise<T> {
  const clock = sinon.useFakeTimers();
  try {
    return await cb(clock);
  } finally {
    clock.restore();
  }
} 