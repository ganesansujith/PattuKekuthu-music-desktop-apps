// State Management
let state = {
        currentSongIndex: -1,
    user: {
        name: 'User',
        profilePic: null, // base64
        songs: [], // { id, name, artist, duration, isLiked, coverUrl (base64) }
        recent: [],
    },
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    currentBlobUrl: null
};

// IndexedDB Wrapper for storing audio blobs
const DB_NAME = 'MusicAppDB';
const DB_VERSION = 1;
const STORE_SONGS = 'songs';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_SONGS)) {
                db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
            }
        };
    });
}

async function saveSongFile(id, file) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_SONGS], 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.put({ id: id, file: file });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getSongFile(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_SONGS], 'readonly');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.file : null);
        req.onerror = () => reject(req.error);
    });
}

// DOM Elements
const elements = {
    audio: document.getElementById('audio-element'),
    views: document.querySelectorAll('.view'),
    navItems: document.querySelectorAll('.nav-item'),
    
    fileUpload: document.getElementById('file-upload'),
    libraryList: document.getElementById('library-list'),
    homeFeed: document.getElementById('home-feed'),
    homeRecent: document.getElementById('home-recent'),
    searchResults: document.getElementById('search-results'),
    searchInput: document.getElementById('search-input'),
    
    statSongs: document.getElementById('stat-songs'),
    
    miniPlayer: document.getElementById('mini-player'),
    miniTitle: document.getElementById('mini-title'),
    miniArtist: document.getElementById('mini-artist'),
    miniProgressFill: document.getElementById('mini-progress-fill'),
    miniPlayBtn: document.getElementById('mini-play-btn'),
    miniPrevBtn: document.getElementById('mini-prev-btn'),
    miniNextBtn: document.getElementById('mini-next-btn'),
    miniRepeatBtn: document.getElementById('mini-repeat-btn'),
    
    fullPlayer: document.getElementById('full-player'),
    closePlayerBtn: document.getElementById('close-player-btn'),
    playerTitle: document.getElementById('player-title'),
    playerArtist: document.getElementById('player-artist'),
    btnPlay: document.getElementById('btn-play'),
    btnNext: document.getElementById('btn-next'),
    btnPrev: document.getElementById('btn-prev'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnRepeat: document.getElementById('btn-repeat'),
    progressSlider: document.getElementById('progress-slider'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    waveAnim: document.getElementById('wave-anim'),
    likeBtn: document.getElementById('like-btn'),
    likeIcon: document.getElementById('like-icon'),
    
    // Modal & Menu
    btnMore: document.getElementById('btn-more'),
    moreMenu: document.getElementById('more-menu'),
    menuSongInfo: document.getElementById('menu-song-info'),
    menuEditTag: document.getElementById('menu-edit-tag'),
    editModal: document.getElementById('edit-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    saveEditBtn: document.getElementById('save-edit-btn'),
    editTitleInput: document.getElementById('edit-title-input'),
    editArtistInput: document.getElementById('edit-artist-input'),
    editCoverInput: document.getElementById('edit-cover-input'),
    editCoverPreview: document.getElementById('edit-cover-preview'),
    
    // Profile
    profilePicUpload: document.getElementById('profile-pic-upload'),
    profileAvatarContainer: document.getElementById('profile-avatar-container'),
    defaultAvatarIcon: document.getElementById('default-avatar-icon')
};

// Initialization
function init() {
    loadState();
    setupEventListeners();
    renderAll();
    
    // Create toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
}

// Storage
function loadState() {
    const saved = localStorage.getItem('musicApp_user');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.user = { ...state.user, ...parsed };
        } catch (e) {
            console.error('Failed to parse saved state', e);
        }
    }
}

function saveState() {
    localStorage.setItem('musicApp_user', JSON.stringify(state.user));
}

// Navigation
function switchView(targetId) {
    elements.views.forEach(view => {
        view.classList.remove('active');
        view.style.opacity = 0;
        view.style.transform = 'translateY(10px)';
    });
    const targetView = document.getElementById(`view-${targetId}`);
    targetView.classList.add('active');
    
    // Trigger reflow
    void targetView.offsetWidth;
    targetView.style.opacity = 1;
    targetView.style.transform = 'translateY(0)';
    
    elements.navItems.forEach(nav => {
        if (nav.dataset.target === targetId) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });
}

// Toast
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 12px 24px;
        border-radius: 24px;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: translateY(-20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = 1;
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = 0;
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event Listeners
function setupEventListeners() {
    elements.navItems.forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(nav.dataset.target);
        });
    });

    elements.fileUpload.addEventListener('change', handleFileUpload);
    elements.searchInput.addEventListener('input', handleSearch);

    elements.miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('.icon-btn')) return;
        openFullPlayer();
    });
    
    elements.miniPlayBtn.addEventListener('click', togglePlay);
    elements.miniPrevBtn.addEventListener('click', playPrev);
    elements.miniNextBtn.addEventListener('click', playNext);
    elements.miniRepeatBtn.addEventListener('click', toggleRepeat);

    elements.closePlayerBtn.addEventListener('click', closeFullPlayer);
    elements.btnPlay.addEventListener('click', togglePlay);
    elements.btnNext.addEventListener('click', playNext);
    elements.btnPrev.addEventListener('click', playPrev);
    elements.btnShuffle.addEventListener('click', toggleShuffle);
    elements.btnRepeat.addEventListener('click', toggleRepeat);
    elements.progressSlider.addEventListener('input', handleSeek);
    
    elements.likeBtn.addEventListener('click', toggleLike);

    // Modal & Menu
    elements.btnMore.addEventListener('click', () => {
        elements.moreMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!elements.btnMore.contains(e.target) && !elements.moreMenu.contains(e.target)) {
            elements.moreMenu.classList.add('hidden');
        }
    });

    elements.menuSongInfo.addEventListener('click', () => {
        elements.moreMenu.classList.add('hidden');
        const song = state.user.songs[state.currentSongIndex];
        if (song) {
            alert(`Title: ${song.name}\nArtist: ${song.artist}\nDuration: ${formatTime(song.duration)}`);
        }
    });

    elements.menuEditTag.addEventListener('click', () => {
        elements.moreMenu.classList.add('hidden');
        openEditModal();
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.editModal.classList.add('hidden');
    });

    elements.saveEditBtn.addEventListener('click', saveSongEdit);

    elements.editCoverInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                elements.editCoverPreview.style.backgroundImage = `url(${e.target.result})`;
                elements.editCoverPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    if (elements.profilePicUpload) {
        elements.profilePicUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    state.user.profilePic = e.target.result;
                    saveState();
                    updateProfileUI();
                    showToast("Profile picture updated!");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    elements.audio.addEventListener('timeupdate', updateProgress);
    elements.audio.addEventListener('ended', playNext);
    elements.audio.addEventListener('loadedmetadata', () => {
        elements.timeTotal.textContent = formatTime(elements.audio.duration);
    });
}

