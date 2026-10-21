import type { ExportPage } from '@craftkit/builder/code-runtime';

/** Authored capability example, not a design template or provider-quality result. */
export function baseUiFixture(direction: 'ltr' | 'rtl'): ExportPage {
  const arabic = direction === 'rtl';
  const labels = arabic
    ? {
        title: 'مساحة العمل',
        overview: 'نظرة عامة',
        activity: 'النشاط',
        detail: 'تفاصيل المشروع',
        close: 'إغلاق',
        open: 'فتح التفاصيل',
        actions: 'الإجراءات',
        select: 'اختيار',
        help: 'مساعدة',
        question: 'كيف يعمل؟',
        answer: 'تصميم خاص بهذه الصفحة',
        home: 'الرئيسية',
      }
    : {
        title: 'Workspace',
        overview: 'Overview',
        activity: 'Activity',
        detail: 'Project details',
        close: 'Close',
        open: 'Open details',
        actions: 'Actions',
        select: 'Select',
        help: 'Help',
        question: 'How does it work?',
        answer: 'Designed for this page',
        home: 'Home',
      };
  return {
    projectId: 'base-ui-qa',
    pageId: 'home',
    address: '/',
    entry: 'pages/home/index.tsx',
    title: labels.title,
    description: labels.answer,
    language: arabic ? 'ar' : 'en',
    direction,
    inputs: {},
    project: {
      formatVersion: 1,
      runtimeProfile: 'craftkit-react-v1',
      revision: `base-ui-${direction}`,
      dependencyLock: {
        catalogVersion: 'craftkit-managed-reference-v1',
        packages: { react: '19.2.9', 'react-dom': '19.2.9', '@base-ui/react': '1.9.0' },
      },
      files: {
        'pages/home/index.tsx': {
          language: 'tsx',
          source: `import {useState} from 'react';
import {Tabs} from '@base-ui/react/tabs';
import {Dialog} from '@base-ui/react/dialog';
import {Menu} from '@base-ui/react/menu';
import {Popover} from '@base-ui/react/popover';
import {Accordion} from '@base-ui/react/accordion';
import {NavigationMenu} from '@base-ui/react/navigation-menu';
import {DirectionProvider} from '@base-ui/react/direction-provider';
import './design.css';
const copy=${JSON.stringify(labels)};
export default function Page(){const [selected,setSelected]=useState(false);return <DirectionProvider direction='${direction}'><main dir='${direction}'>
<NavigationMenu.Root><NavigationMenu.List><NavigationMenu.Item><NavigationMenu.Link href='#content'>{copy.home}</NavigationMenu.Link></NavigationMenu.Item></NavigationMenu.List></NavigationMenu.Root>
<h1>{copy.title}</h1><Tabs.Root defaultValue='overview'><Tabs.List aria-label={copy.title}><Tabs.Tab value='overview'>{copy.overview}</Tabs.Tab><Tabs.Tab value='activity'>{copy.activity}</Tabs.Tab></Tabs.List><Tabs.Panel value='overview'><p id='content'>{copy.answer}</p></Tabs.Panel><Tabs.Panel value='activity'><p>2026 · 10 · 21</p></Tabs.Panel></Tabs.Root>
<div className='controls'><Dialog.Root><Dialog.Trigger>{copy.open}</Dialog.Trigger><Dialog.Portal><Dialog.Backdrop className='backdrop'/><Dialog.Popup className='popup'><Dialog.Title>{copy.detail}</Dialog.Title><Dialog.Description>{copy.answer}</Dialog.Description><Dialog.Close>{copy.close}</Dialog.Close></Dialog.Popup></Dialog.Portal></Dialog.Root>
<Menu.Root><Menu.Trigger>{copy.actions}</Menu.Trigger><Menu.Portal><Menu.Positioner><Menu.Popup className='floating'><Menu.Item onClick={()=>setSelected(true)}>{copy.select}</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>
<Popover.Root><Popover.Trigger>{copy.help}</Popover.Trigger><Popover.Portal><Popover.Positioner><Popover.Popup className='floating'><Popover.Title>{copy.help}</Popover.Title><Popover.Description>{copy.answer}</Popover.Description></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root></div>
<p role='status'>{selected ? copy.select : ''}</p><Accordion.Root><Accordion.Item value='how'><Accordion.Header><Accordion.Trigger>{copy.question}</Accordion.Trigger></Accordion.Header><Accordion.Panel>{copy.answer}</Accordion.Panel></Accordion.Item></Accordion.Root>
</main></DirectionProvider>}`,
        },
        'pages/home/design.css': {
          language: 'css',
          source: `*{box-sizing:border-box}body{margin:0;position:relative;color:#172033;background:#f5f3ed;font-family:system-ui,sans-serif}main{isolation:isolate;max-width:68rem;margin:auto;padding:2rem}h1{font-size:clamp(2rem,8vw,5rem);letter-spacing:-.04em;margin-block:3rem 2rem}button,[role=menuitem]{font:inherit;cursor:pointer;padding:.8rem 1rem;border:1px solid #6b756f;background:#fff;color:#172033;border-radius:0}button:focus-visible,a:focus-visible,[role=menuitem]:focus-visible{outline:3px solid #064e3b;outline-offset:3px}[role=tab][aria-selected=true]{background:#064e3b;color:#fff}.controls{display:flex;flex-wrap:wrap;gap:1rem;margin-block:2rem}.backdrop{position:fixed;inset:0;background:#0008;z-index:10}.popup{position:fixed;inset-block-start:50%;inset-inline-start:50%;transform:translate(-50%,-50%);width:min(90vw,32rem);padding:2rem;background:#fff;border:2px solid #064e3b;z-index:11}[dir=rtl] .popup{transform:translate(50%,-50%)}.floating{padding:1rem;background:#fff;border:2px solid #064e3b;max-width:90vw;z-index:20}a{color:#064e3b}ul{padding:0;list-style:none}[role=tabpanel]{min-height:5rem}h2,h3{font-size:1.25rem}`,
        },
      },
    },
  };
}
