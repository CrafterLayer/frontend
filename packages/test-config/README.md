# `@craftkit/test-config`

Private, reusable test configuration for React packages and the central Storybook browser
project.

- `@craftkit/test-config/react` creates the shared Vite/Vitest jsdom configuration with
  deterministic mocks and coverage thresholds.
- `@craftkit/test-config/setup` installs Testing Library DOM matchers; Testing Library's
  normal test-runner integration owns automatic cleanup.
- `@craftkit/test-config/storybook` creates the Storybook Vitest project backed by
  Playwright Chromium.

Members own their include patterns and Storybook config path. Product-specific providers,
fixtures, and domain helpers stay with the owning feature until a real reusable contract
exists.