// File Handling
async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    showToast(`Importing ${files.length} song(s)...`);

    for (const file of files) {
        if (!file.type.startsWith('audio/')) continue;
        
        // Use a temporary audio element to get duration
        const tempAudio = document.createElement('audio');
        const tempUrl = URL.createObjectURL(file);
        
        tempAudio.src = tempUrl;
        await new Promise((resolve) => {
            tempAudio.addEventListener('loadedmetadata', () => resolve(), { once: true });
            tempAudio.addEventListener('error', () => resolve(), { once: true });
        });

        const songId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        
        // Save to IndexedDB
        try {
            await saveSongFile(songId, file);
        } catch (err) {
            console.error("Failed to save to IndexedDB", err);
            showToast("Error saving song!");
            continue;
        }

        const newSong = {
            id: songId,
            name: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Local Audio',
            duration: tempAudio.duration || 0,
            isLiked: false
        };

        state.user.songs.push(newSong);
        URL.revokeObjectURL(tempUrl);
    }
    
    saveState();
    renderAll();
    showToast("Import complete!");
    e.target.value = '';
}

// Rendering
function renderAll() {
    renderLibrary();
    renderFeed();
    renderRecent();
    updateProfileUI();
    elements.statSongs.textContent = state.user.songs.length;
}

function updateProfileUI() {
    if (state.user.profilePic) {
        elements.profileAvatarContainer.style.backgroundImage = `url(${state.user.profilePic})`;
        elements.profileAvatarContainer.style.backgroundSize = 'cover';
        elements.profileAvatarContainer.style.backgroundPosition = 'center';
        if (elements.defaultAvatarIcon) elements.defaultAvatarIcon.style.display = 'none';
    } else {
        elements.profileAvatarContainer.style.backgroundImage = '';
        if (elements.defaultAvatarIcon) elements.defaultAvatarIcon.style.display = 'block';
    }
}

