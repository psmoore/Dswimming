/**
 * Dartmouth Swimming Alumni Archive
 * Page logic: routing, rendering and forms. Every piece of content on the
 * page comes from a live Firestore listener in database.js; this file
 * re-renders whenever one of them fires.
 */

import * as Auth from './auth.js';
import * as Data from './database.js';
import { uploadFiles, deleteFiles, validateFile } from './storage.js';
import {
    h, replace, $, $$, nameWithClass, paragraphs, excerpt, timeAgo, plural,
    tiltFor, toast, showError, busy, describeError, toDate
} from './ui.js';

// ================================
// State
// ================================
const state = {
    user: null,
    profile: null,
    authReady: false,

    site: null,
    siteLoaded: false,
    decades: [],
    decadesLoaded: false,

    memories: [],
    memoriesLoaded: false,
    members: [],
    pending: [],
    myInvites: [],

    route: { name: 'archive', param: null },
    selectedDecade: null,

    // Add / edit form
    editingId: null,
    newFiles: [],
    keptFiles: [],

    // Open memory dialog
    dialog: null
};

const memberListeners = [];
const adminListeners = [];

const isMember = () => state.profile?.status === 'member';
const isAdmin = () => isMember() && state.profile?.role === 'admin';

function me() {
    return {
        displayName: state.profile?.displayName || state.user?.displayName || 'A member',
        classYear: state.profile?.classYear || null
    };
}

// ================================
// Data subscriptions
// ================================
function subscribePublic() {
    Data.watchSite(site => {
        state.site = site;
        state.siteLoaded = true;
        renderSiteText();
        renderArchive();
        renderSettings();
        finishLoading();
    }, () => {
        state.siteLoaded = true;
        finishLoading();
    });

    Data.watchDecades(decades => {
        state.decades = decades;
        state.decadesLoaded = true;
        renderArchive();
        renderDecadeSelect();
        renderSettings();
    });
}

function subscribeMember() {
    if (memberListeners.length) return;
    memberListeners.push(
        Data.watchMemories(memories => {
            state.memories = memories;
            state.memoriesLoaded = true;
            renderArchive();
            renderMemoryDialog();
            renderSettings();
            if (state.route.name === 'edit') loadEditForm();
        }),
        Data.watchMembers(members => {
            state.members = members;
            renderRoster();
        }),
        Data.watchMyInvites(invites => {
            state.myInvites = invites;
            renderMyInvites();
        })
    );
}

function subscribeAdmin() {
    if (adminListeners.length) return;
    adminListeners.push(
        Data.watchPendingMembers(pending => {
            state.pending = pending;
            renderPending();
        })
    );
}

function unsubscribe(list) {
    while (list.length) list.pop()();
}

