import type { BuilderSite, CreateBuilderOptions } from '@craftkit/builder';

type Ports = NonNullable<CreateBuilderOptions['ports']>;

/**
 * A reopened SITE's id port: the playground's seeded ids, minus every id the
 * live site already holds (2026-10-12).
 *
 * `playgroundPorts` skips ids the CURRENT page's nodes use, which is all a
 * single document needs. A site has more to collide with: `seededIds('pg')`
 * restarts at `pg-0001` on every boot, and `addPage` and `duplicatePage` take
 * their PAGE id from the same port — so after a reload, adding a page handed
 * out the id of a page added in an earlier session, and the door refused it
 * ("Page id "pg-0001" is used more than once."). Node ids on pages other than
 * the current one (a lens edit, an agent script) were unguarded the same way.
 */
export function siteSafePorts(ports: Ports, live: () => Readonly<BuilderSite> | undefined): Ports {
  const { ids } = ports;
  if (ids === undefined) return ports;
  return {
    ...ports,
    ids: {
      newId() {
        const site = live();
        let id = ids.newId();
        while (site !== undefined && siteHolds(site, id)) {
          id = ids.newId();
        }
        return id;
      },
    },
  };
}

/** Whether `id` names a page, or a node of any page or shared region, in `site`. */
export function siteHolds(site: Readonly<BuilderSite>, id: string): boolean {
  return (
    site.pages.some((page) => page.id === id || Object.hasOwn(page.document.nodes, id)) ||
    Object.values(site.sharedRegions).some((region) => Object.hasOwn(region.document.nodes, id))
  );
}
