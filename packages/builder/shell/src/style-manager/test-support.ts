/*
  Test-only stand-ins for browser APIs jsdom does not implement.

  Radix measures popovers with ResizeObserver, and the scrub controls call
  pointer capture. A no-op is the honest stand-in: tests here assert what a
  control writes and announces, never where a popover lands.
*/
import { setUtilityClassOracle } from '@craftkit/builder-schema';

/**
 * The live Tailwind compiler is the class oracle in the app (it renders any
 * real utility, arbitrary values included). Tests have no compiler, so this
 * stand-in admits Tailwind-shaped names and refuses one obviously made-up
 * family, which is enough to prove both paths.
 */
export function installClassOracle(): () => void {
  setUtilityClassOracle((name) => !name.includes('not-a-class') && /^[!\w:[\]().#%/,'=*&>+~-]+$/u.test(name));
  return () => {
    setUtilityClassOracle(undefined);
  };
}

function standIn(target: object, name: string, value: unknown): void {
  if (!Reflect.has(target, name)) {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  }
}

export function installBrowserStandIns(): void {
  standIn(globalThis, 'ResizeObserver', class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  });
  standIn(Element.prototype, 'setPointerCapture', (): void => undefined);
  standIn(Element.prototype, 'releasePointerCapture', (): void => undefined);
  standIn(Element.prototype, 'hasPointerCapture', (): boolean => false);
  standIn(Element.prototype, 'scrollIntoView', (): void => undefined);
  standIn(
    globalThis,
    'PointerEvent',
    class PointerEventStandIn extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    },
  );
}