// ================================
// Routing (#/, #/decade/1990s, #/memory/id, #/add, #/edit/id, #/invite, #/settings)
// ================================
function parseRoute() {
    const [, name = '', param = null] = location.hash.replace(/^#/, '').split('/');
    return { name: name || 'archive', param: param ? decodeURIComponent(param) : null };
}

function go(hash) {
    if (location.hash === hash) handleRoute();
    else location.hash = hash;
}

function handleRoute() {
    // Nothing is shown until we know who's signed in; onAuthChange routes then
    if (!state.authReady) return;

    const route = parseRoute();
    const memberRoutes = ['memory', 'add', 'edit', 'invite', 'settings'];

    if (memberRoutes.includes(route.name) && !isMember()) {
        history.replaceState(null, '', '#/');
        route.name = 'archive';
        route.param = null;
    }
    if (route.name === 'settings' && !isAdmin()) {
        history.replaceState(null, '', '#/');
        route.name = 'archive';
    }

    const previous = state.route;
    const entering = !state.routed || route.name !== previous.name || route.param !== previous.param;
    const leavingForm = ['add', 'edit'].includes(previous.name) && !['add', 'edit'].includes(route.name);
    state.route = route;
    state.routed = true;

    if (route.name === 'decade' && route.param) {
        state.selectedDecade = route.param;
        state.pickedByHand = true;
    }

    const viewName = { decade: 'archive', memory: 'archive', edit: 'add' }[route.name] || route.name;
    let found = false;
    for (const view of $$('.view')) {
        view.hidden = view.dataset.view !== viewName;
        if (!view.hidden) found = true;
    }
    if (!found) $('#view-archive').hidden = false;

    for (const link of $$('.rail-nav a')) {
        if (link.dataset.route === viewName) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }

    if (entering) {
        if (route.name === 'add' || route.name === 'edit' || leavingForm) resetMemoryForm();
        if (route.name === 'edit') loadEditForm();
        if (!['memory', 'decade'].includes(route.name)) window.scrollTo({ top: 0 });
    }

    // On narrow screens the board sits above the page, so bring the page into view
    const scrollToPage = entering && route.name === 'decade' && matchMedia('(max-width: 900px)').matches;

    if (route.name === 'memory') openMemoryDialog(route.param);
    else closeMemoryDialog();

    renderArchive();
    if (scrollToPage) $('#decade-page').scrollIntoView({ block: 'start' });
}

// ================================
// Site text & chrome
// ================================
function renderSiteText() {
    const site = state.site || {};
    for (const el of $$('[data-site]')) {
        el.textContent = site[el.dataset.site] || '';
    }
    $('.footer').hidden = !site.footer;
    document.title = site.title ? `${site.title} alumni archive` : 'Alumni archive';
}

function renderChrome() {
    const signedIn = !!state.user;
    $('.rail-nav').hidden = !isMember();
    $('[data-admin-only]').hidden = !isAdmin();
    $('#sign-in-button').hidden = signedIn || !state.authReady;
    $('#account-menu').hidden = !signedIn;
    if (signedIn) {
        $('#account-button').textContent = nameWithClass(me().displayName, me().classYear);
    }
}

function finishLoading() {
    if (!state.authReady || !state.siteLoaded || !document.body.classList.contains('is-loading')) return;
    document.body.classList.remove('is-loading');
    // The board's gilding plays once; later live updates re-render without it
    setTimeout(() => document.body.classList.add('board-shown'), 1400);
}

// ================================
// The honor board
// ================================
function decadeById(id) {
    return state.decades.find(d => d.id === id);
}

function decadeForYear(year) {
    return state.decades.find(d => year >= d.startYear && year < d.startYear + 10);
}

function memoriesIn(decadeId) {
    return state.memories.filter(m => m.decade === decadeId);
}

function pickDefaultDecade() {
    // A decade chosen on the board (or the one holding the open memory) wins
    const { name, param } = state.route;
    if (name === 'decade' && decadeById(param)) return param;
    if (name === 'memory') {
        const memory = state.memories.find(m => m.id === param);
        if (memory && decadeById(memory.decade)) return memory.decade;
    }
    if (state.selectedDecade && state.pickedByHand && decadeById(state.selectedDecade)) return state.selectedDecade;

    // Otherwise the most recent decade that has something in it
    const withMemories = [...state.decades].reverse().find(d => memoriesIn(d.id).length);
    return (withMemories || state.decades[state.decades.length - 1])?.id || null;
}

function renderBoard() {
    const rows = $('#board-rows');

    if (!state.decadesLoaded) {
        replace(rows);
        return;
    }

    if (!state.decades.length) {
        replace(rows, h('li', { class: 'board-empty' },
            'No decades on the board yet.',
            isAdmin() ? [' ', h('a', { href: '#/settings' }, 'Set up the board')] : null
        ));
        return;
    }

    const showCounts = isMember() && state.memoriesLoaded;
    replace(rows, state.decades.map(decade => {
        const count = showCounts ? memoriesIn(decade.id).length : null;
        const parts = [
            h('span', { class: 'board-label' }, numeral(decade.label || decade.id)),
            h('span', { class: 'board-leader', 'aria-hidden': 'true' }),
            showCounts ? h('span', { class: 'board-count' }, count || '–') : null,
            decade.tagline ? h('span', { class: 'board-tagline' }, decade.tagline) : null
        ];

        if (!isMember()) {
            return h('li', {}, h('div', { class: 'board-row' }, parts));
        }
        const current = decade.id === state.selectedDecade;
        return h('li', {},
            h('a', {
                class: 'board-row',
                href: `#/decade/${encodeURIComponent(decade.id)}`,
                'aria-current': current ? 'true' : null,
                'aria-label': `${decade.label || decade.id}${decade.tagline ? ', ' + decade.tagline : ''}, ${plural(count || 0, 'memory', 'memories')}`
            }, parts)
        );
    }));
}

// ================================
// The decade page
// ================================
function renderArchive() {
    if (isMember() && state.decadesLoaded) {
        state.selectedDecade = pickDefaultDecade();
    }
    renderBoard();
    renderDecadePage();
}

function renderDecadePage() {
    const page = $('#decade-page');
    if (!state.authReady) return replace(page);

    if (!state.user) return replace(page, visitorPage());
    if (!isMember()) return replace(page, pendingPage());

    if (!state.decadesLoaded || !state.memoriesLoaded) {
        return replace(page, h('p', { class: 'page-note' }, 'Opening the archive…'));
    }

    const decade = decadeById(state.selectedDecade);
    if (!decade) {
        return replace(page,
            state.site?.welcome ? h('p', { class: 'page-welcome' }, state.site.welcome) : null,
            h('p', { class: 'page-note' }, 'Once decades are added to the board, their pages open here.')
        );
    }

    const memories = memoriesIn(decade.id).sort((a, b) =>
        (a.year || decade.startYear) - (b.year || decade.startYear)
        || (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0)
    );
    const contributors = new Set(memories.map(m => m.authorId)).size;
    const label = decade.label || decade.id;

    replace(page,
        state.site?.welcome ? h('p', { class: 'page-welcome' }, state.site.welcome) : null,
        h('header', { class: 'decade-head' },
            h('h2', { class: 'decade-numeral' }, numeral(label)),
            decade.tagline ? h('p', { class: 'decade-tagline' }, decade.tagline) : null,
            memories.length
                ? h('p', { class: 'decade-counts' },
                    `${plural(memories.length, 'memory', 'memories')} shared by ${plural(contributors, 'member')}`)
                : null
        ),
        memories.length
            ? h('div', { class: 'scrapbook' }, memories.map(memoryCard))
            : h('div', { class: 'empty-decade' },
                h('p', {}, `Nothing from the ${label} yet. If you have a photo, a meet program or a story from these years, it belongs here.`),
                h('a', { class: 'button', href: '#/add', onclick: () => { state.addDecade = decade.id; } }, 'Add a memory')
            )
    );
}

/**
 * "1990s" → 1990 in roman with the trailing "s" in italic, so Fell's
 * old-style figures don't make it read as a capital S
 */
function numeral(label) {
    const match = /^(\d{4})(\D.*)$/.exec(label);
    if (!match) return label;
    return [match[1], h('span', { class: 'numeral-suffix' }, match[2])];
}

function visitorPage() {
    return h('div', { class: 'visitor' },
        state.site?.intro ? h('p', { class: 'page-intro' }, state.site.intro) : null,
        h('div', { class: 'visitor-card' },
            h('h2', {}, 'Members only'),
            h('p', {}, 'The archive is open to Dartmouth swimmers, divers, coaches and managers. Sign in to look through it.'),
            h('button', { type: 'button', class: 'button', onclick: openAuthDialog }, 'Sign in'),
            h('p', { class: 'visitor-help' },
                'New here? Ask a teammate who’s already a member to invite your email address, then sign in with it. You can also create an account and wait for an admin to approve it.')
        )
    );
}

function pendingPage() {
    const email = state.user.email;
    const needsVerify = !state.user.emailVerified;

    if (state.profile?.status === 'declined') {
        return h('div', { class: 'visitor-card' },
            h('h2', {}, 'This account wasn’t approved'),
            h('p', {}, `If that’s a mistake, ask a teammate who’s a member to invite ${email}, then choose Check for my invite.`),
            h('button', { type: 'button', class: 'button', onclick: recheck }, 'Check for my invite')
        );
    }

    return h('div', { class: 'visitor-card' },
        h('h2', {}, 'Waiting for approval'),
        h('p', {}, `You’re signed in as ${email}. You’ll get in as soon as a member adds this address to the invite list, or an admin approves your request.`),
        needsVerify
            ? h('p', {}, `First, confirm your email address using the link we sent to ${email}. Invites only work for confirmed addresses.`)
            : null,
        h('div', { class: 'form-actions start' },
            h('button', { type: 'button', class: 'button', onclick: recheck },
                needsVerify ? 'I’ve confirmed my email' : 'Check for my invite'),
            needsVerify
                ? h('button', { type: 'button', class: 'button-quiet', onclick: async (e) => {
                    await busy(e.currentTarget, 'Sending…', Auth.resendVerification);
                    toast(`Sent a new link to ${email}.`);
                } }, 'Send the link again')
                : null,
            h('button', { type: 'button', class: 'button-quiet', onclick: openProfileDialog }, 'Your details')
        )
    );
}

async function recheck(event) {
    try {
        await busy(event.currentTarget, 'Checking…', Auth.recheckMembership);
        if (!isMember()) toast('No invite for your email yet.');
    } catch (error) {
        toast(describeError(error), { tone: 'error' });
    }
}

function memoryCard(memory) {
    const images = (memory.files || []).filter(f => f.type?.startsWith('image/'));
    const byline = [
        memory.year ? `${memory.year}. ` : '',
        `Shared by ${nameWithClass(memory.authorName, memory.authorClassYear)}`
    ].join('');
    const open = `#/memory/${encodeURIComponent(memory.id)}`;

    if (images.length) {
        const cover = images[0];
        return h('a', { class: `snapshot type-${memory.type}`, href: open, style: { '--tilt': `${tiltFor(memory.id)}deg` } },
            h('span', { class: 'mount' },
                h('img', {
                    src: cover.url,
                    alt: memory.title,
                    loading: 'lazy',
                    width: cover.width,
                    height: cover.height
                }),
                h('span', { class: 'corners', 'aria-hidden': 'true' }),
                memory.year ? h('span', { class: 'stamp' }, memory.year) : null
            ),
            h('span', { class: 'caption' },
                h('span', { class: 'caption-title' }, memory.title),
                h('span', { class: 'caption-meta' },
                    byline,
                    images.length > 1 ? `. ${images.length} photos` : ''
                )
            )
        );
    }

    const pdf = (memory.files || []).find(f => f.type === 'application/pdf');
    return h('a', { class: `entry type-${memory.type}`, href: open },
        h('span', { class: 'entry-title' }, memory.title),
        memory.story ? h('span', { class: 'entry-text' }, excerpt(memory.story)) : null,
        pdf ? h('span', { class: 'entry-file' }, pdf.name) : null,
        h('span', { class: 'caption-meta' }, byline)
    );
}

// ================================
// Memory dialog
// ================================
function openMemoryDialog(id) {
    const dialog = $('#memory-dialog');
    if (state.dialog?.id !== id) {
        closeMemoryDialog({ keepOpen: true });
        state.dialog = { id, comments: [], witnesses: [], confirmDelete: false, unsubs: [] };
        state.dialog.unsubs.push(
            Data.watchComments(id, comments => { state.dialog.comments = comments; renderMemoryDialog(); }),
            Data.watchWitnesses(id, witnesses => { state.dialog.witnesses = witnesses; renderMemoryDialog(); })
        );
    }
    renderMemoryDialog();
    if (!dialog.open) dialog.showModal();
}

function closeMemoryDialog({ keepOpen = false } = {}) {
    if (state.dialog) {
        state.dialog.unsubs.forEach(fn => fn());
        state.dialog = null;
    }
    const dialog = $('#memory-dialog');
    if (!keepOpen && dialog.open) dialog.close();
}

function renderMemoryDialog() {
    if (!state.dialog) return;
    const body = $('#memory-dialog-body');
    const memory = state.memories.find(m => m.id === state.dialog.id);

    if (!memory) {
        if (state.memoriesLoaded) {
            replace(body, h('p', { class: 'page-note', id: 'memory-dialog-title' }, 'This memory has been removed from the archive.'));
        }
        return;
    }

    // Keep a half-typed comment across re-renders
    const draft = $('#comment-text', body)?.value || '';
    const hadFocus = document.activeElement?.id === 'comment-text';

    const decade = decadeById(memory.decade);
    const mine = memory.authorId === state.user?.uid;
    const iWasThere = state.dialog.witnesses.some(w => w.id === state.user?.uid);
    const others = state.dialog.witnesses.filter(w => w.id !== state.user?.uid);
    const images = (memory.files || []).filter(f => f.type?.startsWith('image/'));
    const documents = (memory.files || []).filter(f => !f.type?.startsWith('image/'));

    replace(body,
        images.length
            ? h('div', { class: 'plates' }, images.map(img =>
                h('a', { href: img.url, target: '_blank', rel: 'noopener', class: 'plate' },
                    h('img', { src: img.url, alt: '', width: img.width, height: img.height, loading: 'lazy' })
                )))
            : null,

        h('article', { class: 'memory-text' },
            memory.year ? h('span', { class: 'stamp large' }, memory.year) : null,
            h('h2', { class: 'memory-title', id: 'memory-dialog-title' }, memory.title),
            h('p', { class: 'memory-byline' },
                `Shared by ${nameWithClass(memory.authorName, memory.authorClassYear)}, ${timeAgo(memory.createdAt)}`,
                decade ? `. Filed under the ${decade.label || decade.id}.` : '.'
            ),
            memory.people?.length ? h('p', { class: 'memory-people' }, `With ${memory.people.join(', ')}`) : null,
            paragraphs(memory.story).map(p => h('p', {}, p)),
            documents.map(file => h('p', { class: 'memory-file' },
                h('a', { href: file.url, target: '_blank', rel: 'noopener' }, `Open ${file.name}`)
            )),

            h('div', { class: 'witness' },
                h('button', {
                    type: 'button',
                    class: iWasThere ? 'button' : 'button-quiet',
                    'aria-pressed': iWasThere ? 'true' : 'false',
                    onclick: async (e) => {
                        try {
                            await busy(e.currentTarget, 'Saving…', () => Data.setWitness(memory.id, !iWasThere, me()));
                        } catch (error) {
                            toast(describeError(error), { tone: 'error' });
                        }
                    }
                }, 'I was there'),
                others.length
                    ? h('p', {}, `Also there: ${others.map(w => nameWithClass(w.displayName, w.classYear)).join(', ')}`)
                    : null
            ),

            (mine || isAdmin()) ? h('div', { class: 'owner-actions' },
                h('a', { href: `#/edit/${encodeURIComponent(memory.id)}`, class: 'button-quiet' }, 'Edit'),
                state.dialog.confirmDelete
                    ? [
                        h('span', { class: 'confirm-text' }, 'Delete this memory and its comments?'),
                        h('button', { type: 'button', class: 'button danger', onclick: (e) => removeMemory(e, memory) }, 'Delete for good'),
                        h('button', { type: 'button', class: 'button-quiet', onclick: () => {
                            state.dialog.confirmDelete = false;
                            renderMemoryDialog();
                        } }, 'Keep it')
                    ]
                    : h('button', { type: 'button', class: 'button-quiet', onclick: () => {
                        state.dialog.confirmDelete = true;
                        renderMemoryDialog();
                    } }, 'Delete')
            ) : null
        ),

        h('section', { class: 'comments', 'aria-label': 'Comments' },
            h('h3', {}, state.dialog.comments.length ? plural(state.dialog.comments.length, 'comment') : 'Comments'),
            h('ol', { class: 'comment-list' }, state.dialog.comments.map(comment =>
                h('li', {},
                    h('p', { class: 'comment-author' },
                        nameWithClass(comment.authorName, comment.authorClassYear),
                        h('span', { class: 'comment-time' }, ` ${timeAgo(comment.createdAt)}`)
                    ),
                    h('p', {}, comment.text),
                    (comment.authorId === state.user?.uid || mine || isAdmin())
                        ? h('button', { type: 'button', class: 'link-button', onclick: async () => {
                            try { await Data.deleteComment(memory.id, comment.id); }
                            catch (error) { toast(describeError(error), { tone: 'error' }); }
                        } }, 'Delete comment')
                        : null
                )
            )),
            h('form', { class: 'comment-form', onsubmit: (e) => postComment(e, memory.id) },
                h('label', { for: 'comment-text', class: 'visually-hidden' }, 'Add a comment'),
                h('textarea', { id: 'comment-text', rows: '2', maxlength: '1000', placeholder: 'Add a comment', required: true }),
                h('button', { type: 'submit', class: 'button' }, 'Post comment')
            )
        )
    );

    const textarea = $('#comment-text', body);
    textarea.value = draft;
    if (hadFocus) textarea.focus();
}

async function postComment(event, memoryId) {
    event.preventDefault();
    const text = $('#comment-text').value.trim();
    if (!text) return;
    // Clear first: the live listener re-renders this dialog while the comment saves
    $('#comment-text').value = '';
    try {
        await busy($('button[type=submit]', event.currentTarget), 'Posting…', () => Data.addComment(memoryId, text, me()));
    } catch (error) {
        $('#comment-text').value = text;
        toast(describeError(error), { tone: 'error' });
    }
}

async function removeMemory(event, memory) {
    try {
        await busy(event.currentTarget, 'Deleting…', async () => {
            await Data.deleteMemory(memory.id);
            await deleteFiles(memory.files);
        });
        toast(`Deleted “${memory.title}”.`);
        go(`#/decade/${encodeURIComponent(memory.decade)}`);
    } catch (error) {
        toast(describeError(error), { tone: 'error' });
    }
}

// ================================
// Add / edit a memory
// ================================
const typeCopy = {
    photo: {
        filesLabel: 'Photos',
        hint: 'JPG, PNG, GIF or WebP. Large photos are resized automatically.',
        accept: 'image/jpeg,image/png,image/gif,image/webp',
        storyLabel: 'The story behind it'
    },
    story: {
        filesLabel: null,
        storyLabel: 'Your story'
    },
    document: {
        filesLabel: 'Scans or PDFs',
        hint: 'PDFs up to 10MB, or photos of each page.',
        accept: 'application/pdf,image/jpeg,image/png,image/webp',
        storyLabel: 'What is it?'
    }
};

function currentType() {
    return $('#memory-form input[name=type]:checked').value;
}

function applyType() {
    const copy = typeCopy[currentType()];
    $('#files-field').hidden = !copy.filesLabel;
    if (copy.filesLabel) {
        $('#files-label').textContent = copy.filesLabel;
        $('#files-hint').textContent = copy.hint;
        $('#file-input').accept = copy.accept;
    }
    $('#story-label').textContent = copy.storyLabel;
}

function renderDecadeSelect() {
    const select = $('#memory-decade');
    const chosen = select.value;
    replace(select,
        h('option', { value: '' }, 'Choose a decade'),
        state.decades.map(d => h('option', { value: d.id }, d.label || d.id))
    );
    select.value = chosen;
}

function renderFileList() {
    const list = $('#file-list');
    replace(list,
        state.keptFiles.map((file, i) => h('li', {},
            file.type?.startsWith('image/') ? h('img', { src: file.url, alt: '' }) : null,
            h('span', {}, file.name),
            h('button', { type: 'button', class: 'link-button', onclick: () => {
                state.keptFiles.splice(i, 1);
                renderFileList();
            } }, 'Remove')
        )),
        state.newFiles.map((file, i) => h('li', {},
            file.type.startsWith('image/') ? h('img', { src: file.previewUrl, alt: '' }) : null,
            h('span', {}, file.name),
            h('button', { type: 'button', class: 'link-button', onclick: () => {
                URL.revokeObjectURL(file.previewUrl);
                state.newFiles.splice(i, 1);
                renderFileList();
            } }, 'Remove')
        ))
    );
}

function addFiles(fileList) {
    const errors = [];
    for (const file of fileList) {
        const problem = validateFile(file);
        if (problem) {
            errors.push(problem);
            continue;
        }
        file.previewUrl = URL.createObjectURL(file);
        state.newFiles.push(file);
    }
    showError($('#memory-error'), errors.join(' '));
    renderFileList();
}

function resetMemoryForm() {
    const form = $('#memory-form');
    form.reset();
    state.editingId = null;
    state.newFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    state.newFiles = [];
    state.keptFiles = [];
    $('#add-title').textContent = 'Add a memory';
    $('#add-lede').hidden = false;
    $('#memory-submit').textContent = 'Add to the archive';
    $('#memory-cancel').href = '#/';
    if (state.addDecade) {
        $('#memory-decade').value = state.addDecade;
        state.addDecade = null;
    }
    $('#story-count').textContent = '0';
    showError($('#memory-error'), '');
    applyType();
    renderFileList();
}

function loadEditForm() {
    const memory = state.memories.find(m => m.id === state.route.param);
    if (!memory || state.editingId === memory.id) return;

    resetMemoryForm();
    state.editingId = memory.id;
    state.keptFiles = [...(memory.files || [])];

    $(`#memory-form input[name=type][value=${memory.type}]`).checked = true;
    $('#memory-title').value = memory.title;
    $('#memory-year').value = memory.year || '';
    $('#memory-decade').value = memory.decade;
    $('#memory-story').value = memory.story || '';
    $('#memory-people').value = (memory.people || []).join(', ');
    $('#story-count').textContent = (memory.story || '').length.toLocaleString();
    $('#add-title').textContent = 'Edit memory';
    $('#add-lede').hidden = true;
    $('#memory-submit').textContent = 'Save changes';
    $('#memory-cancel').href = `#/memory/${encodeURIComponent(memory.id)}`;
    applyType();
    renderFileList();
}

async function submitMemory(event) {
    event.preventDefault();
    const errorEl = $('#memory-error');
    const type = currentType();
    const yearText = $('#memory-year').value.trim();
    const year = yearText ? Number(yearText) : null;
    const fields = {
        type,
        title: $('#memory-title').value.trim(),
        story: $('#memory-story').value.trim(),
        decade: $('#memory-decade').value,
        year,
        people: $('#memory-people').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30)
    };
    const fileCount = state.keptFiles.length + state.newFiles.length;

    const problem =
        !fields.title ? 'Give it a title.' :
        (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) ? 'Enter the year as four digits, like 1987.' :
        !fields.decade ? 'Choose a decade.' :
        (type === 'photo' && !fileCount) ? 'Add at least one photo, or choose A story instead.' :
        (type === 'document' && !fileCount) ? 'Add the scan or PDF.' :
        (type === 'story' && !fields.story) ? 'Write the story.' :
        fileCount > 10 ? 'Add up to 10 files per memory.' :
        null;
    if (problem) return showError(errorEl, problem);
    showError(errorEl, '');

    const editing = state.editingId;
    const memoryId = editing || Data.newMemoryId();
    const original = editing ? state.memories.find(m => m.id === editing) : null;
    const button = $('#memory-submit');
    const progress = $('#memory-progress');

    try {
        await busy(button, editing ? 'Saving…' : 'Adding…', async () => {
            let uploaded = [];
            if (type !== 'story' && state.newFiles.length) {
                progress.hidden = false;
                uploaded = await uploadFiles(state.newFiles, memoryId, fraction => {
                    progress.firstElementChild.style.width = `${Math.round(fraction * 100)}%`;
                });
            }
            fields.files = type === 'story' ? [] : [...state.keptFiles, ...uploaded];

            if (editing) {
                await Data.updateMemory(memoryId, fields);
                const keptPaths = new Set(fields.files.map(f => f.path));
                await deleteFiles((original?.files || []).filter(f => !keptPaths.has(f.path)));
            } else {
                await Data.createMemory(memoryId, fields, me());
            }
        });
        toast(editing ? 'Changes saved.' : `Added to the ${decadeById(fields.decade)?.label || fields.decade}.`);
        state.editingId = null;
        go(`#/memory/${encodeURIComponent(memoryId)}`);
    } catch (error) {
        showError(errorEl, describeError(error));
    } finally {
        progress.hidden = true;
        progress.firstElementChild.style.width = '0';
    }
}

