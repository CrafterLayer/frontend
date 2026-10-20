import { creativeCreationKind } from '../../intent/route-intent';

const PLAYBOOKS = {
  game: 'craftkit.pixi-games',
  story: 'craftkit.pixi-stories',
  scene: 'craftkit.pixi-murals',
} as const;

/** A direct creation object wakes its playbook without asking the person for engine keywords. */
export function creativeCreationSkill(request: string): string | undefined {
  const kind = creativeCreationKind(request);
  return kind === undefined ? undefined : PLAYBOOKS[kind];
}

/** Ordinary auto activation keeps the dependency, trust, exclusion and token-budget gates. */
export function creativeCreationSkillMatches(id: string, playbook: string | undefined): boolean {
  return (
    playbook !== undefined &&
    (id === playbook || id === 'craftkit.pixi-v8-core' || id === 'craftkit.pixi-v8-graphics')
  );
}
