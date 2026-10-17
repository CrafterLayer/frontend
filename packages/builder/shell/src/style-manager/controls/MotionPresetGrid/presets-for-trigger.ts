import {
  CUSTOM_CODE_MOTION_PRESETS,
  motionTriggersFor,
  type CustomCodeMotionTrigger,
} from '@craftkit/builder-schema';

/** The presets a trigger can play (the compatibility table of DESIGN §B.2). */
export function presetsForTrigger(trigger: CustomCodeMotionTrigger | undefined): readonly string[] {
  return CUSTOM_CODE_MOTION_PRESETS.filter(
    (preset) => trigger === undefined || motionTriggersFor(preset).includes(trigger),
  );
}
