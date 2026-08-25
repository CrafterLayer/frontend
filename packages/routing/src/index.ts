export {
  Await,
  BrowserRouter,
  Form,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  createBrowserRouter,
  createMemoryRouter,
  isRouteErrorResponse,
  matchPath,
  redirect,
  useBlocker,
  useLocation,
  useMatch,
  useNavigate,
  useNavigation,
  useParams,
  useRouteError,
  useSearchParams,
} from 'react-router';
export { RouterProvider } from 'react-router/dom';

export type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  Location,
  NavigateFunction,
  Params,
  PatchRoutesOnNavigationFunction,
  PatchRoutesOnNavigationFunctionArgs,
  PathPattern,
  RouteObject,
} from 'react-router';

export { lazyWithRetry } from './lazy-with-retry';
export type { LazyWithRetryOptions, PreloadableLazyComponent } from './lazy-with-retry';
export {
  createDeferredRoutePatcher,
  createPatchRoutesOnNavigation,
  mapRouteTree,
} from './patch-routes-on-navigation';
export type {
  DeferredRoutePatch,
  DeferredRoutePatcher,
  DeferredRoutePatchPath,
  RouteTreeMapper,
} from './patch-routes-on-navigation';
