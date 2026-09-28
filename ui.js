/**
 * UI helpers for Dartmouth Swimming Alumni Archive
 * Everything members type is rendered with textContent via h(), never
 * innerHTML, so stories and comments can't inject markup.
 */

// ================================
// DOM building
// ================================

/**
 * h('p', { class: 'note', onclick: fn }, 'text', childNode, [more, children])
 */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2), value);
        } else if (key === 'class') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
        } else if (value === true) {
            el.setAttribute(key, '');
        } else {
            el.setAttribute(key, value);
        }
    }
    append(el, children);
    return el;
}

function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : String(child));
    }
}

export function replace(el, ...children) {
    el.replaceChildren();
    append(el, children);
}

export function $(selector, root = document) {
    return root.querySelector(selector);
}

export function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
}

// ================================
// Formatting
// ================================

/**
 * "Mike Kennedy '95"
 */
export function nameWithClass(name, classYear) {
    if (!classYear) return name || 'A member';
    return `${name} ’${String(classYear).slice(-2)}`;
}

export function initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/**
 * Split a story into paragraphs on blank lines
 */
export function paragraphs(text) {
    return (text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

export function excerpt(text, length = 240) {
    const flat = (text || '').replace(/\s+/g, ' ').trim();
    if (flat.length <= length) return flat;
    return flat.slice(0, flat.lastIndexOf(' ', length)) + '…';
}

export function toDate(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    return new Date(timestamp);
}

export function timeAgo(timestamp) {
    const date = toDate(timestamp);
    if (!date) return 'just now';
    const seconds = (Date.now() - date.getTime()) / 1000;
    if (seconds < 60) return 'just now';
    const units = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
    let value = seconds / 60;
    for (const [size, unit] of units) {
        if (value < size) {
            const n = Math.floor(value);
            return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
        }
        value /= size;
    }
    return date.toLocaleDateString();
}

export function plural(n, word, pluralWord = word + 's') {
    return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

/**
 * A small, stable tilt for pasted-in photos, derived from the id
 */
export function tiltFor(id) {
    let hash = 0;
    for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return ((Math.abs(hash) % 25) - 12) / 10;
}

// ================================
// Feedback
// ================================

export function toast(message, { tone = 'info', timeout = 4500 } = {}) {
    const container = $('#toasts');
    const slip = h('div', { class: `toast toast-${tone}`, role: tone === 'error' ? 'alert' : 'status' }, message);
    container.append(slip);
    setTimeout(() => {
        slip.classList.add('leaving');
        setTimeout(() => slip.remove(), 300);
    }, timeout);
}

export function showError(el, message) {
    el.textContent = message;
    el.hidden = !message;
}

/**
 * Disable a button while an async action runs, with a working label
 */
export async function busy(button, workingLabel, action) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = workingLabel;
    try {
        return await action();
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

/**
 * Plain-language version of a Firestore/Storage error
 */
export function describeError(error) {
    const code = error?.code || '';
    if (code.endsWith('permission-denied') || code.endsWith('unauthorized')) {
        return 'The archive refused that change. You may not have permission, or your membership may still be pending.';
    }
    if (code.endsWith('unavailable') || code === 'storage/retry-limit-exceeded') {
        return 'Couldn\'t reach the archive. Check your connection and try again.';
    }
    if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
        return 'Photo storage isn\'t set up yet, so files can\'t be uploaded. Ask an admin to enable Firebase Storage.';
    }
    if (code === 'storage/quota-exceeded') {
        return 'The archive\'s file storage is full. Ask an admin to check the Firebase plan.';
    }
    return error?.message || 'Something went wrong. Try again.';
}
