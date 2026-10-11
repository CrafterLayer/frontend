export interface StoryChapter {
  id: string;
  enter?: () => void;
  leave?: () => void;
}

export interface SceneStory {
  readonly current: string;
  go(id: string): boolean;
  next(): boolean;
  back(): boolean;
  reset(): boolean;
  dispose(): void;
}

/** Manual, bounded navigation. No timer, autoplay, wraparound or hidden Pixi application. */
export function createStory(chapters: readonly StoryChapter[], initial?: string): SceneStory {
  if (!Array.isArray(chapters) || chapters.length < 1 || chapters.length > 32)
    throw new RangeError('story needs 1..32 chapters');
  const ids = new Set<string>();
  const pages = chapters.map((chapter: StoryChapter): StoryChapter => {
    if (
      typeof chapter.id !== 'string' ||
      !/^[A-Za-z0-9\p{L}_-]{1,64}$/u.test(chapter.id) ||
      ids.has(chapter.id)
    )
      throw new TypeError('story chapter ids must be unique, 1..64 letters/digits/_/-');
    if (
      (chapter.enter !== undefined && typeof chapter.enter !== 'function') ||
      (chapter.leave !== undefined && typeof chapter.leave !== 'function')
    )
      throw new TypeError('story callbacks must be functions');
    ids.add(chapter.id);
    return { ...chapter };
  });
  const start = initial === undefined ? 0 : pages.findIndex((page) => page.id === initial);
  if (start < 0) throw new RangeError('story initial chapter does not exist');
  let index = start;
  let active = true;
  let disposed = false;
  function isDisposed(): boolean {
    return disposed;
  }
  let changing = true;
  function release(): void {
    if (!active) return;
    active = false;
    pages[index]?.leave?.();
  }
  function go(target: number): boolean {
    if (disposed || changing || target < 0 || target >= pages.length || target === index)
      return false;
    changing = true;
    try {
      release();
      if (isDisposed()) return false;
      index = target;
      active = true;
      pages[index]?.enter?.();
      return !disposed;
    } finally {
      changing = false;
      if (isDisposed()) release();
    }
  }
  const story: SceneStory = {
    get current() {
      return pages[index]?.id ?? '';
    },
    go: (id) => go(pages.findIndex((page) => page.id === id)),
    next: () => go(index + 1),
    back: () => go(index - 1),
    reset: () => go(start),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!changing) release();
    },
  };
  try {
    pages[index]?.enter?.();
  } catch (error) {
    disposed = true;
    try {
      release();
    } catch {
      /* retain the original callback error */
    }
    throw error;
  } finally {
    changing = false;
  }
  return story;
}
