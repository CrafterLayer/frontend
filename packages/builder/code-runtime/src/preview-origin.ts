import { fingerprint } from './fingerprint';

/** Each project gets its own host; raw project names never become DNS labels. */
export async function projectPreviewUrl(
  projectId: string,
  template = 'http://{project}.localhost:5175/',
): Promise<string> {
  if (template.split('{project}').length !== 2)
    throw new Error('Preview URL needs one {project} hostname placeholder.');
  const label = `p${(await fingerprint(projectId)).slice(0, 40)}`;
  const url = new URL(template.replace('{project}', label));
  if (
    !url.hostname.startsWith(`${label}.`) ||
    url.username !== '' ||
    url.password !== '' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && url.hostname.endsWith('.localhost')))
  )
    throw new Error(
      'Preview requires a project-specific HTTPS host or a .localhost development host.',
    );
  return url.href;
}