function initMemoryForm() {
    const form = $('#memory-form');
    form.addEventListener('submit', submitMemory);
    form.addEventListener('change', (e) => {
        if (e.target.name === 'type') applyType();
    });

    $('#memory-year').addEventListener('input', (e) => {
        const decade = decadeForYear(Number(e.target.value));
        if (decade) $('#memory-decade').value = decade.id;
    });
    $('#memory-story').addEventListener('input', (e) => {
        $('#story-count').textContent = e.target.value.length.toLocaleString();
    });

    const input = $('#file-input');
    input.addEventListener('change', () => {
        addFiles(input.files);
        input.value = '';
    });

    const zone = $('#drop-zone');
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragging');
        addFiles(e.dataTransfer.files);
    });
}

// ================================
// Invites & roster
// ================================
function initInviteForm() {
    $('#invite-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorEl = $('#invite-error');
        const raw = $('#invite-emails').value;
        const message = $('#invite-message').value.trim();
        const emails = [...new Set(raw.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean))];
        const invalid = emails.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

        if (!emails.length) return showError(errorEl, 'Enter at least one email address.');
        if (invalid.length) return showError(errorEl, `Check ${invalid.join(', ')}: that doesn’t look like an email address.`);
        showError(errorEl, '');

        try {
            const added = [];
            const already = [];
            await busy($('button[type=submit]', event.currentTarget), 'Adding…', async () => {
                for (const email of emails) {
                    (await Data.addInvite(email, message, me()) ? added : already).push(email);
                }
            });

            const ready = $('#invite-ready');
            ready.hidden = false;
            $('#invite-ready-text').textContent = [
                added.length ? `Added ${added.join(', ')} to the invite list.` : '',
                already.length ? `${already.join(', ')} ${already.length === 1 ? 'was' : 'were'} already invited.` : '',
                added.length ? 'Now let them know:' : ''
            ].filter(Boolean).join(' ');
            $('#invite-mailto').hidden = !added.length;
            $('#invite-mailto').href = inviteMailto(added, message);
            event.target.reset();
        } catch (error) {
            showError(errorEl, describeError(error));
        }
    });
}

