const state = {
  works: [],
  mode: "selected",
  mood: null,
  world: null,
  moreOpen: false,
};

const SELECTED_DESKTOP = 8;
const SELECTED_MOBILE = 4;
const MOBILE_QUERY = "(max-width: 760px)";

const elements = {
  header: document.querySelector("#site-header"),
  navToggle: document.querySelector("#nav-toggle"),
  nav: document.querySelector("#site-nav"),
  selectedHeading: document.querySelector("#selected-heading"),
  explorePanel: document.querySelector("#explore-panel"),
  exploreAll: document.querySelector("#explore-all"),
  moodFilters: document.querySelector("#mood-filters"),
  moreToggle: document.querySelector("#more-toggle"),
  moreFilters: document.querySelector("#more-filters"),
  worldFilters: document.querySelector("#world-filters"),
  clearFilters: document.querySelector("#clear-filters"),
  audioGrid: document.querySelector("#audio-grid"),
  returnSelected: document.querySelector("#return-selected"),
  returnSelectedWrap: document.querySelector("#return-selected-wrap"),
  videoGrid: document.querySelector("#video-grid"),
  year: document.querySelector("#year"),
  footer: document.querySelector("#site-footer"),
  contactEmail: document.querySelector("#contact-email"),
  modal: document.querySelector("#modal"),
  modalClose: document.querySelector("#modal-close"),
  modalContent: document.querySelector("#modal-content"),
  player: document.querySelector("#persistent-player"),
  audio: document.querySelector("#global-audio"),
  playerArtwork: document.querySelector("#player-artwork"),
  playerTitle: document.querySelector("#player-title"),
  playerMeta: document.querySelector("#player-meta"),
  playerPrevious: document.querySelector("#player-previous"),
  playerToggle: document.querySelector("#player-toggle"),
  playerNext: document.querySelector("#player-next"),
  playerCurrent: document.querySelector("#player-current"),
  playerProgress: document.querySelector("#player-progress"),
  playerDuration: document.querySelector("#player-duration"),
  playerDismiss: document.querySelector("#player-dismiss"),
};

let currentTrack = null;
let transitionTimeline = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function normaliseWork(work) {
  const moods = Array.isArray(work.moods)
    ? work.moods
    : Array.isArray(work.categories)
      ? work.categories
      : [];

  const settings = Array.isArray(work.settings) ? work.settings : [];
  const mediums = Array.isArray(work.mediums) ? work.mediums : [];
  const instrumentation = Array.isArray(work.instrumentation)
    ? work.instrumentation
    : [];

  return {
    ...work,
    moods,
    settings,
    mediums,
    instrumentation,
  };
}

function audioWorks() {
  return state.works.filter((work) => work.type === "audio");
}

function videoWorks() {
  return state.works.filter(
    (work) => work.type === "youtube" || work.type === "video",
  );
}

function worldsFor(work) {
  return [...work.settings, ...work.mediums];
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((first, second) =>
    first.localeCompare(second),
  );
}

function selectedCount() {
  return window.matchMedia(MOBILE_QUERY).matches
    ? SELECTED_MOBILE
    : SELECTED_DESKTOP;
}

function visibleTracks() {
  const tracks = audioWorks();

  if (state.mode === "selected") {
    return tracks.slice(0, selectedCount());
  }

  return tracks.filter((track) => {
    const moodMatches =
      !state.mood || track.moods.includes(state.mood);

    const worldMatches =
      !state.world || worldsFor(track).includes(state.world);

    return moodMatches && worldMatches;
  });
}

function currentPlaylist() {
  const visible = visibleTracks();
  return visible.length ? visible : audioWorks();
}

