/**
 * Dartmouth Swimming Alumni Archive
 * Interactive JavaScript Functionality
 */

// ================================
// State Management
// ================================
const state = {
    currentView: 'timeline',
    currentDecade: '1990s',
    inviteEmails: [],
    uploadedFiles: [],
    memoryType: 'photo'
};

// Decade data (would come from API in production)
const decadeData = {
    '1950s': { tagline: 'The Founding Years', memories: 12, contributors: 8, championships: 1 },
    '1960s': { tagline: 'Building Tradition', memories: 28, contributors: 15, championships: 2 },
    '1970s': { tagline: 'The Rise', memories: 45, contributors: 22, championships: 3 },
    '1980s': { tagline: 'Dynasty Beginnings', memories: 67, contributors: 31, championships: 5 },
    '1990s': { tagline: 'The Golden Era', memories: 89, contributors: 34, championships: 7 },
    '2000s': { tagline: 'New Millennium', memories: 124, contributors: 52, championships: 6 },
    '2010s': { tagline: 'Modern Excellence', memories: 156, contributors: 78, championships: 8 },
    '2020s': { tagline: 'The New Wave', memories: 43, contributors: 35, championships: 2 }
};

// ================================
// DOM Elements
// ================================
const elements = {
    // Navigation
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),

    // Timeline
    decadeMarkers: document.querySelectorAll('.decade-marker'),
    decadeDisplay: document.querySelector('.decade-display'),
    decadeTagline: document.querySelector('.decade-tagline'),
    decadeStats: document.querySelectorAll('.decade-stats .stat-number'),

    // Memory cards
    memoryCards: document.querySelectorAll('.memory-card'),

    // Contribute form
    contributeForm: document.getElementById('contribute-form'),
    typeBtns: document.querySelectorAll('.type-btn'),
    uploadZone: document.getElementById('upload-zone'),
    fileInput: document.getElementById('file-input'),
    uploadedPreview: document.getElementById('uploaded-preview'),
    storyInput: document.getElementById('story-input'),
    charCount: document.querySelector('.char-count'),

    // Invite form
    inviteForm: document.getElementById('invite-form'),
    inviteEmail: document.getElementById('invite-email'),
    addEmailBtn: document.getElementById('add-email-btn'),
    emailList: document.getElementById('email-list'),
    sendInvitesBtn: document.getElementById('send-invites-btn'),

    // Modals
    notificationModal: document.getElementById('notification-modal'),
    memoryModal: document.getElementById('memory-modal'),
    notificationBtn: document.querySelector('.notification-btn'),
    modalCloses: document.querySelectorAll('.modal-close'),
    modalCancels: document.querySelectorAll('.modal-cancel'),

    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ================================
// Navigation Functions
// ================================
function switchView(viewName) {
    state.currentView = viewName;

    // Update nav buttons
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update views
    elements.views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}-view`);
    });
}

// ================================
// Decade Timeline Functions
// ================================
function switchDecade(decade) {
    state.currentDecade = decade;
    const data = decadeData[decade];

    // Update decade markers
    elements.decadeMarkers.forEach(marker => {
        marker.classList.toggle('active', marker.dataset.decade === decade);
    });

    // Animate decade display update
    const decadeDisplay = elements.decadeDisplay;
    const decadeTagline = elements.decadeTagline;

    decadeDisplay.style.opacity = '0';
    decadeTagline.style.opacity = '0';

    setTimeout(() => {
        decadeDisplay.textContent = decade;
        decadeTagline.textContent = `"${data.tagline}"`;

        // Update stats
        elements.decadeStats[0].textContent = data.memories;
        elements.decadeStats[1].textContent = data.contributors;
        elements.decadeStats[2].textContent = data.championships;

        decadeDisplay.style.opacity = '1';
        decadeTagline.style.opacity = '1';
    }, 200);

    // Re-animate memory cards
    animateMemoryCards();
}

function animateMemoryCards() {
    elements.memoryCards.forEach((card, index) => {
        card.style.animation = 'none';
        card.offsetHeight; // Trigger reflow
        card.style.animation = `cardFadeIn 0.5s ease forwards ${index * 0.1}s`;
    });
}

// ================================
// Contribute Form Functions
// ================================
function switchMemoryType(type) {
    state.memoryType = type;

    elements.typeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Show/hide upload section based on type
    const uploadSection = document.getElementById('upload-section');
    if (type === 'story') {
        uploadSection.style.display = 'none';
    } else {
        uploadSection.style.display = 'block';
    }
}

function handleFileUpload(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast('Invalid File', 'Please upload image files only.', '⚠️');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File Too Large', 'Please upload files under 10MB.', '⚠️');
            return;
        }

        state.uploadedFiles.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Upload preview">
                <button type="button" class="preview-remove" data-index="${state.uploadedFiles.length - 1}">&times;</button>
            `;
            elements.uploadedPreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

