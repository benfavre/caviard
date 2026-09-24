(() => {
  const lab = document.querySelector('.ipdf-lab');
  const replay = document.querySelector('[data-demo-replay]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (lab && replay) {
    replay.hidden = false;
    replay.addEventListener('click', () => {
      if (reducedMotion.matches) return;
      lab.classList.remove('is-replaying');
      void lab.offsetWidth;
      lab.classList.add('is-replaying');
    });
  }
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add(entry.target === lab ? 'is-replaying' : 'is-visible');
      observer.unobserve(entry.target);
    }), { threshold: 0.4 });
    document.querySelectorAll('.ipdf-lab, .ipdf-local-diagram').forEach(el => observer.observe(el));
  }
  const video = document.querySelector('#ipdf-screencast');
  if (!video) return;
  const chapters = [...document.querySelectorAll('[data-video-time]')];
  chapters.forEach(link => link.addEventListener('click', async event => {
    event.preventDefault();
    video.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    try {
      // Seek only once metadata is available, including a first chapter click.
      if (!video.readyState) {
        await new Promise((resolve, reject) => {
          video.addEventListener('loadedmetadata', resolve, { once: true });
          video.addEventListener('error', reject, { once: true });
          video.load();
        });
      }
      video.currentTime = Number(link.dataset.videoTime);
      await video.play();
    } catch {
      // Native controls remain available when playback is blocked.
      video.focus();
    }
  }));
  video.addEventListener('timeupdate', () => {
    let active = chapters[0];
    chapters.forEach(link => { if (video.currentTime >= Number(link.dataset.videoTime)) active = link; });
    chapters.forEach(link => {
      if (link === active) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  });
  // Do not keep a user-started recording playing in an invisible tab.
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
})();