function createSongListItem(song, index) {
    const div = document.createElement('div');
    div.className = 'list-item';
    
    const iconHtml = song.coverUrl 
        ? `<div style="width: 100%; height: 100%; border-radius: 8px; background-image: url('${song.coverUrl}'); background-size: cover; background-position: center;"></div>`
        : `<i data-lucide="music" style="color: white; opacity: 0.8;"></i>`;

    div.innerHTML = `
        <div class="item-icon" style="padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${iconHtml}
        </div>
        <div class="item-info">
            <div class="item-title">${song.name}</div>
            <div class="item-subtitle">${song.artist} • ${formatTime(song.duration)}</div>
        </div>
        <div class="item-action">
            <i data-lucide="play-circle"></i>
        </div>
    `;
    div.addEventListener('click', () => playSong(index));
    return div;
}

function createSongCard(song, index) {
    const div = document.createElement('div');
    div.className = 'card';
    
    const iconHtml = song.coverUrl 
        ? `<div style="width: 100%; height: 100%; border-radius: 12px; background-image: url('${song.coverUrl}'); background-size: cover; background-position: center;"></div>`
        : `<i data-lucide="music" style="width: 32px; height: 32px; color: white;"></i>`;

    div.innerHTML = `
        <div class="card-icon" style="padding: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${iconHtml}
        </div>
        <div class="card-title">${song.name}</div>
        <div class="card-subtitle">${song.artist}</div>
    `;
    div.addEventListener('click', () => playSong(index));
    return div;
}

function renderLibrary() {
    elements.libraryList.innerHTML = '';
    if (state.user.songs.length === 0) {
        elements.libraryList.innerHTML = '<div class="empty-state"><i data-lucide="music" style="margin-bottom:12px; width:48px; height:48px; opacity:0.5;"></i><br>Your library is empty.</div>';
        lucide.createIcons();
        return;
    }
    state.user.songs.forEach((song, i) => {
        elements.libraryList.appendChild(createSongListItem(song, i));
    });
    lucide.createIcons();
}

function renderFeed() {
    elements.homeFeed.innerHTML = '';
    if (state.user.songs.length === 0) {
        elements.homeFeed.innerHTML = '<div class="empty-state">Import songs to see them here.</div>';
        return;
    }
    [...state.user.songs].reverse().forEach((song, i) => {
        const originalIndex = state.user.songs.length - 1 - i;
        elements.homeFeed.appendChild(createSongListItem(song, originalIndex));
    });
    lucide.createIcons();
}

function renderRecent() {
    elements.homeRecent.innerHTML = '';
    if (state.user.recent.length === 0) {
        elements.homeRecent.innerHTML = '<div class="empty-state">No recently played songs.</div>';
        return;
    }
    state.user.recent.forEach(songId => {
        const songIndex = state.user.songs.findIndex(s => s.id === songId);
        if (songIndex !== -1) {
            elements.homeRecent.appendChild(createSongCard(state.user.songs[songIndex], songIndex));
        }
    });
    lucide.createIcons();
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    elements.searchResults.innerHTML = '';
    
    if (!query) {
        elements.searchResults.innerHTML = '<div class="empty-state">Search your library.</div>';
        return;
    }
    
    const results = state.user.songs.filter(s => s.name.toLowerCase().includes(query));
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<div class="empty-state">No songs found.</div>';
    } else {
        results.forEach(song => {
            const originalIndex = state.user.songs.findIndex(s => s.id === song.id);
            elements.searchResults.appendChild(createSongListItem(song, originalIndex));
        });
    }
    lucide.createIcons();
}