function inviteMailto(emails, message) {
    const title = state.site?.title || 'Dartmouth Swimming';
    const url = `${location.origin}${location.pathname}`;
    const body = [
        message,
        `I've added you to the ${title} alumni archive, where we're collecting photos and stories from our years in the pool.`,
        `Sign in at ${url} using this email address, with Google or an email and password, and you'll be let straight in.`,
        me().displayName
    ].filter(Boolean).join('\n\n');
    const params = new URLSearchParams({ subject: `Join the ${title} alumni archive`, body });
    return `mailto:?bcc=${emails.map(encodeURIComponent).join(',')}&${params.toString().replace(/\+/g, '%20')}`;
}

function renderMyInvites() {
    const list = $('#my-invites');
    if (!state.myInvites.length) {
        return replace(list, h('li', { class: 'muted' }, 'No one yet.'));
    }
    const sorted = [...state.myInvites].sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
    replace(list, sorted.map(invite => h('li', {},
        h('span', {}, invite.email),
        h('span', { class: 'muted' }, ` invited ${timeAgo(invite.createdAt)}`),
        h('button', { type: 'button', class: 'link-button', onclick: async () => {
            try { await Data.deleteInvite(invite.id); }
            catch (error) { toast(describeError(error), { tone: 'error' }); }
        } }, 'Remove')
    )));
}

