/**
 * Storage Module for Dartmouth Swimming Alumni Archive
 * Handles file uploads to Firebase Storage
 */

const StorageModule = {
    /**
     * Upload a single file to Firebase Storage
     * @param {File} file - The file to upload
     * @param {string} memoryId - The memory ID to associate with this file
     * @param {function} onProgress - Progress callback (0-100)
     * @returns {Promise<string>} - Download URL of uploaded file
     */
    async uploadFile(file, memoryId, onProgress = null) {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Must be signed in to upload files');
        }

        // Validate file
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Create unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `memories/${memoryId}/${timestamp}_${sanitizedName}`;

        const storageRef = firebase.storage().ref(path);
        const uploadTask = storageRef.put(file, {
            customMetadata: {
                uploadedBy: user.uid,
                originalName: file.name,
                memoryId: memoryId
            }
        });

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) {
                        onProgress(progress);
                    }
                },
                (error) => {
                    // Error
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    // Complete
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve({
                            url: downloadURL,
                            path: path,
                            name: file.name,
                            size: file.size,
                            type: file.type
                        });
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    },

    /**
     * Upload multiple files
     * @param {FileList|Array} files - Files to upload
     * @param {string} memoryId - Memory ID
     * @param {function} onProgress - Progress callback with overall progress
     * @returns {Promise<Array>} - Array of upload results
     */
    async uploadMultipleFiles(files, memoryId, onProgress = null) {
        const fileArray = Array.from(files);
        const results = [];
        let completedBytes = 0;
        const totalBytes = fileArray.reduce((sum, f) => sum + f.size, 0);

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];

            try {
                const result = await this.uploadFile(file, memoryId, (fileProgress) => {
                    if (onProgress) {
                        const fileBytes = (fileProgress / 100) * file.size;
                        const overallProgress = ((completedBytes + fileBytes) / totalBytes) * 100;
                        onProgress(overallProgress, i + 1, fileArray.length);
                    }
                });

                completedBytes += file.size;
                results.push(result);
            } catch (error) {
                console.error(`Error uploading file ${file.name}:`, error);
                results.push({
                    error: error.message,
                    name: file.name
                });
            }
        }

        return results;
    },

    /**
     * Validate file before upload
     */
    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf'
        ];

        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File "${file.name}" exceeds 10MB limit`
            };
        }

        if (!allowedTypes.includes(file.type)) {
            return {
                valid: false,
                error: `File type "${file.type}" is not allowed. Please upload images or PDFs.`
            };
        }

        return { valid: true };
    },

    /**
     * Delete a file from storage
     */
    async deleteFile(filePath) {
        try {
            const storageRef = firebase.storage().ref(filePath);
            await storageRef.delete();
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    },

    /**
     * Get a thumbnail URL for an image
     * Note: For production, you'd want to use Cloud Functions to generate actual thumbnails
     * This uses Firebase Storage's built-in image resizing if using the resize images extension
     */
    getThumbnailUrl(originalUrl, width = 400) {
        // If using Firebase Extensions - Resize Images, thumbnails are auto-generated
        // This is a simple approach that works with the extension
        if (originalUrl.includes('firebasestorage.googleapis.com')) {
            // Attempt to get resized version (if extension is installed)
            return originalUrl.replace(/(\.[^.]+)$/, `_${width}x${width}$1`);
        }
        return originalUrl;
    },

    /**
     * Compress image before upload (client-side)
     * @param {File} file - Image file
     * @param {number} maxWidth - Maximum width
     * @param {number} quality - JPEG quality (0-1)
     * @returns {Promise<Blob>}
     */
    async compressImage(file, maxWidth = 1920, quality = 0.8) {
        return new Promise((resolve, reject) => {
            // Only compress images
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                let { width, height } = img;

                // Calculate new dimensions
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Create new file with same name
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            resolve(file);
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };

            img.onerror = () => {
                reject(new Error('Failed to load image for compression'));
            };

            img.src = URL.createObjectURL(file);
        });
    },

    /**
     * Upload with automatic compression
     */
    async uploadWithCompression(file, memoryId, onProgress = null) {
        let fileToUpload = file;

        // Compress images larger than 2MB
        if (file.type.startsWith('image/') && file.size > 2 * 1024 * 1024) {
            try {
                fileToUpload = await this.compressImage(file);
                console.log(`Compressed ${file.name}: ${file.size} -> ${fileToUpload.size}`);
            } catch (error) {
                console.warn('Compression failed, uploading original:', error);
            }
        }

        return this.uploadFile(fileToUpload, memoryId, onProgress);
    }
};

// Export module
window.StorageModule = StorageModule;