// Audio Player Logic
async function playSong(index) {
    if (index < 0 || index >= state.user.songs.length) return;
    
    const song = state.user.songs[index];
    state.currentSongIndex = index;
    
    // Add to recent
    state.user.recent = [song.id, ...state.user.recent.filter(id => id !== song.id)].slice(0, 10);
    saveState();
    renderRecent();

    // Fetch blob from DB
    try {
        const file = await getSongFile(song.id);
        if (!file) {
            showToast("Song file not found! It may have been cleared from storage.");
            return;
        }

        if (state.currentBlobUrl) {
            URL.revokeObjectURL(state.currentBlobUrl);
        }

        state.currentBlobUrl = URL.createObjectURL(file);
        elements.audio.src = state.currentBlobUrl;
        
        await elements.audio.play();
        state.isPlaying = true;
        updatePlayerUI();
        elements.miniPlayer.classList.remove('hidden');
    } catch (err) {
        console.error("Playback failed:", err);
        showToast("Error playing song.");
        state.isPlaying = false;
        updatePlayerUI();
    }
}

function togglePlay() {
    if (state.currentSongIndex === -1) return;
    
    if (state.isPlaying) {
        elements.audio.pause();
        state.isPlaying = false;
        updatePlayerUI();
    } else {
        elements.audio.play().then(() => {
            state.isPlaying = true;
            updatePlayerUI();
        }).catch(err => {
            console.error(err);
            state.isPlaying = false;
            updatePlayerUI();
        });
    }
}

function playNext() {
    if (state.user.songs.length === 0) return;
    
    if (state.isRepeat && elements.audio.currentTime >= elements.audio.duration - 0.5) {
        // If it ended and repeat is on, replay same song
        playSong(state.currentSongIndex);
        return;
    }
    
    let nextIndex;
    if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.user.songs.length);
        // Avoid repeating the same song if there's more than 1
        if (state.user.songs.length > 1 && nextIndex === state.currentSongIndex) {
            nextIndex = (nextIndex + 1) % state.user.songs.length;
        }
    } else {
        nextIndex = state.currentSongIndex + 1;
        if (nextIndex >= state.user.songs.length) nextIndex = 0;
    }
    
    playSong(nextIndex);
}

function playPrev() {
    if (state.user.songs.length === 0) return;
    let prevIndex = state.currentSongIndex - 1;
    if (prevIndex < 0) prevIndex = state.user.songs.length - 1;
    playSong(prevIndex);
}

function handleSeek() {
    const percent = elements.progressSlider.value;
    const time = (percent / 100) * elements.audio.duration;
    elements.audio.currentTime = time;
}

function updateProgress() {
    if (!elements.audio.duration) return;
    const current = elements.audio.currentTime;
    const total = elements.audio.duration;
    const percent = (current / total) * 100;
    
    elements.progressSlider.value = percent;
    elements.miniProgressFill.style.width = `${percent}%`;
    elements.timeCurrent.textContent = formatTime(current);
}