function removeUploadedFile(index) {
    state.uploadedFiles.splice(index, 1);
    renderUploadedPreviews();
}

function renderUploadedPreviews() {
    elements.uploadedPreview.innerHTML = '';
    state.uploadedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Upload preview">
                <button type="button" class="preview-remove" data-index="${index}">&times;</button>
            `;
            elements.uploadedPreview.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

function updateCharCount() {
    const count = elements.storyInput.value.length;
    elements.charCount.textContent = `${count} / 2000`;

    if (count > 2000) {
        elements.charCount.style.color = '#dc3545';
    } else if (count > 1800) {
        elements.charCount.style.color = '#ffc107';
    } else {
        elements.charCount.style.color = '';
    }
}

function handleContributeSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('title-input').value;
    const decade = document.getElementById('decade-select').value;
    const story = elements.storyInput.value;

    if (!title || !decade || !story) {
        showToast('Missing Information', 'Please fill in all required fields.', '⚠️');
        return;
    }

    // Simulate submission
    showToast('Memory Added!', 'Your contribution has been added to the archive.', '🎉');

    // Reset form
    e.target.reset();
    state.uploadedFiles = [];
    elements.uploadedPreview.innerHTML = '';
    updateCharCount();

    // Notify subscribers (simulation)
    setTimeout(() => {
        showToast('Notifications Sent', '247 alumni have been notified of your new memory.', '📧');
    }, 2000);
}

// ================================
// Invite Functions
// ================================
function addInviteEmail() {
    const email = elements.inviteEmail.value.trim();

    if (!email) return;

    if (!isValidEmail(email)) {
        showToast('Invalid Email', 'Please enter a valid email address.', '⚠️');
        return;
    }

    if (state.inviteEmails.includes(email)) {
        showToast('Duplicate Email', 'This email has already been added.', '⚠️');
        return;
    }

    state.inviteEmails.push(email);
    renderEmailList();
    elements.inviteEmail.value = '';
    updateSendButton();
}

function removeInviteEmail(email) {
    state.inviteEmails = state.inviteEmails.filter(e => e !== email);
    renderEmailList();
    updateSendButton();
}

function renderEmailList() {
    elements.emailList.innerHTML = state.inviteEmails.map(email => `
        <div class="email-item">
            <span>${email}</span>
            <button type="button" class="remove-email" data-email="${email}">&times;</button>
        </div>
    `).join('');
}

function updateSendButton() {
    elements.sendInvitesBtn.disabled = state.inviteEmails.length === 0;
}

function handleInviteSubmit(e) {
    e.preventDefault();

    if (state.inviteEmails.length === 0) return;

    const message = document.getElementById('invite-message').value;

    // Simulate sending invites
    showToast('Invitations Sent!', `${state.inviteEmails.length} invitation(s) have been sent.`, '📧');

    // Reset
    state.inviteEmails = [];
    renderEmailList();
    document.getElementById('invite-message').value = '';
    updateSendButton();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ================================
// Modal Functions
// ================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (typeof modal === 'string') {
        modal = document.getElementById(modal);
    }
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// ================================
// Toast Notifications
// ================================
function showToast(title, message, icon = '✓') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    elements.toastContainer.appendChild(toast);

    // Auto remove after animation
    setTimeout(() => {
        toast.remove();
    }, 5000);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}

// ================================
// Event Listeners
// ================================
function initEventListeners() {
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Decade markers
    elements.decadeMarkers.forEach(marker => {
        marker.addEventListener('click', () => switchDecade(marker.dataset.decade));
    });

    // Memory type buttons
    elements.typeBtns.forEach(btn => {
        btn.addEventListener('click', () => switchMemoryType(btn.dataset.type));
    });

    // File upload
    if (elements.uploadZone) {
        elements.uploadZone.addEventListener('click', () => elements.fileInput.click());

        elements.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.add('dragover');
        });

        elements.uploadZone.addEventListener('dragleave', () => {
            elements.uploadZone.classList.remove('dragover');
        });

        elements.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.remove('dragover');
            handleFileUpload(e.dataTransfer.files);
        });

        elements.fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files);
        });
    }

    // Preview remove buttons
    if (elements.uploadedPreview) {
        elements.uploadedPreview.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-remove')) {
                removeUploadedFile(parseInt(e.target.dataset.index));
            }
        });
    }

    // Character count
    if (elements.storyInput) {
        elements.storyInput.addEventListener('input', updateCharCount);
    }

    // Contribute form
    if (elements.contributeForm) {
        elements.contributeForm.addEventListener('submit', handleContributeSubmit);
    }

    // Invite form
    if (elements.addEmailBtn) {
        elements.addEmailBtn.addEventListener('click', addInviteEmail);
    }

    if (elements.inviteEmail) {
        elements.inviteEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addInviteEmail();
            }
        });
    }

    if (elements.emailList) {
        elements.emailList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-email')) {
                removeInviteEmail(e.target.dataset.email);
            }
        });
    }

    if (elements.inviteForm) {
        elements.inviteForm.addEventListener('submit', handleInviteSubmit);
    }

    // Modal triggers
    if (elements.notificationBtn) {
        elements.notificationBtn.addEventListener('click', () => openModal('notification-modal'));
    }

    // Memory card clicks
    elements.memoryCards.forEach(card => {
        card.addEventListener('click', () => openModal('memory-modal'));
    });

    // Modal close buttons
    elements.modalCloses.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.modal-overlay'));
        });
    });

    elements.modalCancels.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.modal-overlay'));
        });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Reaction buttons
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('active');

            // Update count (simulation)
            const text = btn.textContent;
            const emoji = text.match(/[^\d\s]+/)[0];
            const count = parseInt(text.match(/\d+/)?.[0] || 0);

            if (btn.classList.contains('active')) {
                btn.textContent = `${emoji} ${count + 1}`;
            } else {
                btn.textContent = `${emoji} ${count - 1}`;
            }
        });
    });

    // Load more button
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            showToast('Loading Memories', 'Fetching more stories from the archive...', '📚');
        });
    }

    // Save notification preferences
    const modalSave = document.querySelector('.modal-save');
    if (modalSave) {
        modalSave.addEventListener('click', () => {
            showToast('Preferences Saved', 'Your notification settings have been updated.', '✓');
            closeModal('notification-modal');
        });
    }
}

// ================================
// Simulate New Content Notifications
// ================================
function simulateNewContent() {
    // Simulate a new memory being added after 30 seconds
    setTimeout(() => {
        showToast(
            'New Memory Added!',
            'Tom Martinez \'08 added a photo from 2007.',
            '📸'
        );
    }, 30000);
}

// ================================
// Initialize
// ================================
function init() {
    initEventListeners();
    updateCharCount();
    animateMemoryCards();

    // Show welcome toast
    setTimeout(() => {
        showToast(
            'Welcome Back!',
            'There are 3 new memories since your last visit.',
            '👋'
        );
    }, 1500);

    // Start simulation
    simulateNewContent();
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
