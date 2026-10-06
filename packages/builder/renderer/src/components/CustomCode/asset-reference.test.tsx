import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { customCodeAssetId, customCodeAssetSrc, type AssetEntry } from '@craftkit/builder-schema';

import { resolveCustomCodeAssetSrc } from '../../assets/asset-table';
import { AssetTableProvider } from '../../assets/AssetTableProvider';
import { CustomCode } from './CustomCode';

const upload: AssetEntry = {
  id: 'up 1',
  url: 'data:image/webp;base64,AAAA',
  description: 'Beach',
  mood: [],
  palette: [],
  alt: 'Beach',
  width: 10,
  height: 10,
};

describe('tree asset references (/ck-assets/<id>)', () => {
  it('round-trips an id through the address', () => {
    expect(customCodeAssetSrc('up 1')).toBe('/ck-assets/up%201');
    expect(customCodeAssetId('/ck-assets/up%201')).toBe('up 1');
    expect(customCodeAssetId('/elsewhere/up')).toBeUndefined();
    expect(resolveCustomCodeAssetSrc('/ck-assets/missing', {})).toBe('/ck-assets/missing');
  });

  it('draws the asset table entry an img points at', () => {
    const { container } = render(
      <AssetTableProvider assets={{ 'up 1': upload }}>
        <CustomCode
          hostId="host"
          tree={{
            kind: 'root',
            children: [{ kind: 'element', tag: 'img', attributes: { src: customCodeAssetSrc('up 1'), alt: 'Beach' } }],
          }}
        />
      </AssetTableProvider>,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(upload.url);
  });
});