async function init() {
  const [musicResponse, videosResponse] = await Promise.all([
    fetch("data/music.json?v=22.3"),
    fetch("data/videos.json?v=22.3"),
  ]);

  if (!musicResponse.ok) {
    throw new Error("Could not load data/music.json");
  }

  if (!videosResponse.ok) {
    throw new Error("Could not load data/videos.json");
  }

  const [musicWorks, videoWorksData] = await Promise.all([
    musicResponse.json(),
    videosResponse.json(),
  ]);

  state.works = [...musicWorks, ...videoWorksData].map(normaliseWork);

  renderFilters();
  renderAudio({ animate: false });
  renderVideos();
  updateModePresentation();

  elements.year.textContent = new Date().getFullYear();

  bindExplore();
  bindNavigation();
  bindPlayer();
  bindModal();
  bindResponsive();
  setupLayoutMetrics();
  setupPlayerAvoidance();
  setupMotion();
}

function renderFilters() {
  const moods = uniqueSorted(audioWorks().flatMap((work) => work.moods));
  const worlds = uniqueSorted(audioWorks().flatMap(worldsFor));

  renderFilterButtons(elements.moodFilters, moods, "mood", state.mood);
  renderFilterButtons(elements.worldFilters, worlds, "world", state.world);

  elements.clearFilters.hidden = !(state.mood || state.world);
}

function scrollToFilteredTracks() {
  window.requestAnimationFrame(() => {
    const headerHeight =
      elements.header?.getBoundingClientRect().height || 0;

    const panelHeight =
      state.mode === "catalogue"
        ? elements.explorePanel.getBoundingClientRect().height
        : 0;

    const gap = window.matchMedia(MOBILE_QUERY).matches ? 12 : 18;

    const targetTop =
      window.scrollY +
      elements.audioGrid.getBoundingClientRect().top -
      headerHeight -
      panelHeight -
      gap;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  });
}

function renderFilterButtons(container, values, key, activeValue) {
  container.innerHTML = values
    .map(
      (value) => `
        <button
          class="filter-chip ${value === activeValue ? "is-active" : ""}"
          type="button"
          data-filter-key="${key}"
          data-filter-value="${escapeHtml(value)}">
          ${escapeHtml(value)}
        </button>
      `,
    )
    .join("");

  container.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const filterKey = button.dataset.filterKey;
      const value = button.dataset.filterValue;

      state[filterKey] = state[filterKey] === value ? null : value;

      enterCatalogue({ animate: true, scroll: false });
      renderFilters();
      renderAudio({ animate: true });
      scrollToFilteredTracks();
    });
  });
}

function metadataMarkup(work) {
  const moods = work.moods.join(" · ");
  const worlds = worldsFor(work).join(" · ");
  const instrumentation = work.instrumentation.join(" · ");

  return `
    <div class="card-meta">
      ${moods ? `<p class="card-moods">${escapeHtml(moods)}</p>` : ""}
      ${worlds ? `<p class="card-worlds">${escapeHtml(worlds)}</p>` : ""}
      ${
        instrumentation
          ? `<p class="card-instrumentation">${escapeHtml(instrumentation)}</p>`
          : ""
      }
    </div>
  `;
}

function renderAudio({ animate = false } = {}) {
  const tracks = visibleTracks();

  elements.audioGrid.innerHTML = tracks.length
    ? tracks
        .map(
          (work) => `
            <button
              class="audio-card"
              type="button"
              data-work-index="${state.works.indexOf(work)}">
              ${
                work.thumbnail
                  ? `<img
                       class="card-media"
                       src="${escapeHtml(work.thumbnail)}"
                       alt=""
                       onerror="this.remove()">`
                  : `<div class="fallback"></div>`
              }

              <div class="card-overlay"></div>

              <div class="card-copy">
                <h3>${escapeHtml(work.title)}</h3>
                ${metadataMarkup(work)}
              </div>

              <span class="play-circle" aria-hidden="true">▶</span>
            </button>
          `,
        )
        .join("")
    : `<p class="empty-state">No tracks match this selection.</p>`;

  elements.audioGrid.querySelectorAll(".audio-card").forEach((card) => {
    card.addEventListener("click", () => {
      const work = state.works[Number(card.dataset.workIndex)];
      playTrack(work);
    });
  });

  syncPlayingCard();

  if (animate) {
    animateCards(elements.audioGrid.querySelectorAll(".audio-card"));
  }

  refreshScrollTrigger();
}

