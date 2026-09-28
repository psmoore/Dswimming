/**
 * Storage Module for Dartmouth Swimming Alumni Archive
 * Uploads photos and documents to memories/{memoryId}/ in Firebase Storage.
 * storage.rules limits uploads to members, 10MB, images and PDFs.
 */

import { auth, storage } from './firebase-config.js';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

/**
 * Returns an error sentence, or null if the file can be uploaded
 */
export function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return `"${file.name}" isn't a JPG, PNG, GIF, WebP or PDF.`;
    }
    if (file.size > MAX_FILE_SIZE && file.type === 'application/pdf') {
        return `"${file.name}" is over 10MB. Try a smaller scan.`;
    }
    return null;
}

/**
 * Upload files one after another.
 * onProgress(fraction 0–1) reports progress across all files.
 */
export async function uploadFiles(files, memoryId, onProgress) {
    const prepared = [];
    for (const file of files) {
        prepared.push(await compressImage(file));
    }

    const totalBytes = prepared.reduce((sum, f) => sum + f.size, 0) || 1;
    let doneBytes = 0;
    const results = [];

    for (const file of prepared) {
        const result = await uploadFile(file, memoryId, (bytes) => {
            if (onProgress) onProgress((doneBytes + bytes) / totalBytes);
        });
        doneBytes += file.size;
        results.push(result);
    }
    return results;
}

function uploadFile(file, memoryId, onBytes) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `memories/${memoryId}/${Date.now()}_${safeName}`;
    const task = uploadBytesResumable(ref(storage, path), file, {
        contentType: file.type,
        customMetadata: { uploadedBy: auth.currentUser.uid }
    });

    return new Promise((resolve, reject) => {
        task.on('state_changed',
            snapshot => onBytes(snapshot.bytesTransferred),
            reject,
            async () => {
                try {
                    const url = await getDownloadURL(task.snapshot.ref);
                    resolve({
                        url,
                        path,
                        name: file.name,
                        type: file.type,
                        width: file.width || null,
                        height: file.height || null
                    });
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

export async function deleteFiles(files) {
    await Promise.all((files || []).map(f =>
        deleteObject(ref(storage, f.path)).catch(error => {
            // Already gone is fine; anything else is worth knowing about
            if (error.code !== 'storage/object-not-found') console.error('Error deleting file:', error);
        })
    ));
}

/**
 * Shrink large photos to 2000px on the long edge before upload, and
 * record dimensions so the page can reserve space before images load.
 */
async function compressImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const maxEdge = 2000;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    if (scale === 1 && file.size <= 2 * 1024 * 1024) {
        return Object.assign(file, { width, height });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return Object.assign(new File([blob], name, { type: 'image/jpeg' }), { width, height });
}
