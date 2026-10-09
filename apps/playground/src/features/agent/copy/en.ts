/**
 * English copy (SPEC §4, the English column). Authored, not translated: the Arabic in
 * `ar.ts` is written on its own terms, and the two agree on keys and params, not words.
 *
 * Conventions (SPEC §4.0): sentence case; “curly quotes” around page words only where the
 * SPEC quotes them; `…` only at the end of an in-progress line; never "section(s)":
 * a count that changes the words is a `{ one, other }` entry, and a counted noun is the
 * `{sections}` or `{blocks}` slot, filled by `nouns.ts` from `n`. Where the Arabic needs
 * its own sentence at 0, the English says the same thing through `zero` ("Every section
 * was written"), so the two locales never disagree about what happened. Apostrophes stay
 * straight because the SPEC prints them straight and calls every string "the exact copy".
 *
 * `(added)` marks a key a SPEC component needs whose copy no SPEC table prints.
 */
import type { EnEntry, Key } from './keys';

export const en = {
  /* §4.2 AgentHeader and the phone sheet */
  'header.name': 'Abu Ghadab',
  'header.conversations': 'Conversations',
  'header.new': 'New conversation',
  'header.new.busy': 'Available when the current work ends',
  'sheet.close': 'Close',
  'sheet.showPage': 'Show the page',
  'sheet.backToChat': 'Back to the chat',
  // (added) §4.1: the resize separator needs an accessible name.
  'panel.resize': 'Resize the panel',

  /* §4.3 visible status: at most 24 characters before interpolation */
  'run.understanding': 'Reading your request…',
  'build.started': 'Laying out the page…',
  'build.planned': 'Writing {sections}',
  'build.writing': 'Writing {sections}',
  'build.blocked': 'Waiting on {title}…',
  'build.landed': '{title} is on the page',
  stopping: 'Stopping…',
  'edit.started': 'Reading the page…',
  'edit.writing': 'Writing the change…',
  'edit.checking': 'Checking the change…',
  'edit.repairing': 'Fixing the change…',
  'edit.applying': 'Applying the change…',
  'plan.drafting': 'Drafting the plan…',
  'proposal.drafting': 'Preparing the proposal…',

  /* §4.3 announcements: the live region only */
  'announce.build.started': 'Started building the page',
  'announce.build.planned': 'Page laid out: {sections}',
  'announce.build.blocked': "{title} is taking longer. What's written after it waits its turn.",
  'announce.build.progress': {
    by: 'done',
    one: '{done} of {total} sections is on the page',
    other: '{done} of {total} sections are on the page',
  },
  'announce.build.done': 'Page built: {sections}',
  'announce.build.partial': {
    zero: 'Build ended, no section failed',
    one: 'Page built, {n} failed',
    other: 'Page built, {n} failed',
  },
  'announce.stopping': 'Stopping',
  // Zero is said only while the skeleton's empty layout is on the page: a stop before it
  // landed is `stopped.none` (agent-status routes it), so zero names what IS there.
  'announce.stopped': {
    zero: 'Stopped before any section landed. The empty layout is still on the page.',
    one: 'Stopped. {sections} is on the page.',
    other: 'Stopped. {sections} are on the page.',
  },
  'announce.stopped.none': "Stopped. The page wasn't changed.",
  // The same routing: zero with the layout on the page, `stopped.budget.none` without it.
  'announce.stopped.budget': {
    zero: 'The build hit its time limit before any section landed. The empty layout is still on the page.',
    one: 'The build hit its time limit. {sections} is on the page.',
    other: 'The build hit its time limit. {sections} are on the page.',
  },
  // (added) the budget ran out before the skeleton reached the page: nothing changed.
  'announce.stopped.budget.none': "The build hit its time limit. The page wasn't changed.",
  'announce.stopped.maxTasks': 'The build hit the section limit',
  'announce.edit.started': 'Started editing {target}',
  // (added) a page-wide edit has no target to name; `edit.title.runningPage` is its title.
  'announce.edit.startedPage': 'Started editing the page',
  'announce.edit.done': '{target} updated',
  // (added) the page-wide twin of `edit.done`.
  'announce.edit.donePage': 'The page was updated',
  'announce.edit.noChange': 'Nothing changed in {target}',
  // (added) the page-wide twin of `edit.noChange`.
  'announce.edit.noChangePage': 'Nothing changed on the page',
  'announce.plan.drafting': 'Started drafting the plan',
  'announce.plan.ready': 'The plan is ready to review',
  'announce.proposal.drafting': 'Started preparing the proposal',
  'announce.proposal.ready': 'The proposal is ready to review',
  'announce.answer.ready': 'The answer is ready',
  'announce.failed': "Couldn't finish. The page wasn't changed.",
  'announce.failed.kept': "Couldn't finish. What landed before the error stays on the page.",
  // (added) failed after the skeleton landed and before any section did.
  'announce.failed.skeleton': "Couldn't finish. The empty layout is still on the page.",
  'announce.undone': 'Undid {title}',
  'announce.redone': 'Redid {title}',
  'announce.queue.queued': 'Request queued',
  'announce.queue.already': 'This request is already queued',
  'announce.queue.started': 'Started the next request',
  'announce.plan.moved': 'Moved {title} to position {i} of {n}',
  'announce.plan.removed': 'Removed {title} from the plan',
  'announce.copied': 'Copied',

  /* §4.4 AgentThread and JumpToLatest */
  'thread.label': 'Conversation',
  'jump.idle': 'Latest',
  'jump.building': 'Building',
  'jump.editing': 'Editing',
  // (added) §3.12 labels the pill "Building" or "Editing"; a live run doing anything else
  // (routing, drafting a plan or proposal, answering) still has news below.
  'jump.working': 'Working',
  'jump.aria': 'Jump to the latest',

  /* §4.5 UserMessage */
  'message.notRun': 'Not run',

  /* §4.8 BuildRecord */
  'build.title.skeleton': 'Laying out the page',
  'build.live.skeleton': 'Choosing sections and style…',
  'build.title.running': 'Building the page',
  'build.title.done': 'Page built',
  'build.title.partial': {
    zero: 'Build ended, no section failed',
    one: 'Page built, {n} failed',
    other: 'Page built, {n} failed',
  },
  'build.title.stopped': 'Build stopped',
  'build.title.budget': 'Build hit its time limit',
  'build.title.maxTasks': 'Build hit the section limit',
  'build.title.interrupted': 'Interrupted by a reload',
  'build.title.failed': "Couldn't build the page",
  'build.title.undone': 'Build undone',
  'build.caption.done': '{sections} on the page',
  'build.caption.stopped': {
    zero: 'Every section was written',
    one: "{sections} wasn't written",
    other: "{sections} weren't written",
  },
  'build.caption.interrupted': '{done} of {total} sections landed before the reload',
  'build.caption.notResumable': "Can't continue: the section list wasn't saved",
  'build.caption.revived': "Undo isn't available after a reload. Page history has restore points.",
  'build.pageHistory': 'Page history',
  'build.remaining.minutes': 'About {n} min left',
  'build.remaining.underMinute': 'Under a minute left',
  'build.showSections': 'Show sections ({n})',
  'build.hideSections': 'Hide sections',
  // (added) §4.8: "SpineList is an <ol aria-label>".
  'spine.label': 'Page sections',
  // (added) §4.8: a plan row's state word, so `row.${RowState}` covers every state.
  'row.planned': 'Planned',
  'row.waiting': 'Waiting',
  'row.writing': 'Writing',
  'row.retrying': 'Second try',
  'row.drafted': 'Written, waiting its turn',
  'row.landed': 'On the page',
  'row.undone': 'Undone',
  'row.failed': 'Failed',
  'row.notWritten': 'Not written',
  'row.aria': 'Section {i} of {n}: {title}, {state}',
  'row.undo': 'Undo',
  'row.undo.aria': 'Undo {title}',
  'row.redo': 'Redo',
  'row.redo.aria': 'Redo {title}',
  'row.retry': 'Retry',
  // WCAG 2.5.3 Label in Name: the name opens with the visible "Retry", so "click Retry"
  // reaches it. SPEC §4.8 printed "Write {title} again" (amendment pending lead sign-off).
  'row.retry.aria': 'Retry {title}',
  'revert.changedSince': "Can't undo: this section changed after it was built",
  'revert.regionMissing': "Can't undo: the section is no longer on the page",
  'reason.timeout': 'Took too long',
  'reason.invalid': 'Came back invalid twice',
  'reason.outOfScope': 'Wrote outside its section and was refused',
  'reason.pageChanged': 'The page changed while it was being written',
  'reason.unreachable': "The model didn't respond",
  'reason.busy': 'The service is busy',
  'reason.declined': 'The model declined to write it',
  'reason.unknown': "This section couldn't be written",
  'facts.toggle': 'Sample details to replace ({n})',
  'facts.intro': 'These were written as examples. Replace them before publishing.',
  'facts.item': '“{sample}” in {section}',
  'footer.undoBuild': 'Undo build',
  'footer.redoBuild': 'Redo build',
  'footer.finishRest': 'Finish the rest ({n})',
  'footer.removeEmpty': {
    one: 'Remove the empty section',
    other: 'Remove empty sections ({n})',
  },
  'footer.retryFailed': {
    one: 'Write the failed section again',
    other: 'Write the failed sections again ({n})',
  },
  'direction.aria': 'Style: {mood}. Colours: {colors}. Fonts: {fonts}.',
  // (added) §7.6 E7: until the engine sends structured direction, only the prose exists.
  'direction.aria.mood': 'Style: {mood}.',

  /* §4.9 EditRecord and ChangeLines */
  'edit.title.running': 'Editing {target}',
  'edit.title.runningPage': 'Editing the page',
  'edit.title.done': '{target} updated',
  'edit.title.noChange': 'No change to {target}',
  'edit.noChange': 'It already matched what you asked for.',
  'edit.title.stopped': 'Change stopped',
  'edit.pageUnchanged': "The page wasn't changed.",
  // (added) view-types `EditRecordView.unlisted`: it landed, and no line reads it.
  'edit.unlisted': 'The page changed; this change has no summary.',
  'edit.showAll': 'Show all changes ({n})',
  'edit.showOnPage': 'Show on page',
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.undone': 'This change was undone',
  // (added) §4.9 draws "before → after" with a mirrored arrow icon; a screen reader
  // hears these sentences instead of "right arrow".
  'change.changed.aria': '{label}: from “{before}” to “{after}”',
  'change.added.aria': '{label}: added “{value}”',
  'change.removed.aria': '{label}: removed “{value}”',
  // (added) the two changes with no words before and after an arrow (view-types
  // `ChangeLineView` restyled / moved).
  'change.restyled': 'New look',
  'change.restyled.aria': '{label}: new look for “{value}”',
  'change.moved': 'Moved',
  'change.moved.aria': '{label}: moved “{value}”',
  // (added) `impactLines`' words: an element's role, a document field, the values it takes.
  'change.label.section': 'Section',
  'change.label.heading': 'Heading',
  'change.label.link': 'Link',
  'change.label.button': 'Button',
  'change.label.listItem': 'List item',
  'change.label.quote': 'Quote',
  'change.label.caption': 'Caption',
  'change.label.label': 'Label',
  'change.label.tableHeading': 'Table heading',
  'change.label.tableCell': 'Table cell',
  'change.label.text': 'Text',
  'change.label.pageDirection': 'Page direction',
  'change.label.pageSurface': 'Page surface',
  // colour-target-fix additions
  'change.label.pageColours': 'Page colours',
  'change.label.pageStyling': 'Page styling',
  // end colour-target-fix additions
  'change.value.ltr': 'Left to right',
  'change.value.rtl': 'Right to left',
  'change.value.on': 'On',
  'change.value.off': 'Off',

  /* §4.10 AnswerRecord and EndNote */
  'answer.title': 'Answer',
  'answer.more': 'Show more',
  'answer.less': 'Show less',
  'end.proposalDiscarded': 'Proposal discarded',
  'end.planDiscarded': 'Plan discarded',
  'end.planSuperseded': 'Replaced by a newer plan',
  'end.stoppedBeforeChange': 'Stopped before anything changed',
  'end.interrupted': 'Interrupted by a page reload',

  /* §4.11 PagePlanCard */
  'plan.title': 'Page plan',
  'plan.tag.edited': 'Edited',
  'plan.tag.approval': 'Waiting for your approval',
  'plan.mood.aria': 'Style',
  'plan.swatch.aria': '{role}: {hex}. Change',
  'role.background': 'Background',
  'role.surface': 'Surface',
  'role.text': 'Text',
  'role.accent': 'Accent',
  'role.onAccent': 'Text on accent',
  'swatch.hex': 'Hex code',
  'swatch.ok': 'Readable on the background (contrast {r})',
  'swatch.low': 'Not readable on the background (contrast {r})',
  'plan.contrast': "Text and background don't contrast enough",
  'plan.fonts.aria': 'Fonts: {pair}',
  'plan.sections': 'Sections ({n})',
  'plan.row.drag': 'Drag to reorder, or Alt with the arrow keys',
  'plan.row.rename': 'Rename',
  'plan.row.moveUp': 'Move up',
  'plan.row.moveDown': 'Move down',
  'plan.row.remove': 'Remove section',
  'plan.add': 'Add section',
  'plan.add.placeholder': 'Section name, e.g. Pricing',
  'plan.min': 'A page needs at least two sections',
  'plan.max': 'A plan holds up to 12 sections',
  // (added) view-types `PlanProblem.duplicateTitle`: two sections would share an anchor.
  'plan.duplicate': 'Each section needs its own name',
  'plan.build': 'Build this page',
  'plan.discard': 'Discard plan',
  'plan.note': 'Builds exactly the sections shown.',
  'plan.note.mayDiffer': 'The built page may differ from this outline.',
  // (added) §7.6 E0c: the honesty line when the layout was written before approval.
  'plan.layoutPrepared': 'The page layout was prepared; nothing else changed.',

  /* §4.12 StepPlanCard */
  'steps.title': 'Change plan',
  'steps.run': 'Run this plan',
  'steps.discard': 'Discard',
  'steps.note': 'Nothing changes until the plan runs.',

  /* §4.13 ProposalCard */
  'proposal.title': 'Proposed change: {target}',
  'proposal.unchanged': "The page hasn't changed yet.",
  'proposal.partial': 'Only {kept} of {total} changes can be applied',
  'proposal.apply': 'Apply',
  'proposal.discard': 'Discard',
  'proposal.preview': 'Preview',
  'proposal.preview.end': 'End preview',
  'proposal.viewCode': 'View as code',
  'proposal.applied': 'Applied: {target}',

  /* §4.14 ErrorRecord */
  'error.unreachable.title': "Couldn't reach the model",
  'error.unreachable.cause': "The AI server didn't answer.",
  'error.timeout.title': 'Timed out',
  'error.timeout.cause': 'The request ran past its time limit.',
  'error.busy.title': 'The service is busy',
  'error.busy.cause':
    'The service hit its temporary limit. Try again in a minute, or pick another model.',
  'error.declined.title': 'The model declined',
  'error.declined.cause': "The model didn't accept this request. Different wording may work.",
  'error.invalid.title': "The result wasn't valid",
  'error.invalid.cause': "Twice, the model returned something the page can't use.",
  'error.tooLarge.title': 'The page is too large',
  'error.tooLarge.cause': 'This page is too large to send whole. Select a section and try again.',
  'error.offline.title': "You're offline",
  'error.offline.cause': "The request wasn't sent.",
  'error.unknown.title': 'Something unexpected went wrong',
  'error.page.unchanged': "The page wasn't changed.",
  'error.page.kept': 'What landed before the error stays on the page ({n}).',
  'error.page.skeleton': 'The empty layout is still on the page.',
  // (added) view-types `ErrorPageState.unknown`: what landed first was never kept.
  'error.page.unknown': 'Anything written before the error may still be on the page.',
  'error.removeSkeleton': 'Remove the empty layout',
  'error.retry': 'Try again',
  'error.copy': 'Copy error details',

  /* §4.15 RecordMenu, InlineConfirm, RestoreDialog */
  'menu.label': 'More options',
  'menu.restore': 'Restore page to before this request',
  'menu.reuse': 'Reuse request',
  'menu.copySummary': 'Copy summary',
  // (added) §4.10: an answer's [⋯] menu offers Copy.
  'menu.copyAnswer': 'Copy answer',
  'menu.technical': 'Technical details',
  'confirm.undoBuild':
    'The page goes back to how it was before this request. The conversation stays.',
  'confirm.undo': 'Undo',
  'confirm.cancel': 'Cancel',
  'restore.title': 'Restore the page to before this request?',
  'restore.body': 'This request and every page change after it are undone. The conversation stays.',
  'restore.confirm': 'Restore page',
  'restore.conflict': "Can't restore automatically: the same parts changed after this request.",

  /* §4.16 EmptyState and SuggestionList (the character's voice) */
  'empty.greeting':
    "Tell me about your project in one sentence. I'll build the whole page, section by section.",
  'empty.hasContent': {
    zero: 'This page has content. Tell me what to change.',
    one: 'This page has {sections}. Tell me what to change.',
    other: 'This page has {sections}. Tell me what to change.',
  },
  'empty.selection': '{title} is selected. What should change?',
  'suggestions.label': 'Suggestions',
  'suggestions.description': 'Puts the text in the box without sending it',
  // The starters: the person's own request, each a trade AND what its page must do. Not
  // translations of the Arabic set. 1 to 4 are SPEC §4.16's rows.
  'starter.1': 'A dental clinic in Amman with WhatsApp booking',
  'starter.2': 'A specialty café: menu, hours and map',
  'starter.3': 'A small perfume shop on Instagram',
  'starter.4': 'A yoga studio: classes and prices',
  'starter.5': 'A portfolio for a freelance product designer',
  'starter.6': 'A family restaurant: menu, delivery and reservations',
  'starter.7': 'A physiotherapy clinic: treatments, team and booking',
  'starter.8': 'A wedding photographer: packages and recent work',
  // (added) what the other suggestion sources put in the composer, as the person's request.
  // "a new" before `{child}`, so no article has to agree with a name it cannot see.
  'suggest.rewrite': 'Rewrite the text of “{title}” to be clearer',
  'suggest.addInside': 'Add a new {child} inside “{title}”',
  'suggest.tighten': 'Tighten the wording in “{title}”',
  'suggest.relayout': 'Try another layout for “{title}”',
  'suggest.rework': 'Rework “{title}” as {prompt}',
  // `{titles}` is the locale's list of quoted section titles.
  'suggest.salvage': 'Finish the changes to {titles}',
  // (added) what a page just built or edited offers next: a section it does not have yet,
  // then the two changes that apply to any page. Full sentences, the person's own request.
  'suggest.page.pricing': 'Add a pricing section with clear packages',
  'suggest.page.faq': 'Add a section that answers common questions',
  'suggest.page.contact': 'Add a contact section with a clear way to book',
  'suggest.page.testimonials': 'Add a section with what customers say',
  'suggest.page.warmer': 'Make the page colours warmer',
  'suggest.page.otherLanguage': 'Add an Arabic version of the page',

  /* §4.17 the composer family */
  'input.aria': 'Your request',
  'placeholder.auto': 'Describe a page or a change…',
  'placeholder.ask': 'Describe a change to review first…',
  'placeholder.plan': 'Describe the page to plan…',
  'placeholder.running': 'Type the next request…',
  'placeholder.afterPlan': 'Ask for a change to the plan…',
  'scope.page': 'Whole page',
  'chip.remove': 'Remove {label} from the request',
  'chip.stale': 'No longer on the page',
  'mention.button': 'Mention a section',
  // (added) §4.17: the mention listbox needs an accessible name.
  'mention.label': 'Sections and blocks',
  'mention.position': '{i} of {n}',
  'mention.empty': 'No section by that name',
  'mode.aria': 'Mode: {mode}',
  'mode.auto': 'Auto',
  'mode.auto.desc': 'Applies changes right away. Every change can be undone.',
  'mode.ask': 'Ask first',
  'mode.ask.desc': 'Shows the change and waits for your approval',
  'mode.plan': 'Plan',
  'mode.plan.desc': 'Writes an editable plan. Never changes the page.',
  'mode.running': 'Applies to your next request',
  'model.aria': 'Model: {name}',
  'model.fast': 'Fast',
  'model.fast.trait': 'Quickest replies',
  'model.careful': 'Careful',
  'model.careful.trait': 'Slower, more careful',
  'model.free': 'Free',
  'model.free.trait': 'May slow down under load',
  'effort.aria': 'Thinking: {level}',
  'effort.low': 'Low',
  'effort.low.trait': 'Quickest, thinks little',
  'effort.medium': 'Medium',
  'effort.medium.trait': 'Balances speed and care',
  'effort.high': 'High',
  'effort.high.trait': 'Thinks deeper, slower',
  'effort.xhigh': 'Extra high',
  'effort.xhigh.trait': 'For complex pages, slower and costlier',
  'effort.max': 'Max',
  'effort.max.trait': 'Deepest thinking, slowest and costliest',
  'freeCode.button': 'Free code',
  'freeCode.on': 'On: the agent may write JavaScript and full PixiJS scenes',
  'freeCode.off': 'Turn on so the agent can write JavaScript and custom PixiJS scenes',
  send: 'Send',
  queue: 'Queue as next',
  queued: 'Queued',
  stop: 'Stop',
  'stop.tooltip': 'Stop the work ({shortcut})',
  'keys.hint': 'Enter to send, Shift+Enter for a new line',
  'queue.label': 'Up next',
  'queue.caption': 'Starts when the current work ends',
  'queue.stale': "The target changed; it'll be rechecked first",
  'queue.missing': 'The target is gone. Pick another one.',
  'queue.paused': 'Paused after Stop',
  'queue.continue': 'Continue',
  'queue.remove': 'Remove the next request',

  /* §4.18 HistoryPopover */
  'history.title': 'Conversations',
  'history.search': 'Search conversations',
  'history.current': 'Current',
  'history.delete': 'Delete conversation',
  'history.confirm': "Delete this conversation? This can't be undone. The page stays as it is.",
  'history.confirm.yes': 'Delete',
  'history.confirm.no': 'Cancel',
  'history.empty': 'No earlier conversations',
  // (added) §4.18: the search field above 8 conversations can match nothing. A
  // conversation has no name (its row shows the first request), so no "by that name".
  'history.noMatch': 'No matching conversations',
  'history.back': 'Back',

  /* §4.19 SheetMiniBar */
  // (added) §3.16 draws the mini row as "1 of 8 on the page".
  'mini.progress': '{done} of {total} on the page',

  /* §4.20 canvas stage, status pill, empty canvas */
  'pill.building': 'Abu Ghadab is building the page, {done} of {total}',
  'pill.editing': 'Abu Ghadab is editing {target}',
  // (added) the pill for a live run that is neither a build nor an edit.
  'pill.working': 'Abu Ghadab is working on your request',
  'pill.done': 'Page built: {sections}',
  'edge.landed': '{title} is on the page',
  'canvas.empty': 'Your page appears here. Describe it in the chat.',
  'stage.overture': 'Laying out the page…',
  'stage.waiting': '{title}: waiting',
  'stage.writing': 'Writing {title}',
  'stage.drafted': '{title} waits its turn',
  'stage.landed': 'On the page',
  'stage.failed': "Couldn't write {title}",
  'stage.changed': 'Updated',

  /* §7.4 describeImpact: the parts of one line, joined by `tList` ("a, b, and c") */
  // (added) SPEC §7.4 moves v1's strings here. `impact.dir` and `impact.surface` start
  // lower case because they follow a count ("2 blocks added and the page direction
  // changed"); `tList` capitalises whichever part opens the line.
  'impact.none': 'Changes nothing on the page',
  'impact.added': { zero: 'No blocks added', one: '{blocks} added', other: '{blocks} added' },
  'impact.changed': {
    zero: 'No blocks changed',
    one: '{blocks} changed',
    other: '{blocks} changed',
  },
  'impact.removed': {
    zero: 'No blocks removed',
    one: '{blocks} removed',
    other: '{blocks} removed',
  },
  'impact.dir': 'the page direction changed',
  'impact.surface': 'the page surface changed',

  // controller additions (WP-16)
  // (added) ✨ Improve rewrote the draft; the person's own wording stays one Restore away.
  'announce.enhance.ready': 'Request improved',
  // (added) The request was too unclear to run: questions are docked above the composer.
  'announce.clarify.ready': 'A few questions before starting',
  // (added) A build that could not land where the words asked says so after its record.
  'end.siteAsOnePage': 'Built as one page. The chat builds one page at a time.',
  'end.newPageAppended': "Built below this page. A new page can't be opened from here.",
  'end.appendedNotReplaced': "Added below what's already here. Nothing was replaced.",

  // WP-14-composer additions
  // (added) ✨ Improve (EnhanceButton): the owner's own words for the tooltip, which is
  // also the button's name. While it works the name says so; no ellipsis, because the
  // spinner and the shimmer on the draft already say "in progress".
  'enhance.button': 'Improve my request',
  'enhance.working': 'Improving your request',
  // (added) Why Improve cannot run now: the tooltip's second line on an aria-disabled button.
  'enhance.empty': "Available once you've written a request",
  'enhance.busy': 'Available when the current work ends',
  // (added) EnhanceNote. The label repeats `announce.enhance.ready`, so the eye and the
  // ear hear one sentence; `{prompt}` is the model's one-line restatement of the request.
  'enhance.done': 'Request improved',
  'enhance.understood': 'Understood: {prompt}',
  'enhance.changes.show': 'Show changes ({n})',
  'enhance.changes.hide': 'Hide changes',
  'enhance.restore': 'Restore my text',
  // (added) A failed Improve changes nothing, and says so: the cause when it is known.
  'enhance.failed': "Couldn't improve the request",
  'enhance.failed.busy': 'The service is busy. Your text is unchanged.',
  'enhance.failed.unreachable': "The model didn't respond. Your text is unchanged.",
  'enhance.failed.timeout': 'It took too long. Your text is unchanged.',
  'enhance.failed.other': 'Your text is unchanged.',
  // (added) ClarifyPanel. The title repeats `announce.clarify.ready`; the progress is the
  // question being asked, drawn "1 of 3" and spoken "Question 1 of 3".
  'clarify.title': 'A few questions before starting',
  'clarify.progress': '{i} of {n}',
  'clarify.progress.aria': 'Question {i} of {n}',
  'clarify.other': 'Other',
  'clarify.other.placeholder': 'Your own answer',
  'clarify.other.send': 'Send this answer',
  'clarify.edit': 'Change this answer',
  'clarify.sendAsWritten': 'Send as written',
  'clarify.cancel': 'Cancel',
  'clarify.rewriting': 'Rewriting your request',

  // WP-11-frame additions
  // (added) §4.4 JumpToLatest. WCAG 2.5.3 Label in Name: while a run is live the pill reads
  // "Building" or "Editing", a word `jump.aria` does not contain, so the name opens with
  // the pill's own word and then says what the button does. Idle, the pill reads "Latest"
  // and `jump.aria` ("Jump to the latest") already contains it.
  'jump.aria.live': '{label}: jump to the latest',

  // WP-12-records additions
  // (added) §4.5: the person's sent request is an article, and it has no head to name it.
  'message.aria': 'Your request',
  // (added) §4.8 DirectionLine: `direction.aria` names the mood, the colours and the fonts;
  // a direction without fonts, or without swatches, says only what it has.
  'direction.aria.colors': 'Style: {mood}. Colours: {colors}.',
  'direction.aria.fonts': 'Style: {mood}. Fonts: {fonts}.',
  // (added) §4.9: the page-wide twins of `edit.title.done` and `edit.title.noChange`, for an
  // edit with no target to name (`edit.title.runningPage` is the running one).
  'edit.title.donePage': 'Page updated',
  'edit.title.noChangePage': 'No change to the page',
  // (added) §4.13: the page-wide twin of `proposal.applied`.
  'proposal.appliedPage': 'Proposal applied',

  // WP-13-decisions additions
  // (added) §4.11 PlanSectionRow: eight rows each carry a handle and a [⋯], so each control
  // names its section; `plan.row.drag` stays the handle's tooltip hint and description.
  'plan.row.reorder': 'Reorder {title}',
  'plan.row.menu': 'Options for {title}',
  // (added) §4.11 inline rename: the field's label says which section it renames.
  'plan.row.rename.aria': 'Rename {title}',
  // (added) §4.11 DirectionEditor: the swatch row's group name, and FontPairMenu's list.
  'plan.colors': 'Colours',
  'plan.fonts.menu': 'Fonts',
  // (added) §3.14 at 420: the "Aa" specimen before the font pair (decorative, aria-hidden).
  'plan.fonts.specimen': 'Aa',
  // (added) §4.11 SwatchPopover: the native colour input's label.
  'swatch.pick': 'Pick a colour',
  // (added) §4.11 `swatch.ok` / `swatch.low` judge text on the background. A card's text sits
  // on the surface, and a button's text on the accent, so those pairs say so.
  'swatch.ok.surface': 'Readable on the surface (contrast {r})',
  'swatch.low.surface': 'Not readable on the surface (contrast {r})',
  'swatch.ok.accent': 'Readable on the accent (contrast {r})',
  'swatch.low.accent': 'Not readable on the accent (contrast {r})',
  // (added) §4.11: the popover refuses a colour that breaks its pair, and says so.
  'swatch.refused': "This colour isn't applied while the text can't be read.",
  'swatch.hex.invalid': 'A hex code looks like {hex}',
  // (added) §4.13: the page-wide twin of `proposal.title`, for a proposal with no target.
  'proposal.title.page': 'Proposed change to the page',
  // (added) §4.12 StepPlanCard: the steps list's name, and each step's target, spoken.
  'steps.label': 'Steps',
  'steps.target': 'In {target}',
  // (added) §4.15 RestoreDialog: the conflict leaves nothing to confirm, only to close; and
  // the Restore button's description while the restore runs.
  'restore.close': 'Close',
  'restore.working': 'Restoring the page',

  // WP-15-history-phone additions
  // (added) §4.18 HistoryRow: the row button's name. A row shows its title, "Current" and
  // its time as three pieces; read together without a pause they run into one another
  // ("Amman Current Now"), so the name says title and time as a phrase. "Current" is
  // `aria-current` on the button, which a screen reader says in its own words.
  'history.row': '{title}, {when}',
  // (added) §4.18: while a run is live, other conversations wait, as New conversation does
  // (§4.2 `header.new.busy`): leaving mid-run would strand the work being watched.
  'history.busy': 'Other conversations open when the current work ends',
  // (added) §4.18: the current conversation cannot be deleted while its run is live.
  'history.delete.busy': 'Available when the current work ends',
} as const satisfies Readonly<Record<Key, EnEntry>>;
