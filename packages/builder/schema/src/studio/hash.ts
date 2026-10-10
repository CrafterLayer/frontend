/**
 * FNV-1a, 64-bit, over the UTF-8 bytes of `text`, as 16 lower-case hex chars.
 *
 * Used for `.ckscripts.json` checksums and for the builtin-preset hash set the
 * door consults with the free-code switch OFF (DESIGN D11). Not a security
 * hash: it identifies reviewed code byte-for-byte, it does not authenticate it.
 *
 * Four 16-bit limbs instead of BigInt: the same answer, several times faster
 * on 32 kB of code, and no BigInt in the hot path of plan validation.
 */
export function fnv1a64(text: string): string {
  // offset basis 0xcbf29ce484222325, low limb first
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;

  const mix = (byte: number): void => {
    h0 ^= byte;
    // × 0x100000001b3: 0x1b3 = 435 on every limb, plus 1 << 40 (= limb 2 shifted by 8)
    const t0 = h0 * 435;
    let t1 = h1 * 435;
    let t2 = h2 * 435;
    let t3 = h3 * 435;
    t2 += h0 << 8;
    t3 += h1 << 8;
    t1 += t0 >>> 16;
    h0 = t0 & 0xffff;
    t2 += t1 >>> 16;
    h1 = t1 & 0xffff;
    h3 = (t3 + (t2 >>> 16)) & 0xffff;
    h2 = t2 & 0xffff;
  };

  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    // Combine a surrogate pair into one code point; a lone surrogate encodes as U+FFFD.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) {
      mix(code);
    } else if (code < 0x800) {
      mix(0xc0 | (code >> 6));
      mix(0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      mix(0xe0 | (code >> 12));
      mix(0x80 | ((code >> 6) & 0x3f));
      mix(0x80 | (code & 0x3f));
    } else {
      mix(0xf0 | (code >> 18));
      mix(0x80 | ((code >> 12) & 0x3f));
      mix(0x80 | ((code >> 6) & 0x3f));
      mix(0x80 | (code & 0x3f));
    }
  }

  const hex = (limb: number): string => limb.toString(16).padStart(4, '0');
  return hex(h3) + hex(h2) + hex(h1) + hex(h0);
}
