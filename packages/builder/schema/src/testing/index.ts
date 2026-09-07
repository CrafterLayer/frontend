/*
  Deterministic sites for tests, at layer 0 so every layer above can reach them.
  Nothing here is shipped: the subpath exists so a fixture is never re-invented
  per package, which is how six packages end up with six ideas of a valid site.
*/
export { fivePageSite, onePageSite, siteWithSharedRegions } from './site-fixtures';
