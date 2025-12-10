// js/pdf-submit.js — robust download modal + submit handler with inference
(function () {
  'use strict';

  function init() {
    const downloadBtn = document.getElementById('download-btn');
    const modal = document.getElementById('download-modal');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('cancel');
    const form = document.getElementById('download-form');
    const formMsg = document.getElementById('form-msg');

    if (!downloadBtn) return console.warn('[pdf-submit] Missing #download-btn');
    if (!modal) return console.warn('[pdf-submit] Missing #download-modal');
    if (!form) return console.warn('[pdf-submit] Missing #download-form');

    const setMsg = (text, isError = false) => {
      if (!formMsg) return;
      formMsg.textContent = text;
      formMsg.style.color = isError ? '#dc2626' : '#064e3b';
    };

    const openModal = () => {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      setMsg('', false);
      const first = form.querySelector('input, button, textarea, select');
      if (first) first.focus();
    };

    const closeModal = () => {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      try { downloadBtn.focus(); } catch (e) {}
    };

    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    [closeBtn, cancelBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeModal();
      });
    });

    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    // infer key from path like "series-cutter-compactor.html" -> "cutter-compactor"
    function inferKeyFromPath() {
      try {
        const p = location.pathname.split('/').pop() || '';
        const base = p.replace(/\.html$/i, '') || '';
        return base.replace(/^series-/, '').replace(/^page-/, '');
      } catch (e) {
        return '';
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      setMsg('Processing...', false);

      try {
        const fd = new FormData(form);
        const inferred = inferKeyFromPath();
        // prefer explicit data-pdf, fallback to inferred key
        const pdfKey = (downloadBtn && downloadBtn.dataset && downloadBtn.dataset.pdf)
          ? downloadBtn.dataset.pdf
          : inferred;

        // set dataset for future operations so network shows it
        if (pdfKey && !(downloadBtn.dataset && downloadBtn.dataset.pdf)) {
          try { downloadBtn.dataset.pdf = pdfKey; } catch (e) {}
        }

        const payload = {
          name: (fd.get('name') || '').toString().trim(),
          email: (fd.get('email') || '').toString().trim(),
          mobile: (fd.get('mobile') || '').toString().trim(),
          pdf: pdfKey || ''
        };

        if (!payload.name || !payload.email || !payload.mobile) {
          setMsg('Please fill all required fields.', true);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        const res = await fetch('/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({ message: res.statusText }));
          setMsg('Error: ' + (errJson.message || res.statusText), true);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        const blob = await res.blob();

        let filename = (downloadBtn && downloadBtn.dataset && downloadBtn.dataset.fallbackName)
          ? downloadBtn.dataset.fallbackName
          : (pdfKey ? pdfKey + '.pdf' : 'download.pdf');

        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename\*=UTF-8''(.+)|filename="?(.+?)"?$/);
        if (m) filename = decodeURIComponent(m[1] || m[2]);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setMsg('Download started — check your browser.', false);
        form.reset();
        setTimeout(closeModal, 800);
      } catch (err) {
        console.error('[pdf-submit] Error:', err);
        setMsg('Network or server error.', true);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    console.log('[pdf-submit] initialized (inference=' + (downloadBtn.dataset.pdf ? 'explicit' : 'inferred') + ')');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