function renderRoster() {
    const members = [...state.members].sort((a, b) =>
        (a.classYear || 9999) - (b.classYear || 9999) || (a.displayName || '').localeCompare(b.displayName || ''));
    const years = members.map(m => m.classYear).filter(Boolean);

    $('#roster-summary').textContent = members.length
        ? `${plural(members.length, 'member')}${years.length ? `, from the class of ${Math.min(...years)} to ${Math.max(...years)}` : ''}.`
        : '';

    const recent = Date.now() - 14 * 24 * 3600 * 1000;
    replace($('#roster'), members.map(m => h('li', {},
        nameWithClass(m.displayName, m.classYear),
        (toDate(m.joinedAt || m.createdAt)?.getTime() || 0) > recent
            ? h('span', { class: 'muted' }, ` joined ${timeAgo(m.joinedAt || m.createdAt)}`)
            : null
    )));
}

// ================================
// Settings (admins)
// ================================
function renderSettings() {
    if (!isAdmin()) return;
    $('#starter-block').hidden = !(state.siteLoaded && state.decadesLoaded && !state.site && !state.decades.length);

    // Don't overwrite what an admin is in the middle of typing
    const siteForm = $('#site-form');
    if (!siteForm.contains(document.activeElement) && !siteForm.dataset.dirty) {
        const site = state.site || {};
        $('#site-title').value = site.title || '';
        $('#site-intro').value = site.intro || '';
        $('#site-welcome').value = site.welcome || '';
        $('#site-footer').value = site.footer || '';
    }

    const editor = $('#decade-editor');
    if (editor.contains(document.activeElement)) return;
    replace(editor, state.decades.map(decade => {
        const count = memoriesIn(decade.id).length;
        return h('form', { class: 'decade-row', onsubmit: async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const startYear = Number(form.elements.startYear.value);
            if (!Number.isInteger(startYear)) return toast('Enter the first year of the decade, like 1950.', { tone: 'error' });
            try {
                await busy($('button[type=submit]', form), 'Saving…', () => Data.saveDecade(decade.id, {
                    label: form.elements.label.value.trim() || decade.id,
                    tagline: form.elements.tagline.value.trim(),
                    startYear
                }));
                toast(`Saved the ${form.elements.label.value.trim() || decade.id}.`);
            } catch (error) {
                toast(describeError(error), { tone: 'error' });
            }
        } },
            h('label', {}, h('span', { class: 'field-label' }, 'Label'),
                h('input', { name: 'label', value: decade.label || decade.id, maxlength: '20' })),
            h('label', { class: 'grow' }, h('span', { class: 'field-label' }, 'Tagline'),
                h('input', { name: 'tagline', value: decade.tagline || '', maxlength: '80', placeholder: 'Optional' })),
            h('label', {}, h('span', { class: 'field-label' }, 'First year'),
                h('input', { name: 'startYear', type: 'number', value: decade.startYear, step: '1' })),
            h('div', { class: 'decade-row-actions' },
                h('button', { type: 'submit', class: 'button-quiet' }, 'Save'),
                count
                    ? h('span', { class: 'muted' }, plural(count, 'memory', 'memories'))
                    : h('button', { type: 'button', class: 'link-button', onclick: async () => {
                        try { await Data.deleteDecade(decade.id); }
                        catch (error) { toast(describeError(error), { tone: 'error' }); }
                    } }, 'Remove')
            )
        );
    }));
}