function youtubeThumbnail(source) {
  const match = source.match(/embed\/([^?&/]+)/);
  return match
    ? `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`
    : "";
}

function videoThumbnailMarkup(work) {
  const automatic = youtubeThumbnail(work.src);
  const preferred = work.thumbnail || automatic;

  if (!preferred) return `<div class="fallback"></div>`;

  const fallback =
    work.thumbnail && automatic
      ? `onerror="this.onerror=null;this.src='${escapeHtml(automatic)}'"`
      : `onerror="this.remove()"`;

  return `
    <img
      class="video-media"
      src="${escapeHtml(preferred)}"
      alt=""
      ${fallback}>
  `;
}

function renderVideos() {
  elements.videoGrid.innerHTML = videoWorks()
    .map(
      (work) => `
        <button
          class="video-card"
          type="button"
          data-work-index="${state.works.indexOf(work)}">
          <div class="video-frame">
            ${videoThumbnailMarkup(work)}
            <span class="play-circle" aria-hidden="true">▶</span>
          </div>

          <h3>${escapeHtml(work.title)}</h3>
          <p>${escapeHtml(work.subtitle || "")}</p>
        </button>
      `,
    )
    .join("");

  elements.videoGrid.querySelectorAll(".video-card").forEach((card) => {
    card.addEventListener("click", () => {
      const work = state.works[Number(card.dataset.workIndex)];
      openVideo(work);
    });
  });
}

function updateModePresentation() {
  const isCatalogue = state.mode === "catalogue";

  /*
   * Safari can leave small glyph fragments behind when a GSAP-animated
   * heading is hidden while transform/opacity styles are still active.
   * Stop those animations and clear all inline motion styles first.
   */
  if (window.gsap && elements.selectedHeading) {
    const headingChildren =
      elements.selectedHeading.querySelectorAll("*");

    gsap.killTweensOf(elements.selectedHeading);
    gsap.killTweensOf(headingChildren);

    gsap.set(elements.selectedHeading, {
      clearProps: "transform,opacity,visibility",
    });

    gsap.set(headingChildren, {
      clearProps: "transform,opacity,visibility",
    });
  }

  elements.selectedHeading.hidden = isCatalogue;
  elements.returnSelectedWrap.hidden = !isCatalogue;
  elements.moreToggle.hidden = !isCatalogue;
  elements.moreFilters.hidden = !(isCatalogue && state.moreOpen);

  elements.explorePanel.classList.toggle(
    "explore-panel--invitation",
    !isCatalogue,
  );

  elements.explorePanel.classList.toggle(
    "explore-panel--catalogue",
    isCatalogue,
  );

  elements.exploreAll.classList.toggle(
    "is-active",
    isCatalogue && !state.mood && !state.world,
  );

  const exploreAllLabel =
    elements.exploreAll.querySelector(".explore-all-label");

  if (exploreAllLabel) {
    exploreAllLabel.textContent = isCatalogue
      ? "All tracks"
      : "Explore all tracks";
  }

  elements.moreToggle.setAttribute(
    "aria-expanded",
    String(state.moreOpen),
  );

  elements.moreToggle.querySelector("span").textContent =
    state.moreOpen ? "−" : "+";
}

function moveExplorePanel(position, { animate = true } = {}) {
  const oldRect = elements.explorePanel.getBoundingClientRect();

  if (position === "above") {
    elements.audioGrid.before(elements.explorePanel);
  } else {
    elements.audioGrid.after(elements.explorePanel);
  }

  const newRect = elements.explorePanel.getBoundingClientRect();

  if (!animate || !window.gsap) return;

  /*
   * Do not transform the panel after it becomes sticky. Chromium and Gecko
   * include transforms in sticky positioning differently while the transform
   * is active. Animating its contents preserves the transition without
   * changing the sticky element's coordinate system.
   */
  if (position === "above") {
    gsap.fromTo(
      elements.explorePanel.children,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: "power3.out",
        stagger: 0.035,
        clearProps: "transform,opacity",
      },
    );
    return;
  }

  const deltaX = oldRect.left - newRect.left;
  const deltaY = oldRect.top - newRect.top;

  gsap.fromTo(
    elements.explorePanel,
    {
      x: deltaX,
      y: deltaY,
    },
    {
      x: 0,
      y: 0,
      duration: 0.9,
      ease: "power3.inOut",
      clearProps: "transform",
    },
  );
}

