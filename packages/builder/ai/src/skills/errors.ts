export class AiSkillRegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AiSkillRegistryError';
    this.code = code;
  }
}

export class AiSkillResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AiSkillResolutionError';
    this.code = code;
  }
}

export class AiCommandPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AiCommandPolicyError';
    this.code = code;
  }
}