async function renderPending() {
    const list = $('#pending-list');
    if (!state.pending.length) {
        return replace(list, h('li', { class: 'muted' }, 'No one is waiting.'));
    }
    const emails = await Promise.all(state.pending.map(p => Data.getMemberEmail(p.id).catch(() => null)));
    replace(list, state.pending.map((person, i) => h('li', { class: 'pending-row' },
        h('span', {}, nameWithClass(person.displayName, person.classYear)),
        h('span', { class: 'muted' }, ` ${emails[i] || ''} asked ${timeAgo(person.joinedAt || person.createdAt)}`),
        h('span', { class: 'pending-actions' },
            h('button', { type: 'button', class: 'button-quiet', onclick: (e) => setStatus(e, person, 'member') }, 'Approve'),
            h('button', { type: 'button', class: 'link-button', onclick: (e) => setStatus(e, person, 'declined') }, 'Decline')
        )
    )));
}

async function setStatus(event, person, status) {
    try {
        await busy(event.currentTarget, 'Saving…', () => Data.setMemberStatus(person.id, status));
        toast(status === 'member' ? `Approved ${person.displayName}.` : `Declined ${person.displayName}.`);
    } catch (error) {
        toast(describeError(error), { tone: 'error' });
    }
}

function initSettings() {
    const siteForm = $('#site-form');
    siteForm.addEventListener('input', () => { siteForm.dataset.dirty = '1'; });
    siteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await busy($('button[type=submit]', siteForm), 'Saving…', () => Data.saveSite({
                title: $('#site-title').value.trim(),
                intro: $('#site-intro').value.trim(),
                welcome: $('#site-welcome').value.trim(),
                footer: $('#site-footer').value.trim()
            }));
            delete siteForm.dataset.dirty;
            toast('Front page saved.');
        } catch (error) {
            toast(describeError(error), { tone: 'error' });
        }
    });

    $('#decade-add-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const start = Number($('#decade-add-year').value);
        if (!Number.isInteger(start) || start < 1900 || start > 2100) {
            return toast('Enter the first year of the decade, like 1910.', { tone: 'error' });
        }
        const id = `${start}s`;
        if (decadeById(id)) return toast(`The ${id} are already on the board.`, { tone: 'error' });
        try {
            await Data.saveDecade(id, { label: id, tagline: '', startYear: start });
            event.target.reset();
        } catch (error) {
            toast(describeError(error), { tone: 'error' });
        }
    });

    $('#starter-button').addEventListener('click', async (event) => {
        try {
            await busy(event.currentTarget, 'Adding…', Data.createStarterContent);
            toast('Starter content added. Edit it below.');
        } catch (error) {
            toast(describeError(error), { tone: 'error' });
        }
    });
}

