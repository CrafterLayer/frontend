import { describe, expect, it } from 'vitest';
import { projectPreviewUrl } from './preview-origin';

describe('project preview origin', () => {
  it('gives stable, distinct origins even for project names that are not DNS-safe', async () => {
    const first = await projectPreviewUrl('project/مرحبا');
    expect(first).toBe(await projectPreviewUrl('project/مرحبا'));
    expect(first).not.toBe(await projectPreviewUrl('project/hello'));
    expect(new URL(first).hostname).toMatch(/^p[a-f0-9]{40}\.localhost$/u);
  });

  it('requires a dedicated project hostname and secure deployment URL', async () => {
    for (const template of [
      'http://{project}.example.com',
      'https://preview.example.com/{project}',
      'https://user:secret@{project}.example.com',
      'https://preview.example.com',
      'https://{project}.{project}.example.com',
    ]) {
      await expect(projectPreviewUrl('a', template)).rejects.toThrow();
    }
    expect(await projectPreviewUrl('a', 'https://{project}.preview.example.com/')).toMatch(
      /^https:\/\/p[a-f0-9]{40}\.preview\.example\.com\/$/u,
    );
  });
});