function enterCatalogue({ animate = true, scroll = false } = {}) {
  if (state.mode === "catalogue") {
    updateModePresentation();
    return;
  }

  state.mode = "catalogue";
  updateModePresentation();
  moveExplorePanel("above", { animate });

  if (animate) {
    animateCatalogueTransition();
  }

  if (scroll) {
    window.requestAnimationFrame(() => {
      elements.explorePanel.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
}

function returnToSelected() {
  state.mode = "selected";
  state.mood = null;
  state.world = null;
  state.moreOpen = false;

  renderFilters();
  updateModePresentation();
  moveExplorePanel("below", { animate: true });
  renderAudio({ animate: false });
  animateSelectedTransition();

  window.requestAnimationFrame(() => {
    elements.selectedHeading.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function bindExplore() {
  elements.exploreAll.addEventListener("click", () => {
    state.mood = null;
    state.world = null;

    enterCatalogue({ animate: true, scroll: true });
    renderFilters();
    renderAudio({ animate: true });
  });

  elements.moreToggle.addEventListener("click", () => {
    state.moreOpen = !state.moreOpen;
    updateModePresentation();

    if (state.moreOpen && window.gsap) {
      gsap.fromTo(
        elements.moreFilters,
        { opacity: 0, y: -8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power3.out",
        },
      );
    }

    refreshScrollTrigger();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.mood = null;
    state.world = null;

    renderFilters();
    updateModePresentation();
    renderAudio({ animate: true });
    scrollToFilteredTracks();
  });

  elements.returnSelected.addEventListener("click", returnToSelected);
}

function animateCatalogueTransition() {
  if (!window.gsap) return;

  transitionTimeline?.kill();

  transitionTimeline = gsap.timeline({
    defaults: {
      ease: "power3.inOut",
    },
  });

  transitionTimeline.fromTo(
    elements.audioGrid,
    {
      opacity: 0.72,
      y: 26,
    },
    {
      opacity: 1,
      y: 0,
      duration: 0.85,
      clearProps: "transform,opacity",
    },
    0.12,
  );
}

function animateSelectedTransition() {
  if (!window.gsap) return;

  gsap.fromTo(
    elements.audioGrid.querySelectorAll(".audio-card"),
    {
      opacity: 0,
      y: 30,
      scale: 0.98,
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.65,
      ease: "power3.out",
      stagger: 0.055,
      clearProps: "transform,opacity",
    },
  );
}

function animateCards(cards) {
  cards.forEach((card) => {
    card.style.visibility = "visible";
  });

  if (!window.gsap) return;

  gsap.fromTo(
    cards,
    {
      opacity: 0,
      y: 38,
      scale: 0.975,
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.72,
      ease: "power3.out",
      stagger: 0.045,
      overwrite: true,
      clearProps: "transform,opacity",
    },
  );
}

function bindNavigation() {
  elements.navToggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");

    elements.navToggle.setAttribute("aria-expanded", String(open));
    elements.navToggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
  });

  elements.nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNavigation);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavigation();
  });
}

function closeNavigation() {
  document.body.classList.remove("nav-open");
  elements.navToggle.setAttribute("aria-expanded", "false");
  elements.navToggle.setAttribute("aria-label", "Open navigation");
}

function bindResponsive() {
  const query = window.matchMedia(MOBILE_QUERY);

  const handleChange = () => {
    if (state.mode === "selected") {
      renderAudio({ animate: false });
    }

    if (!query.matches) closeNavigation();

    refreshScrollTrigger();
  };

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handleChange);
  } else {
    query.addListener(handleChange);
  }
}