// ================================
// Sign-in, account menu, profile
// ================================
function openAuthDialog() {
    showError($('#auth-error'), '');
    $('#auth-dialog').showModal();
}

function setAuthTab(name) {
    for (const tab of $$('[data-auth-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.authTab === name));
    for (const panel of $$('[data-auth-panel]')) panel.hidden = panel.dataset.authPanel !== name;
    showError($('#auth-error'), '');
}

async function runAuth(button, label, action) {
    const errorEl = $('#auth-error');
    showError(errorEl, '');
    try {
        await busy(button, label, action);
        $('#auth-dialog').close();
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
            showError(errorEl, Auth.describeAuthError(error));
        }
    }
}

function initAuthUI() {
    $('#sign-in-button').addEventListener('click', openAuthDialog);
    for (const tab of $$('[data-auth-tab]')) {
        tab.addEventListener('click', () => setAuthTab(tab.dataset.authTab));
    }

    $('#google-button').addEventListener('click', (e) =>
        runAuth(e.currentTarget, 'Opening Google…', Auth.signInWithGoogle));

    $('#sign-in-form').addEventListener('submit', (e) => {
        e.preventDefault();
        runAuth($('button[type=submit]', e.currentTarget), 'Signing in…', () =>
            Auth.signInWithEmail($('#sign-in-email').value.trim(), $('#sign-in-password').value));
    });

    $('#register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#register-name').value.trim();
        const yearText = $('#register-year').value.trim();
        if (!name) return showError($('#auth-error'), 'Enter your name.');
        runAuth($('button[type=submit]', e.currentTarget), 'Creating account…', () =>
            Auth.register($('#register-email').value.trim(), $('#register-password').value, name, yearText ? Number(yearText) : null));
    });

    $('#forgot-button').addEventListener('click', async (e) => {
        const email = $('#sign-in-email').value.trim();
        if (!email) return showError($('#auth-error'), 'Enter your email above, then choose Reset password.');
        try {
            await busy(e.currentTarget, 'Sending…', () => Auth.resetPassword(email));
            showError($('#auth-error'), '');
            toast(`If ${email} has an account, a reset link is on its way.`);
        } catch (error) {
            showError($('#auth-error'), Auth.describeAuthError(error));
        }
    });

    // Account menu
    const accountButton = $('#account-button');
    const dropdown = $('#account-dropdown');
    const setMenu = (open) => {
        dropdown.hidden = !open;
        accountButton.setAttribute('aria-expanded', String(open));
    };
    accountButton.addEventListener('click', () => setMenu(dropdown.hidden));
    document.addEventListener('click', (e) => {
        if (!$('#account-menu').contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dropdown.hidden) {
            setMenu(false);
            accountButton.focus();
        }
    });
    $('#sign-out-button').addEventListener('click', async () => {
        setMenu(false);
        await Auth.signOut();
        go('#/');
    });
    $('#edit-profile-button').addEventListener('click', () => {
        setMenu(false);
        openProfileDialog();
    });

    $('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#profile-name').value.trim();
        const yearText = $('#profile-year').value.trim();
        const year = yearText ? Number(yearText) : null;
        if (!name) return showError($('#profile-error'), 'Enter your name.');
        if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
            return showError($('#profile-error'), 'Enter your class year as four digits, like 1995.');
        }
        try {
            await busy($('button[type=submit]', e.currentTarget), 'Saving…', () =>
                Auth.updateMyProfile({ displayName: name, classYear: year }));
            $('#profile-dialog').close();
            toast('Details saved.');
        } catch (error) {
            showError($('#profile-error'), describeError(error));
        }
    });
}

