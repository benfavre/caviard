(() => {
  const lab = document.querySelector('.ipdf-lab');
  const replay = document.querySelector('[data-demo-replay]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (lab) {
    const inputs = [...lab.querySelectorAll('.ipdf-demo-options input')];
    const undo = lab.querySelector('[data-demo-undo]');
    const redo = lab.querySelector('[data-demo-redo]');
    const clear = lab.querySelector('[data-demo-clear]');
    const past = [], future = [];
    let current = inputs.map(input => input.checked);
    lab.querySelector('.ipdf-demo-history').hidden = false;
    const sync = () => {
      inputs.forEach((input, index) => { input.checked = current[index]; });
      const count = current.filter(Boolean).length;
      const zones = count + (count === 1 ? ' zone' : ' zones');
      lab.querySelector('[data-demo-count]').textContent = zones + ' à caviarder · 1 document';
      lab.querySelector('[data-demo-state]').textContent = count ? 'Modifications à exporter' : 'Prêt à caviarder';
      lab.querySelector('[data-demo-thumbnail]').textContent = zones;
      undo.disabled = !past.length;
      redo.disabled = !future.length;
      clear.disabled = !count;
    };
    const change = next => {
      past.push(current.slice());
      future.length = 0;
      current = next;
      lab.classList.remove('is-replaying');
      sync();
    };
    inputs.forEach(input => input.addEventListener('change', () => change(inputs.map(input => input.checked))));
    undo.addEventListener('click', () => {
      if (!past.length) return;
      future.push(current.slice()); current = past.pop(); sync();
    });
    redo.addEventListener('click', () => {
      if (!future.length) return;
      past.push(current.slice()); current = future.pop(); sync();
    });
    clear.addEventListener('click', () => change(current.map(() => false)));
    lab.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); (event.shiftKey ? redo : undo).click();
      }
    });
    sync();
  }
  const menu = document.querySelector('.ipdf-nav-menu');
  if (menu) {
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false; menu.querySelector('summary').focus();
      }
    });
  }
  const sectionLinks = [...document.querySelectorAll('[data-section-link]')];
  const sections = [...new Set(sectionLinks.map(link => link.hash))].map(hash => document.querySelector(hash)).filter(Boolean);
  let scheduled = false;
  const updateNavigation = () => {
    scheduled = false;
    const offset = (document.querySelector('.ipdf-site-header')?.offsetHeight || 76) + 110;
    let active;
    sections.forEach(section => { if (section.getBoundingClientRect().top <= offset) active = section; });
    sectionLinks.forEach(link => {
      if (active && link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
  }, { passive: true });
  updateNavigation();
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
