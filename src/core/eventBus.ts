import { Subject } from "rxjs";
import { filter } from "rxjs/operators";
import type { ExtensionEvent } from "./EventSystem"; // retains existing typings

/* -------------------------------------------------- *
 *  Singleton RxJS event stream to replace EventBus   *
 * -------------------------------------------------- */
export const bus = new Subject<ExtensionEvent>();

// ---------- API compatible helpers ----------

export function publish<E extends ExtensionEvent>(
  event: Omit<E, "timestamp">
): void {
  bus.next({ ...event, timestamp: Date.now() } as E);
}

export function subscribe<E extends ExtensionEvent>(
  eventTypes: E["type"] | E["type"][],
  handler: (e: E) => void
) {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  const sub = bus
    .pipe(filter((e): e is E => types.includes(e.type as E["type"])))
    .subscribe(handler);

  return { unsubscribe: () => sub.unsubscribe() };
}
