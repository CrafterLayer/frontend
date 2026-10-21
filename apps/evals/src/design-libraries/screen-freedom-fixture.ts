import type { RuntimeSnapshot } from '@craftkit/builder/code-runtime';

/** Two authored capability fixtures, not provider outputs or shipped page templates. */
export function screenFreedomFixture(
  kind: 'workspace' | 'library',
  arabic: boolean,
): RuntimeSnapshot {
  const copy = arabic
    ? {
        workspace: 'مركز العمليات',
        library: 'مكتبة الملاحظات',
        nav: 'التنقل',
        filter: 'عرض النشط',
        active: 'نشط',
        all: 'الكل',
        records: 'سجل المشاريع',
        project: 'المشروع',
        owner: 'المسؤول',
        status: 'الحالة',
        period: 'الفترة',
        note: 'بيانات تجريبية محلية',
        title: 'التصميم من الملاحظة',
        summary: 'مساحة للبحث والتجارب والأفكار المرتبطة بالعمل.',
        browse: 'تصفح الملاحظات',
        detail: 'تفاصيل',
        demo: 'تجربة محلية',
        reading: 'قراءة',
        lab: 'مختبر',
        saved: 'محفوظ',
      }
    : {
        workspace: 'Operations desk',
        library: 'Fieldnotes library',
        nav: 'Navigation',
        filter: 'Show active',
        active: 'Active',
        all: 'All',
        records: 'Project records',
        project: 'Project',
        owner: 'Owner',
        status: 'Status',
        period: 'Period',
        note: 'Local demo data',
        title: 'Design begins with observation',
        summary: 'A place for research, experiments and ideas connected to the work.',
        browse: 'Browse notes',
        detail: 'Details',
        demo: 'Local demo',
        reading: 'Reading',
        lab: 'Lab',
        saved: 'Saved',
      };
  const workspace = kind === 'workspace';
  const markup = workspace
    ? `<main className='workspace'>
<aside className='rail'><strong>01 / STUDIO</strong><nav aria-label={copy.nav}><a href='#records'>{copy.records}</a><a href='#metrics'>{copy.detail}</a></nav><p>{copy.demo}</p></aside>
<div className='canvas'><header className='topline'><div><p>{copy.note}</p><h1>{copy.workspace}</h1></div><button onClick={()=>setFiltered(value=>!value)} aria-pressed={filtered}>{filtered?copy.all:copy.filter}</button></header>
<section id='metrics' className='metrics' aria-label={copy.detail}><article><p>{copy.reading}</p><strong>12</strong><span className='signal teal'><bdi dir='ltr'>+04</bdi></span></article><article><p>{copy.lab}</p><strong>08</strong><span className='signal amber'><bdi dir='ltr'>+02</bdi></span></article><article><p>{copy.saved}</p><strong>24</strong><span className='signal blue'><bdi dir='ltr'>+06</bdi></span></article></section>
<div className='records' id='records'><h2>{copy.records}</h2><div className='table-scroll' role='region' aria-label={copy.records} tabIndex={0}><table><caption>{copy.note}</caption><thead><tr><th>{copy.project}</th><th>{copy.owner}</th><th>{copy.status}</th><th>{copy.period}</th></tr></thead><tbody>{(filtered?['North']:['North','Atlas','Orbit']).map((name,index)=><tr key={name}><th scope='row'>{name}</th><td>Studio {index+1}</td><td>{index===0?copy.active:copy.lab}</td><td>2026 / 10</td></tr>)}</tbody></table></div></div><p role='status'>{filtered?copy.active:copy.all}</p></div></main>`
    : `<main className='library'><header className='masthead'><strong>FIELD / 026</strong><nav aria-label={copy.nav}><a href='#notes'>{copy.library}</a><a href='#feature'>{copy.detail}</a></nav></header>
<div className='index-title'><p>{copy.demo}</p><h1>{copy.library}</h1></div><div className='spread'><section className='feature' id='feature'><span className='folio'>026</span><p>STUDIO / ${arabic ? 'ملاحظات' : 'NOTES'}</p><h2>{copy.title}</h2><p>{copy.summary}</p><a href='#notes'>{copy.browse} ↗</a></section>
<section id='notes' className='notes'><div className='notes-heading'><h2>{copy.reading}</h2><button onClick={()=>setFiltered(value=>!value)} aria-pressed={filtered}>{filtered?copy.all:copy.filter}</button></div>{(filtered?['01']:['01','02','03']).map(number=><article key={number}><span>{number}</span><div><h3>{copy.title}</h3><p>{copy.summary}</p></div></article>)}</section></div><p role='status'>{filtered?copy.active:copy.all}</p></main>`;
  return {
    projectId: `screen-${kind}`,
    pageId: 'home',
    address: '/',
    entry: 'index.tsx',
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: 'screen-freedom-r1',
      dependencyLock: {
        catalogVersion: 'craftkit-managed-reference-v1',
        packages: { react: '19.2.9', 'react-dom': '19.2.9' },
      },
      files: {
        'index.tsx': {
          language: 'tsx',
          source: `import {useState} from 'react';import './screen.css';const copy=${JSON.stringify(copy)};export default function Screen(){const [filtered,setFiltered]=useState(false);return ${markup}}`,
        },
        'screen.css': {
          language: 'css',
          source: `*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:${workspace ? '#e8edf2' : '#20261e'};background:${workspace ? '#101820' : '#f3f1e8'}}button,a{font:inherit}button{min-height:44px;cursor:pointer;padding:.6rem 1rem;border:1px solid currentColor;background:transparent;color:inherit}a{color:inherit;text-underline-offset:.3em}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid ${workspace ? '#5eead4' : '#7a3621'};outline-offset:3px}h1,h2,h3,p{margin-block:0 1rem}h1{font-size:clamp(1.75rem,4vw,3.2rem);line-height:1.2}nav{display:flex;gap:1.5rem}nav a{display:inline-flex;align-items:center;min-height:44px}.workspace{display:grid;grid-template-columns:13rem minmax(0,1fr);min-height:100vh}.rail{background:#172432;padding:2rem 1.25rem;display:flex;flex-direction:column;gap:3rem}.rail nav{flex-direction:column;gap:.5rem}.rail>p{margin-block-start:auto;color:#b7c8d5}.canvas{padding:2.5rem;min-width:0}.topline{display:flex;justify-content:space-between;gap:1rem;align-items:center}.topline p,.metrics p{color:#b7c8d5}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-block:2rem}.metrics article{background:#172432;padding:1.25rem;border-block-start:2px solid #506b7d}.metrics strong{display:block;font-size:2.75rem;font-variant-numeric:tabular-nums}.signal{display:inline-block;padding:.25rem .5rem;color:#101820}.teal{background:#5eead4}.amber{background:#fcd34d}.blue{background:#93c5fd}.records{margin-block:3rem 1rem}.table-scroll{max-width:100%;overflow:auto;border:1px solid #506b7d}table{width:100%;min-width:52rem;border-collapse:collapse;text-align:start}caption{text-align:start;padding:1rem;color:#b7c8d5}th,td{background:#101820;color:#e8edf2;padding:1rem;text-align:start;border-block-end:1px solid #506b7d}tbody th{font-weight:500}.library{max-width:90rem;margin:auto;padding:2.5rem 4rem}.masthead{display:flex;align-items:center;justify-content:space-between;border-block-end:2px solid #20261e;padding-block-end:1rem}.index-title{padding-block:3rem 2rem}.index-title h1{font-size:clamp(2.5rem,7vw,6rem);letter-spacing:-.045em;max-width:20ch}.spread{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:3rem}.feature{background:#d7dfbf;padding:2.5rem;position:relative;min-height:30rem;display:flex;flex-direction:column;justify-content:flex-end}.feature h2{font-size:clamp(2rem,4vw,4rem);max-width:12ch;line-height:1.05}.folio{font-size:5rem;line-height:1;align-self:flex-end;color:#3a4b29}.feature p{max-width:35ch}.feature a{margin-block-start:1.5rem}.notes-heading{display:flex;justify-content:space-between;align-items:center;border-block-end:2px solid #20261e;padding-block-end:1rem}.notes article{display:grid;grid-template-columns:2rem minmax(0,1fr);gap:1rem;padding-block:1.5rem;border-block-end:1px solid #7a826f}.notes h3{font-size:1.25rem;line-height:1.3}.notes p{line-height:1.6}main>p[role=status]{padding-block:2rem}@media(max-width:650px){.workspace{grid-template-columns:1fr}.rail{padding:.75rem 1rem;gap:.5rem}.rail nav{flex-direction:row}.rail>p{display:none}.canvas{padding:1rem}.topline{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.library{padding:1.25rem}.masthead{align-items:flex-start;gap:1rem}.masthead nav{gap:.5rem;flex-direction:column}.spread{grid-template-columns:1fr;gap:2rem}.feature{padding:1.5rem;min-height:28rem}.index-title{padding-block:2rem}}[dir=rtl] .index-title h1{letter-spacing:normal;line-height:1.4}`,
        },
      },
    },
  };
}
