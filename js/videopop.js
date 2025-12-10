// js/videopop.js
// Video catalog + modal logic (safe, defensive, drop-in)
// Place this file in your project's js/ folder and include it before pdf-submit.js in the page.

(() => {
  'use strict';

  /* --- Video catalog (user-provided) --- */
  const VIDEO_CATALOG = [
    {
      id: 'demos',
      label: 'Machines',
      videos: [
        { id: 'mBNogPaOvg8', title: 'AIR COOL Series — Demo & Overview' },
        { id: 'nOhF8XUqZRs', title: 'AC40+ Machine' },
        { id: '7gtKkNiBnmc', title: 'GE-DW-200' },
        { id: 'jOR-KtfGXbc', title: 'Forced feeder Extruder' },
        { id: 'vb1-RVSIWxM', title: 'Recycling PP FIBC super sack' }
      ]
    },
    {
      id: 'howto',
      label: 'How-to / Maintenance',
      videos: [
        { id: '3fumBcKC6RE', title: 'Cleaning & Maintenance' },
        { id: 'kXYiU_JCYtU', title: 'Replacement Parts Guide' },
        { id: 'e-ORhEE9VVg', title: 'Troubleshooting Common Issues' }
      ]
    },
    {
      id: 'testimonials',
      label: 'Customer Reviews',
      videos: [
        { id: 'dQw4w9WgXcQ', title: 'Customer: Small Recycling Plant' },
        { id: 'oHg5SJYRHA0', title: 'Client Feedback & Setup' }
      ]
    }
  ];

  // Small helpers (safe DOM queries)
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Elements (may be null if page doesn't include modal)
  const openBtn = $('#open-video-modal');
  const modal = $('#video-modal');
  const backdrop = $('#video-modal-backdrop');
  const closeBtn = $('#video-modal-close');
  const iframe = $('#video-iframe');
  const playlistSelect = $('#playlist-select');
  const videoSelect = $('#video-select');
  const playlistVideos = $('#playlist-videos');
  const playBtn = $('#play-selected');
  const openInYouTube = $('#open-in-youtube');

  // If modal container not present, nothing to do
  if (!modal || !iframe || !playlistSelect || !videoSelect || !playlistVideos) {
    // silently exit — page doesn't include video modal
    return;
  }

  // build urls
  const embedUrl = (videoId, autoplay = true) => {
    if (!videoId) return '';
    const auto = autoplay ? '1' : '0';
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=${auto}`;
  };
  const thumbUrl = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

  // populate playlist select
  function populatePlaylistSelect() {
    playlistSelect.innerHTML = '';
    VIDEO_CATALOG.forEach((pl, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = pl.label || `Playlist ${idx + 1}`;
      playlistSelect.appendChild(opt);
    });
  }

  // populate videos for chosen playlist, and the right-hand list
  function populateVideosForPlaylist(index) {
    videoSelect.innerHTML = '';
    playlistVideos.innerHTML = '';

    const pl = VIDEO_CATALOG[index];
    if (!pl || !Array.isArray(pl.videos)) return;

    pl.videos.forEach((v, i) => {
      // select option
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.title || `Video ${i + 1}`;
      videoSelect.appendChild(opt);

      // list item for desktop
      const li = document.createElement('li');
      li.className = 'flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer';
      li.innerHTML = `
        <img src="${thumbUrl(v.id)}" alt="${(v.title||'')}" class="w-20 h-12 object-cover rounded flex-shrink-0">
        <div class="flex-1">
          <div class="font-medium text-sm">${v.title}</div>
          <div class="text-xs text-gray-500">${v.id}</div>
        </div>
      `;
      li.addEventListener('click', () => {
        videoSelect.value = v.id;
        setVideo(v.id);
      });
      playlistVideos.appendChild(li);
    });
  }

  function setVideo(videoId) {
    iframe.src = embedUrl(videoId, true);
    if (openInYouTube) {
      openInYouTube.href = `https://www.youtube.com/watch?v=${videoId}`;
      openInYouTube.classList.remove('hidden');
    }
  }

  function openModal() {
    populatePlaylistSelect();
    const defaultIndex = 0;
    playlistSelect.selectedIndex = defaultIndex;
    populateVideosForPlaylist(defaultIndex);

    const firstVid = VIDEO_CATALOG?.[0]?.videos?.[0]?.id;
    if (firstVid) {
      videoSelect.value = firstVid;
      setVideo(firstVid);
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    playlistSelect.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    try { iframe.src = ''; } catch (e) {/* ignore */}
    document.body.classList.remove('overflow-hidden');
    if (openBtn) openBtn.focus();
  }

  // Attach event listeners defensively
  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  if (playlistSelect) {
    playlistSelect.addEventListener('change', (e) => {
      const idx = Number(e.target.value) || 0;
      populateVideosForPlaylist(idx);
      const firstVid = VIDEO_CATALOG[idx]?.videos?.[0]?.id;
      if (firstVid) {
        videoSelect.value = firstVid;
        setVideo(firstVid);
      } else {
        iframe.src = '';
        if (openInYouTube) openInYouTube.classList.add('hidden');
      }
    });
  }

  if (videoSelect) {
    videoSelect.addEventListener('change', (e) => {
      setVideo(e.target.value);
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      const vid = videoSelect && videoSelect.value ? videoSelect.value : null;
      if (vid) setVideo(vid);
    });
  }

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  // initialize selects (modal remains hidden)
  populatePlaylistSelect();

})();