function updatePlayerUI() {
    if (state.currentSongIndex === -1) return;
    const song = state.user.songs[state.currentSongIndex];
    
    elements.miniTitle.textContent = song.name;
    elements.miniArtist.textContent = song.artist;
    elements.playerTitle.textContent = song.name;
    elements.playerArtist.textContent = song.artist;
    
    if (state.isPlaying) {
        elements.miniPlayBtn.innerHTML = '<i data-lucide="pause" id="mini-play-icon"></i>';
        elements.btnPlay.innerHTML = '<i data-lucide="pause" id="main-play-icon"></i>';
        elements.waveAnim.classList.remove('hidden');
        document.querySelector('.player-art').style.transform = 'scale(1)';
    } else {
        elements.miniPlayBtn.innerHTML = '<i data-lucide="play" id="mini-play-icon"></i>';
        elements.btnPlay.innerHTML = '<i data-lucide="play" id="main-play-icon"></i>';
        elements.waveAnim.classList.add('hidden');
        document.querySelector('.player-art').style.transform = 'scale(0.9)';
    }
    
    const currentLikeIcon = document.getElementById('like-icon');
    if (currentLikeIcon) {
        if (song.isLiked) {
            currentLikeIcon.classList.add('liked');
            currentLikeIcon.setAttribute('fill', '#ff3b30');
            currentLikeIcon.style.color = '#ff3b30';
        } else {
            currentLikeIcon.classList.remove('liked');
            currentLikeIcon.setAttribute('fill', 'none');
            currentLikeIcon.style.color = 'var(--text-secondary)';
        }
    }
    
    if (state.isShuffle) {
        elements.btnShuffle.classList.add('active-control');
    } else {
        elements.btnShuffle.classList.remove('active-control');
    }

    if (state.isRepeat) {
        elements.btnRepeat.classList.add('active-control');
        elements.miniRepeatBtn.classList.add('active-control');
    } else {
        elements.btnRepeat.classList.remove('active-control');
        elements.miniRepeatBtn.classList.remove('active-control');
    }
    
    // Custom Cover Update
    const playerArt = document.querySelector('.player-art');
    const miniArt = document.querySelector('.mini-art');
    if (song.coverUrl) {
        playerArt.style.backgroundImage = `url(${song.coverUrl})`;
        miniArt.style.backgroundImage = `url(${song.coverUrl})`;
        playerArt.style.backgroundSize = 'cover';
        miniArt.style.backgroundSize = 'cover';
    } else {
        playerArt.style.backgroundImage = '';
        miniArt.style.backgroundImage = '';
    }
    
    lucide.createIcons();
}

function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    updatePlayerUI();
}

function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    updatePlayerUI();
}

function openFullPlayer() {
    elements.fullPlayer.classList.remove('hidden');
}

function closeFullPlayer() {
    elements.fullPlayer.classList.add('hidden');
}

function toggleLike() {
    if (state.currentSongIndex === -1) return;
    const song = state.user.songs[state.currentSongIndex];
    song.isLiked = !song.isLiked;
    saveState();
    
    elements.likeBtn.classList.remove('heart-pop');
    void elements.likeBtn.offsetWidth; // trigger reflow
    elements.likeBtn.classList.add('heart-pop');
    
    updatePlayerUI();
}

function openEditModal() {
    if (state.currentSongIndex === -1) return;
    const song = state.user.songs[state.currentSongIndex];
    
    elements.editTitleInput.value = song.name;
    elements.editArtistInput.value = song.artist;
    
    if (song.coverUrl) {
        elements.editCoverPreview.style.backgroundImage = `url(${song.coverUrl})`;
        elements.editCoverPreview.classList.remove('hidden');
    } else {
        elements.editCoverPreview.style.backgroundImage = '';
        elements.editCoverPreview.classList.add('hidden');
    }
    
    elements.editModal.classList.remove('hidden');
}

function saveSongEdit() {
    if (state.currentSongIndex === -1) return;
    const song = state.user.songs[state.currentSongIndex];
    
    song.name = elements.editTitleInput.value || song.name;
    song.artist = elements.editArtistInput.value || song.artist;
    
    const file = elements.editCoverInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            song.coverUrl = e.target.result; // Base64 string
            saveState();
            updatePlayerUI();
            renderAll();
            elements.editModal.classList.add('hidden');
        };
        reader.readAsDataURL(file);
        return; // wait for reader to finish
    }
    
    saveState();
    updatePlayerUI();
    renderAll();
    elements.editModal.classList.add('hidden');
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', init);
