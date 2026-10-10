import type { RuntimeSnapshot } from '@craftkit/builder/code-runtime';

/** Hand-authored capability fixture, NOT provider quality evidence or a production app template. */
export function frontendFixture(): RuntimeSnapshot {
  return {
    projectId: 'frontend-qa',
    pageId: 'dashboard',
    address: '/',
    entry: 'pages/dashboard/index.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      revision: 'frontend-qa-r1',
      runtimeProfile: 'craftkit-react-v1',
      dependencyLock: {
        catalogVersion: 'craftkit-managed-reference-v1',
        packages: { react: '19.2.8', 'react-dom': '19.2.8' },
      },
      files: {
        'pages/dashboard/index.tsx': {
          language: 'tsx',
          source: `import {useState} from 'react';
const samples=[{name:'Demo launch',status:'Active'},{name:'Demo research',status:'Draft'}];
export default function Dashboard(){
 const [search,setSearch]=useState(''); const [status,setStatus]=useState('All');
 const [step,setStep]=useState(0); const [email,setEmail]=useState(''); const [error,setError]=useState('');
 const rows=samples.filter(row=>row.name.toLowerCase().includes(search.toLowerCase())&&(status==='All'||row.status===status));
 function advance(event){event.preventDefault(); if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){setError('Enter a valid email');return;}setError('');setStep(1);}
 return <main className="p-6 mx-auto max-w-5xl"><header><p>Local demo · no server connection</p><h1>Project workspace</h1></header>
 <section aria-labelledby="projects"><h2 id="projects">Projects</h2><div className="flex flex-wrap gap-4">
 <label>Search<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Active</option><option>Draft</option></select></label></div>
 {rows.length===0?<p role="status">No matching projects</p>:<table><caption>Sample projects</caption><thead><tr><th scope="col">Name</th><th scope="col">Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.status}</td></tr>)}</tbody></table>}</section>
 <section aria-labelledby="brief"><h2 id="brief">Create a local brief</h2><p>Step {step+1} of 2</p>
 {step===0?<form onSubmit={advance} noValidate><label htmlFor="email">Email</label><input id="email" type="email" value={email} aria-invalid={error!==''} aria-describedby={error?'email-error':undefined} onChange={e=>setEmail(e.target.value)}/>{error&&<p role="alert" id="email-error">{error}</p>}<button type="submit">Next</button></form>:<div><p>Review: {email}</p><p>Saved in this demo only; nothing has been sent.</p><button type="button" onClick={()=>setStep(0)}>Back</button></div>}</section></main>;
}`,
        },
      },
    },
  };
}
