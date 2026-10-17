import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FixturePicker } from './FixturePicker';

describe('FixturePicker', () => {
  it('reflects the value and reports selection changes', async () => {
    const onChange = vi.fn();
    render(<FixturePicker value="landing" onChange={onChange} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'code-view');
    expect(onChange).toHaveBeenCalledWith('code-view');
  });

  it('names the field and its fixtures in the editor language', () => {
    render(
      <FixturePicker
        value="empty"
        onChange={vi.fn()}
        labels={{
          label: 'المستند التجريبي',
          fixtures: {
            landing: 'صفحة تسويقية',
            empty: 'صفحة فارغة',
            inline: 'تحرير مباشر',
            'code-view': 'عرض الشيفرة',
            'code-page': 'صفحة TSX مكتوبة',
          },
        }}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'المستند التجريبي' });
    expect(select).toHaveDisplayValue('صفحة فارغة');
  });
});
