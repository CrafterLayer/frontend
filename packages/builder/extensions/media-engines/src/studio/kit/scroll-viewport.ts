/** The nearest overflowing scroll container; auto-height clipping wrappers do not own scroll. */
export function sceneScrollViewport(root: Element, win: Window) {
  let parent = root.parentElement;
  while (parent !== null && parent !== root.ownerDocument.body) {
    const overflow = win.getComputedStyle(parent).overflowY;
    if (
      /^(auto|scroll|overlay)$/u.test(overflow) &&
      parent.clientHeight > 0 &&
      parent.scrollHeight > parent.clientHeight
    ) {
      const rect = parent.getBoundingClientRect();
      return {
        top: rect.top + parent.clientTop,
        height: Math.min(parent.clientHeight, win.innerHeight),
        element: parent,
      };
    }
    parent = parent.parentElement;
  }
  return {
    top: 0,
    height: win.innerHeight || root.ownerDocument.documentElement.clientHeight || 1,
    element: undefined,
  };
}
