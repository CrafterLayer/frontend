import { fillSlotPhotos, pagePhotoPlan } from './kit-slots';
import { instantiatePlanKit, planKit } from './kits';
import type { PagePlan, SectionContract } from './types';

/** Only template compositions can materialize a planner-filled kit. */
export function kitRegion(
  plan: PagePlan,
  contract: SectionContract,
): { readonly kit: string; readonly tree: unknown; readonly css: string } | undefined {
  if (
    plan.design?.composition === 'bespoke' ||
    contract.slots === undefined ||
    contract.role === 'header' ||
    contract.role === 'footer'
  ) {
    return undefined;
  }
  const kit = planKit(contract.kit);
  if (kit === undefined) return undefined;
  // Each image gets the photo the plan assigned this section: no photo twice on a page.
  const slots = fillSlotPhotos(
    kit,
    contract.slots,
    contract.key,
    pagePhotoPlan(plan),
    plan.locale.lang,
  );
  const filled = instantiatePlanKit(kit, slots, contract, plan.locale);
  return filled.ok ? { kit: kit.id, tree: filled.region.tree, css: filled.region.css } : undefined;
}