function openProfileDialog() {
    $('#profile-name').value = state.profile?.displayName || '';
    $('#profile-year').value = state.profile?.classYear || '';
    showError($('#profile-error'), '');
    $('#profile-dialog').showModal();
}

function onAuthChange(user, profile) {
    const wasMember = isMember();
    const wasAdmin = isAdmin();
    if (user?.uid !== state.user?.uid) {
        state.selectedDecade = null;
        state.pickedByHand = false;
    }
    state.user = user;
    state.profile = profile;
    state.authReady = true;

    if (isMember() && !wasMember) subscribeMember();
    if (!isMember() && wasMember) {
        unsubscribe(memberListeners);
        state.memories = [];
        state.memoriesLoaded = false;
    }
    if (isAdmin() && !wasAdmin) subscribeAdmin();
    if (!isAdmin() && wasAdmin) unsubscribe(adminListeners);

    // Ask once per session for a class year, so teammates can place you
    if (isMember() && !profile.classYear && !sessionStorage.getItem('askedClassYear')) {
        sessionStorage.setItem('askedClassYear', '1');
        openProfileDialog();
    }

    renderChrome();
    handleRoute();
    renderSettings();
    finishLoading();
}

// ================================
// Dialogs
// ================================
function initDialogs() {
    for (const dialog of $$('dialog')) {
        dialog.addEventListener('click', (e) => {
            // Click on the backdrop, or on a close button
            if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
        });
    }
    $('#memory-dialog').addEventListener('close', () => {
        if (state.route.name === 'memory') {
            const memory = state.memories.find(m => m.id === state.route.param);
            go(memory ? `#/decade/${encodeURIComponent(memory.decade)}` : '#/');
        }
    });
}

// ================================
// Initialize
// ================================
function init() {
    initDialogs();
    initAuthUI();
    initMemoryForm();
    initInviteForm();
    initSettings();
    window.addEventListener('hashchange', handleRoute);

    subscribePublic();
    Auth.watchAuth(onAuthChange);
}

init();
