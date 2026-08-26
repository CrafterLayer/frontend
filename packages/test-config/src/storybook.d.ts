import type { ViteUserConfig } from 'vitest/config';

export interface StorybookTestConfigOptions {
  configDir: string;
  setupFiles?: string[];
}

export declare function createStorybookTestConfig(
  options: StorybookTestConfigOptions,
): ViteUserConfig;
