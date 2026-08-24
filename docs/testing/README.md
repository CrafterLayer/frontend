# Testing Documentation

**Status:** Current workspace test contract; product journey suites remain app-owned.

## Guide

- [`strategy.md`](strategy.md) — test layers, UI definition of done, exact commands,
  coverage, Storybook browser/a11y evidence, and CI trust boundaries.

This directory documents workspace-wide testing strategy and reusable test support. The
required layers are:

1. pure unit tests for domain transformations and utilities;
2. component tests for user-visible behavior and accessibility;
3. Storybook stories and interaction tests for meaningful UI states;
4. integration tests at API, state, routing, or package boundaries;
5. browser end-to-end tests for critical product journeys; and
6. static Storybook and application builds as release evidence.

Tests live beside the source when ownership is local. Shared fixtures, provider renderers,
and test utilities belong in an intentional `packages/testing` contract after the first
approved plan confirms the need.

Vitest and Testing Library own React component behavior; Node's runner owns dependency-free
workspace tooling; Storybook plus Playwright own rendered interaction and axe evidence. Do
not use snapshot-only tests as proof of behavior. Every documented command must state its
scope and expected result.
