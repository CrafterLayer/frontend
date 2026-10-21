import { expect, it } from 'vitest';
import { BASE_UI_DESIGN_TEACHING } from './base-ui-design';

it('bounds optional library guidance and preserves lock, style and RTL ownership', () => {
  expect(BASE_UI_DESIGN_TEACHING.length).toBeLessThan(2400);
  for (const rule of [
    'dependencyLock',
    'Controls are unstyled',
    'no imposed header/footer',
    'BOTH HTML',
    'DirectionProvider',
    'No other Base UI subpath',
    'do not query the editor',
    'change its lock',
  ])
    expect(BASE_UI_DESIGN_TEACHING).toContain(rule);
});