function setupLayoutMetrics() {
  if (!elements.header) return;

  let scheduled = false;

  const updateHeaderHeight = () => {
    scheduled = false;
    const height = Math.ceil(elements.header.getBoundingClientRect().height);
    const value = `${height}px`;

    if (
      height > 0 &&
      document.documentElement.style.getPropertyValue("--header-height") !==
        value
    ) {
      document.documentElement.style.setProperty(
        "--header-height",
        value,
      );
      refreshScrollTrigger();
    }
  };

  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateHeaderHeight);
  };

  requestUpdate();
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("orientationchange", requestUpdate);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(requestUpdate);
    observer.observe(elements.header);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(requestUpdate).catch(() => {});
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remaining}`;
}

function bindPlayer() {
  elements.playerPrevious.addEventListener("click", async () => {
    try {
      await playPrevious();
    } catch (error) {
      console.error(error);
    }
  });

  elements.playerToggle.addEventListener("click", async () => {
    if (!currentTrack) return;

    if (elements.audio.paused) {
      await elements.audio.play();
    } else {
      elements.audio.pause();
    }
  });

  elements.playerNext.addEventListener("click", async () => {
    try {
      await playNext();
    } catch (error) {
      console.error(error);
    }
  });

  elements.playerDismiss.addEventListener("click", closePlayer);

  elements.audio.addEventListener("play", () => setPlayerState(true));
  elements.audio.addEventListener("pause", () => setPlayerState(false));

  elements.audio.addEventListener("ended", async () => {
    setPlayerState(false);

    try {
      await playNext();
    } catch (error) {
      console.error(error);
    }
  });

  elements.audio.addEventListener("loadedmetadata", () => {
    elements.playerDuration.textContent = formatTime(
      elements.audio.duration,
    );
  });

  elements.audio.addEventListener("timeupdate", () => {
    elements.playerCurrent.textContent = formatTime(
      elements.audio.currentTime,
    );

    if (
      Number.isFinite(elements.audio.duration) &&
      elements.audio.duration > 0
    ) {
      elements.playerProgress.value = Math.round(
        (elements.audio.currentTime / elements.audio.duration) * 1000,
      );
    }
  });

  elements.playerProgress.addEventListener("input", () => {
    if (
      !Number.isFinite(elements.audio.duration) ||
      elements.audio.duration <= 0
    ) {
      return;
    }

    elements.audio.currentTime =
      (Number(elements.playerProgress.value) / 1000) *
      elements.audio.duration;
  });
}

async function playTrack(track) {
  if (currentTrack === track) {
    if (elements.audio.paused) {
      await elements.audio.play();
    } else {
      elements.audio.pause();
    }

    return;
  }

  currentTrack = track;
  elements.audio.src = track.src;

  elements.playerTitle.textContent = track.title;
  elements.playerMeta.textContent = [
    ...track.moods,
    ...worldsFor(track),
  ].join(" · ");

  if (track.thumbnail) {
    elements.playerArtwork.src = track.thumbnail;
    elements.playerArtwork.hidden = false;
  } else {
    elements.playerArtwork.hidden = true;
    elements.playerArtwork.removeAttribute("src");
  }

  elements.player.hidden = false;
  document.body.classList.add("player-visible");

  elements.playerProgress.value = 0;
  elements.playerCurrent.textContent = "0:00";
  elements.playerDuration.textContent = "0:00";

  updatePlayerOffset();

  try {
    await elements.audio.play();
  } catch (error) {
    console.error("Audio playback could not start:", error);
    setPlayerState(false);
  }
}

function setPlayerState(playing) {
  elements.playerToggle.classList.toggle("is-playing", playing);
  elements.playerToggle.setAttribute(
    "aria-label",
    playing ? "Pause" : "Play",
  );

  syncPlayingCard();
}

function syncPlayingCard() {
  elements.audioGrid.querySelectorAll(".audio-card").forEach((card) => {
    const track = state.works[Number(card.dataset.workIndex)];

    card.classList.toggle(
      "is-playing",
      Boolean(
        currentTrack &&
        track === currentTrack &&
        !elements.audio.paused,
      ),
    );
  });
}

function previousTrack() {
  const visiblePlaylist = currentPlaylist();
  const fullCatalogue = audioWorks();

  if (!fullCatalogue.length) return null;

  const visibleIndex = visiblePlaylist.indexOf(currentTrack);

  /*
   * While the current track belongs to the visible selection, Previous moves
   * within that selection. At its beginning it falls back to the previous
   * track in the complete catalogue.
   */
  if (visibleIndex > 0) {
    return visiblePlaylist[visibleIndex - 1];
  }

  const catalogueIndex = fullCatalogue.indexOf(currentTrack);

  if (catalogueIndex >= 0) {
    return fullCatalogue[
      (catalogueIndex - 1 + fullCatalogue.length) % fullCatalogue.length
    ];
  }

  return fullCatalogue[fullCatalogue.length - 1];
}

function nextTrack() {
  const visiblePlaylist = currentPlaylist();
  const fullCatalogue = audioWorks();

  if (!fullCatalogue.length) return null;

  const visibleIndex = visiblePlaylist.indexOf(currentTrack);

  /*
   * Continue through the visible selection while another visible track
   * remains. Do not wrap back to the first visible item.
   */
  if (
    visibleIndex >= 0 &&
    visibleIndex < visiblePlaylist.length - 1
  ) {
    return visiblePlaylist[visibleIndex + 1];
  }

  /*
   * At the end of a selected or filtered subset, break out into the complete
   * catalogue and continue from the current track's global position.
   *
   * Once playback has left the subset, currentTrack is no longer found in the
   * visible playlist and this full-catalogue path continues naturally.
   */
  const catalogueIndex = fullCatalogue.indexOf(currentTrack);

  if (catalogueIndex >= 0) {
    return fullCatalogue[
      (catalogueIndex + 1) % fullCatalogue.length
    ];
  }

  return fullCatalogue[0];
}

async function playPrevious() {
  if (elements.audio.currentTime > 3) {
    elements.audio.currentTime = 0;
    await elements.audio.play();
    return;
  }

  const track = previousTrack();
  if (track) await playTrack(track);
}

async function playNext() {
  const track = nextTrack();
  if (track) await playTrack(track);
}

function closePlayer() {
  elements.audio.pause();
  elements.audio.removeAttribute("src");
  elements.audio.load();

  currentTrack = null;
  elements.player.hidden = true;
  elements.player.style.removeProperty("--player-bottom");
  document.documentElement.style.setProperty("--player-stack-offset", "0px");

  document.body.classList.remove("player-visible");
  setPlayerState(false);
}

function setupPlayerAvoidance() {
  let scheduled = false;

  const requestUpdate = () => {
    if (scheduled) return;

    scheduled = true;

    window.requestAnimationFrame(() => {
      updatePlayerOffset();
      scheduled = false;
    });
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
}

function updatePlayerOffset() {
  if (elements.player.hidden) return;

  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const gap = mobile ? 8 : 16;
  const viewportHeight = window.innerHeight;
  const playerHeight = elements.player.offsetHeight;

  let requiredBottom = gap;

  if (elements.footer) {
    const rect = elements.footer.getBoundingClientRect();

    if (rect.top < viewportHeight && rect.bottom > 0) {
      const footerOverlap = viewportHeight - rect.top;
      requiredBottom = Math.max(requiredBottom, footerOverlap + gap);
    }
  }

  elements.player.style.setProperty(
    "--player-bottom",
    `${requiredBottom}px`,
  );

  document.documentElement.style.setProperty(
    "--player-stack-offset",
    mobile ? `${playerHeight + requiredBottom + 10}px` : "0px",
  );
}

function bindModal() {
  elements.modalClose.addEventListener("click", closeModal);

  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closeModal();
  });

  elements.modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeModal();
  });
}

function openVideo(work) {
  if (!elements.audio.paused) {
    elements.audio.pause();
  }

  const player =
    work.type === "youtube"
      ? `<iframe
           src="${escapeHtml(work.src)}"
           title="${escapeHtml(work.title)}"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowfullscreen>
         </iframe>`
      : `<video
           controls
           preload="metadata"
           src="${escapeHtml(work.src)}">
         </video>`;

  elements.modalContent.innerHTML = `
    <div class="modal-inner">
      <p class="eyebrow">
        ${escapeHtml([...work.moods, ...worldsFor(work)].join(" · "))}
      </p>

      <h2>${escapeHtml(work.title)}</h2>

      ${work.subtitle ? `<p>${escapeHtml(work.subtitle)}</p>` : ""}

      <p>${escapeHtml(work.description || "")}</p>

      ${
        work.instrumentation.length
          ? `<p class="modal-instrumentation">
               ${escapeHtml(work.instrumentation.join(" · "))}
             </p>`
          : ""
      }

      ${player}
    </div>
  `;

  document.body.classList.add("modal-open");
  elements.modal.showModal();
}

function closeModal() {
  elements.modal.close();
  elements.modalContent.innerHTML = "";
  document.body.classList.remove("modal-open");
}

function setupMotion() {
  if (!window.gsap || !window.ScrollTrigger) {
    setupNativeMotion();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  gsap.from(".hero-content > *", {
    y: 26,
    opacity: 0,
    duration: 0.85,
    ease: "power3.out",
    stagger: 0.09,
    delay: 0.1,
  });

  gsap.to(".hero-image", {
    yPercent: 13,
    scale: 1.13,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
  });

  gsap.to(".hero-content", {
    y: -115,
    opacity: 0.18,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "75% top",
      scrub: 1,
    },
  });

  gsap.to(".scroll-cue", {
    opacity: 0,
    y: 20,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "25% top",
      scrub: true,
    },
  });

  ScrollTrigger.create({
    start: 40,
    onUpdate: (self) => {
      elements.header.classList.toggle(
        "is-scrolled",
        self.scroll() > 40,
      );
    },
  });

  document
    .querySelectorAll(
      ".music-section, .video-section, .about-section, .contact-section",
    )
    .forEach((section) => {
      const targets =
        section.classList.contains("music-section")
          ? []
          : [
              section.querySelector(".eyebrow"),
              section.querySelector("h2"),
            ].filter(Boolean);

      gsap.from(targets, {
        y: 38,
        opacity: 0,
        duration: 0.78,
        ease: "power3.out",
        stagger: 0.09,
        scrollTrigger: {
          trigger: section,
          start: "top 82%",
          once: true,
        },
      });
    });

  if (
    state.mode === "selected" &&
    elements.selectedHeading &&
    !elements.selectedHeading.hidden
  ) {
    gsap.from(
      elements.selectedHeading.querySelectorAll(".eyebrow, h2"),
      {
        y: 38,
        opacity: 0,
        duration: 0.78,
        ease: "power3.out",
        stagger: 0.09,
        clearProps: "transform,opacity",
      },
    );
  }

  animateCards(elements.audioGrid.querySelectorAll(".audio-card"));
  animateCards(elements.videoGrid.querySelectorAll(".video-card"));

  ScrollTrigger.refresh();
}

function setupNativeMotion() {
  window.addEventListener(
    "scroll",
    () => {
      elements.header.classList.toggle(
        "is-scrolled",
        window.scrollY > 40,
      );
    },
    { passive: true },
  );
}

function refreshScrollTrigger() {
  if (window.ScrollTrigger) {
    window.requestAnimationFrame(() => ScrollTrigger.refresh());
  }
}

init().catch((error) => {
  console.error(error);

  elements.audioGrid.innerHTML = `
    <p class="empty-state">
      The music or video data could not be loaded.
      Start the site through a local web server.
    </p>
  `;
});
