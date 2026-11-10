'use strict';

// Research materials and chapter links are unchanged from the original E:UM hub.
const LIBRARY = Object.freeze({
  report: {
    name: '2026학년도 연구학교 운영 보고서',
    pages: 59,
    pdf: 'docs/2026_연구학교_운영_보고서.pdf',
    folder: 'report',
    chapters: [
      ['표지',1], ['연구의 개요',4], ['이론적 배경',8], ['실태 분석 및 연구과제',11],
      ['운영의 설계',14], ['연구과제 실행 결과',17], ['연구 검증 및 일반화',42],
      ['연구 결과 및 제언',50], ['부록',55]
    ]
  },
  cases: {
    name: '교실-삶 이음 서·논술형 평가 사례집',
    pages: 79,
    pdf: 'docs/교실-삶_이음_서논술형_평가_사례집.pdf',
    folder: 'cases',
    chapters: [
      ['표지',1], ['평가 안내',3], ['국어',11], ['영어',22], ['수학',33],
      ['과학',44], ['역사',55], ['사회',66], ['최종 점검표',77]
    ]
  },
  guide: {
    name: '이음 AI 평가도구 설계·활용 안내서',
    pages: 14,
    pdf: 'docs/이음_AI_평가도구_설계_활용_안내서.pdf',
    folder: 'guide',
    chapters: [
      ['표지',1], ['프로그램 소개',2], ['사용 준비',3], ['1단계 성취기준 선택',4],
      ['2단계 성취기준 분석',5], ['3단계 평가요소 선택',6], ['4단계 평가 과제',7],
      ['5단계 질문 구성',8], ['6단계 루브릭',9], ['루브릭 결과 해석',10],
      ['7단계 교사 검토',11], ['최종 점검',12]
    ]
  }
});

const dialog = document.querySelector('#readerDialog');
const titleNode = document.querySelector('#readerTitle');
const pageInput = document.querySelector('#readerPageInput');
const totalNode = document.querySelector('#readerTotal');
const spreadLabel = document.querySelector('#readerSpreadLabel');
const prevButton = document.querySelector('#readerPrev');
const nextButton = document.querySelector('#readerNext');
const prevOverlay = document.querySelector('#pagePrevOverlay');
const nextOverlay = document.querySelector('#pageNextOverlay');
const progress = document.querySelector('#readerProgressFill');
const chaptersNode = document.querySelector('#readerChapters');
const pdfLink = document.querySelector('#readerPdf');
const pdfDownload = document.querySelector('#readerDownload');
const closeButton = document.querySelector('#readerClose');
const book = document.querySelector('#flipbook');
const bookViewport = document.querySelector('#bookViewport');
const bookZoomStage = document.querySelector('#bookZoomStage');
const zoomInButton = document.querySelector('#readerZoomIn');
const zoomOutButton = document.querySelector('#readerZoomOut');
const zoomResetButton = document.querySelector('#readerZoomReset');
const zoomValue = document.querySelector('#readerZoomValue');
const flipSheet = document.querySelector('#flipSheet');
const leftPage = document.querySelector('#readerLeftPage');
const rightPage = document.querySelector('#readerRightPage');
const leftImage = document.querySelector('#readerLeftImage');
const rightImage = document.querySelector('#readerRightImage');
const flipFront = document.querySelector('#flipFrontImage');
const flipBack = document.querySelector('#flipBackImage');
const mobileQuery = window.matchMedia('(max-width: 800px)');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let currentDocId = null;
let currentPage = 1;
let turning = false;
let lastFocus = null;
let viewVersion = 0;
let swipeStart = null;
const preloaded = new Map();

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
let zoom = 1;
let baseBookWidth = 0;
let baseBookHeight = 0;
let resizeRaf = 0;
const pointers = new Map();
let pinchState = null;
let panState = null;
let suppressSwipe = false;

// Keep the book dimensions stable; grow the scrollable stage rather than scaling the whole dialog.
// The same stage supports mouse drag, touch pan and focal-point-preserving pinch zoom.
function zoomClamp(value) {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
}

function zoomButtonState() {
  zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  zoomOutButton.disabled = zoom <= ZOOM_MIN;
  zoomInButton.disabled = zoom >= ZOOM_MAX;
  zoomResetButton.disabled = zoom === 1;
  bookViewport.classList.toggle('is-zoomed', zoom > 1);
}

function centerBookViewport() {
  bookViewport.scrollLeft = (bookViewport.scrollWidth - bookViewport.clientWidth) / 2;
  bookViewport.scrollTop = (bookViewport.scrollHeight - bookViewport.clientHeight) / 2;
}

function setZoom(value, clientX = null, clientY = null) {
  if (!dialog.open || !baseBookWidth || !baseBookHeight) return;
  const nextZoom = zoomClamp(value);
  if (nextZoom === zoom) return;

  // Preserve the content point under the gesture midpoint or cursor.
  const rect = bookViewport.getBoundingClientRect();
  const localX = clientX === null ? bookViewport.clientWidth / 2 : clientX - rect.left;
  const localY = clientY === null ? bookViewport.clientHeight / 2 : clientY - rect.top;
  const oldMidX = bookZoomStage.offsetLeft + bookZoomStage.offsetWidth / 2;
  const oldMidY = bookZoomStage.offsetTop + bookZoomStage.offsetHeight / 2;
  const worldX = (bookViewport.scrollLeft + localX - oldMidX) / zoom;
  const worldY = (bookViewport.scrollTop + localY - oldMidY) / zoom;
  zoom = nextZoom;
  layoutZoomStage();
  const newMidX = bookZoomStage.offsetLeft + bookZoomStage.offsetWidth / 2;
  const newMidY = bookZoomStage.offsetTop + bookZoomStage.offsetHeight / 2;
  bookViewport.scrollLeft = newMidX + worldX * zoom - localX;
  bookViewport.scrollTop = newMidY + worldY * zoom - localY;
}

function layoutZoomStage() {
  if (!baseBookWidth || !baseBookHeight) return;
  const availableWidth = bookViewport.clientWidth - (mobileQuery.matches ? 14 : 28);
  const availableHeight = bookViewport.clientHeight;
  const width = Math.max(availableWidth, baseBookWidth * zoom + 28);
  const height = Math.max(availableHeight, baseBookHeight * zoom + 28);
  bookZoomStage.style.width = `${Math.ceil(width)}px`;
  bookZoomStage.style.height = `${Math.ceil(height)}px`;
  book.style.width = `${baseBookWidth}px`;
  book.style.height = `${baseBookHeight}px`;
  book.style.maxHeight = 'none';
  book.style.transform = `scale(${zoom})`;
  zoomButtonState();
}

function measureAndLayoutZoom() {
  if (!dialog.open || !currentDocId) return;
  const retainedZoom = zoom;
  book.style.width = '';
  book.style.height = '';
  book.style.maxHeight = '';
  book.style.transform = '';
  bookZoomStage.style.width = '';
  bookZoomStage.style.height = '';
  // Account for the new zoom toolbar; the book must fit inside its canvas at 100%.
  const naturalWidth = book.offsetWidth;
  const naturalRatio = mobileQuery.matches ? 595 / 841 : 1190 / 841;
  baseBookWidth = Math.floor(Math.min(
    naturalWidth,
    bookViewport.clientWidth - 30,
    (bookViewport.clientHeight - 18) * naturalRatio
  ));
  baseBookWidth = Math.max(40, baseBookWidth);
  baseBookHeight = baseBookWidth / naturalRatio;
  zoom = retainedZoom;
  layoutZoomStage();
  centerBookViewport();
}

function resetZoom() { setZoom(1); centerBookViewport(); }

function pageSrc(docId, page) {
  if (!docId || !Number.isInteger(page) || page < 1 || page > LIBRARY[docId].pages) return null;
  return `pages/${LIBRARY[docId].folder}/${String(page).padStart(3, '0')}.webp`;
}

function clampPage(value) {
  if (!currentDocId) return 1;
  return Math.min(LIBRARY[currentDocId].pages, Math.max(1, Math.floor(Number(value) || 1)));
}

function layoutFor(page) {
  const total = LIBRARY[currentDocId].pages;
  if (mobileQuery.matches) {
    return { mobile: true, spread: null, left: null, right: Math.min(total, Math.max(1, page)) };
  }
  const spread = page <= 1 ? 0 : Math.floor(page / 2);
  return {
    mobile: false,
    spread,
    left: spread === 0 ? null : spread * 2,
    right: spread * 2 + 1 <= total ? spread * 2 + 1 : null
  };
}

function lastSpread() {
  return Math.ceil((LIBRARY[currentDocId].pages - 1) / 2);
}

function stepTarget(direction) {
  if (!currentDocId) return null;
  if (mobileQuery.matches) {
    const target = currentPage + direction;
    return target < 1 || target > LIBRARY[currentDocId].pages ? null : target;
  }
  const target = layoutFor(currentPage).spread + direction;
  if (target < 0 || target > lastSpread()) return null;
  return target * 2 + 1 <= LIBRARY[currentDocId].pages ? target * 2 + 1 : target * 2;
}

function setPage(node, image, page) {
  const path = pageSrc(currentDocId, page);
  node.classList.toggle('is-blank', !path);
  image.hidden = !path;
  if (!path) {
    image.removeAttribute('src');
    image.alt = '';
    return;
  }
  if (image.getAttribute('src') !== path) image.src = path;
  image.alt = `${LIBRARY[currentDocId].name} ${page}쪽`;
}

function showPages(page) {
  const view = layoutFor(page);
  book.classList.toggle('is-single', view.mobile);
  book.classList.toggle('is-spread', !view.mobile);
  setPage(leftPage, leftImage, view.left);
  setPage(rightPage, rightImage, view.right);
  book.setAttribute('aria-label', view.mobile
    ? `${LIBRARY[currentDocId].name}, ${view.right}쪽`
    : `${LIBRARY[currentDocId].name}, ${[view.left, view.right].filter(Boolean).join('~')}쪽 펼침`);
}

function warmImage(page, docId = currentDocId) {
  const path = pageSrc(docId, page);
  if (!path) return Promise.resolve();
  if (preloaded.has(path)) return preloaded.get(path);
  const loader = new Image();
  const ready = new Promise((resolve) => {
    loader.onload = resolve;
    loader.onerror = resolve; // An unavailable image must never make the viewer unresponsive.
  });
  preloaded.set(path, ready);
  loader.src = path;
  // Retain only the most recent preload entries to avoid unbounded memory use.
  if (preloaded.size > 28) preloaded.delete(preloaded.keys().next().value);
  return ready;
}

function warmNeighbors() {
  if (!currentDocId) return;
  const ids = [currentPage, currentPage - 1, currentPage + 1, currentPage - 2, currentPage + 2, currentPage + 3];
  ids.forEach((page) => void warmImage(page));
}

function updateNavigation() {
  const doc = LIBRARY[currentDocId];
  if (!doc) return;
  const view = layoutFor(currentPage);
  pageInput.value = String(currentPage);
  pageInput.max = String(doc.pages);
  totalNode.textContent = `/ ${doc.pages}`;
  const previousAvailable = stepTarget(-1) !== null;
  const nextAvailable = stepTarget(1) !== null;
  prevButton.disabled = prevOverlay.disabled = !previousAvailable;
  nextButton.disabled = nextOverlay.disabled = !nextAvailable;
  if (view.mobile) spreadLabel.textContent = '한 쪽 보기';
  else if (view.left && view.right) spreadLabel.textContent = `${view.left}~${view.right}쪽 펼침`;
  else if (view.right) spreadLabel.textContent = '표지';
  else spreadLabel.textContent = `${view.left}쪽`;
  const lastVisible = Math.max(view.left || 0, view.right || 0);
  progress.style.width = `${(lastVisible / doc.pages) * 100}%`;
  pdfLink.href = `${doc.pdf}#page=${currentPage}`;
  chaptersNode.querySelectorAll('button.chapter-button').forEach((button) => {
    const chapterPage = Number(button.dataset.page);
    const later = doc.chapters.some(([, start]) => start > chapterPage && start <= currentPage);
    const active = chapterPage <= currentPage && !later;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
}

function commitPage(page) {
  if (!currentDocId) return;
  currentPage = clampPage(page);
  showPages(currentPage);
  updateNavigation();
  warmNeighbors();
}

function endFlip() {
  flipSheet.classList.remove('is-flipping', 'turn-next', 'turn-prev');
  flipSheet.removeAttribute('data-direction');
  book.removeAttribute('aria-busy');
}

async function animateStep(direction) {
  if (!currentDocId || turning) return;
  const target = stepTarget(direction);
  if (target === null) return;
  if (reducedMotionQuery.matches) { commitPage(target); return; }

  const token = ++viewVersion;
  const docId = currentDocId;
  turning = true;
  book.setAttribute('aria-busy', 'true');
  const oldView = layoutFor(currentPage);
  const newView = layoutFor(target);
  const front = oldView.mobile ? currentPage : (direction > 0 ? oldView.right : oldView.left);
  const back = oldView.mobile ? target : (direction > 0 ? newView.left : newView.right);
  const needed = [front, back, newView.left, newView.right].filter(Boolean);

  // Preload both sides before turning so there is no blank flash mid-animation.
  await Promise.all(needed.map((page) => warmImage(page, docId)));
  if (token !== viewVersion || docId !== currentDocId || !dialog.open) return;

  // For the forward animation the right page beneath the sheet is the upcoming right page.
  // For the reverse animation the left page beneath is the preceding left page.
  if (oldView.mobile) {
    setPage(rightPage, rightImage, newView.right);
  } else if (direction > 0) {
    setPage(rightPage, rightImage, newView.right);
  } else {
    setPage(leftPage, leftImage, newView.left);
  }
  setPage(flipSheet.querySelector('.flip-sheet-front'), flipFront, front);
  setPage(flipSheet.querySelector('.flip-sheet-back'), flipBack, back);
  flipSheet.dataset.direction = direction > 0 ? 'next' : 'prev';

  // Animation completion event plus a timeout fallback for browsers that suppress it.
  await new Promise((resolve) => {
    let done = false;
    let timer;
    function finish() {
      if (done) return;
      done = true;
      flipSheet.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
      resolve();
    }
    function onEnd(event) {
      if (event.target === flipSheet) finish();
    }
    flipSheet.addEventListener('animationend', onEnd);
    void flipSheet.offsetWidth;
    flipSheet.classList.add('is-flipping', direction > 0 ? 'turn-next' : 'turn-prev');
    timer = setTimeout(finish, 1000);
  });

  if (token !== viewVersion || docId !== currentDocId || !dialog.open) return;
  endFlip();
  turning = false;
  commitPage(target);
  if (zoom > 1) centerBookViewport();
}

function jumpTo(page) {
  if (!currentDocId) return;
  ++viewVersion;
  endFlip();
  turning = false;
  commitPage(page);
  if (zoom > 1) centerBookViewport();
}

function populateChapters(doc) {
  chaptersNode.replaceChildren();
  doc.chapters.forEach(([label, page]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.dataset.page = String(page);
    const heading = document.createElement('span');
    heading.textContent = label;
    const count = document.createElement('span');
    count.textContent = `${page}쪽`;
    button.append(heading, count);
    button.addEventListener('click', () => jumpTo(page));
    chaptersNode.appendChild(button);
  });
}

function openBook(docId, page = 1) {
  const doc = LIBRARY[docId];
  if (!doc) return;
  ++viewVersion;
  turning = false;
  endFlip();
  currentDocId = docId;
  lastFocus = document.activeElement;
  titleNode.textContent = doc.name;
  pdfLink.href = doc.pdf;
  pdfDownload.href = doc.pdf;
  populateChapters(doc);
  commitPage(page);
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = 'hidden';
  zoom = 1;
  // Wait for the opened dialog to have its final dimensions before measuring the book.
  requestAnimationFrame(() => { if (dialog.open && currentDocId === docId) measureAndLayoutZoom(); });
  closeButton.focus();
}

function closeBook() { if (dialog.open) dialog.close(); }

document.querySelectorAll('[data-open-book]').forEach((button) => {
  button.addEventListener('click', () => openBook(button.dataset.openBook));
});
closeButton.addEventListener('click', closeBook);
prevButton.addEventListener('click', () => void animateStep(-1));
nextButton.addEventListener('click', () => void animateStep(1));
prevOverlay.addEventListener('click', () => void animateStep(-1));
nextOverlay.addEventListener('click', () => void animateStep(1));
zoomInButton.addEventListener('click', () => setZoom(zoom + ZOOM_STEP));
zoomOutButton.addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
zoomResetButton.addEventListener('click', resetZoom);
bookViewport.addEventListener('dblclick', (event) => {
  if (turning || !currentDocId) return;
  if (zoom <= 1) setZoom(2, event.clientX, event.clientY);
  else resetZoom();
});
// Wheel zoom only with Ctrl/Cmd and only inside the book; ordinary scrolling remains available.
bookViewport.addEventListener('wheel', (event) => {
  if (!dialog.open || !event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
}, { passive: false });

pageInput.addEventListener('change', () => jumpTo(pageInput.value));
pageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    jumpTo(pageInput.value);
    pageInput.blur();
  }
});

document.addEventListener('keydown', (event) => {
  if (!dialog.open || !currentDocId) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.altKey) return;
  // +, -, 0 (also Ctrl/Cmd combinations) operate on the e-book, not browser zoom.
  if (event.key === '+' || event.key === '=' || event.key === 'Add') {
    event.preventDefault(); setZoom(zoom + ZOOM_STEP); return;
  }
  if (event.key === '-' || event.key === '_' || event.key === 'Subtract') {
    event.preventDefault(); setZoom(zoom - ZOOM_STEP); return;
  }
  if (event.key === '0' || event.key === 'Numpad0') {
    event.preventDefault(); resetZoom(); return;
  }
  // Arrow keys pan while magnified; navigation buttons remain available for page changes.
  if (zoom > 1) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); bookViewport.scrollLeft += event.key === 'ArrowRight' ? 160 : -160; return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); bookViewport.scrollTop += event.key === 'ArrowDown' ? 160 : -160; return;
    }
  } else {
    if (event.key === 'ArrowRight') { event.preventDefault(); void animateStep(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); void animateStep(-1); }
  }
});

// Horizontal drag and swipe to turn a sheet; natural page scrolling remains available.
book.addEventListener('pointerdown', (event) => {
  if (!currentDocId || turning || event.button !== 0 || zoom > 1 || pointers.size > 0) return;
  swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
});
book.addEventListener('pointerup', (event) => {
  if (zoom > 1 || suppressSwipe || pointers.size > 1) { swipeStart = null; return; }
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    void animateStep(dx < 0 ? 1 : -1);
  }
});
book.addEventListener('pointercancel', () => { swipeStart = null; });

// Two-finger pinch on touchscreens. A single pointer pans when magnified.
bookViewport.addEventListener('pointerdown', (event) => {
  if (!dialog.open || turning || !currentDocId || event.button !== 0) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()].slice(0, 2);
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    pinchState = { dist: Math.max(1, dist), scale: zoom };
    panState = null;
    suppressSwipe = true;
    swipeStart = null;
  } else if (zoom > 1) {
    panState = { id: event.pointerId, x: event.clientX, y: event.clientY,
      scrollLeft: bookViewport.scrollLeft, scrollTop: bookViewport.scrollTop };
    if (bookViewport.setPointerCapture) {
      try { bookViewport.setPointerCapture(event.pointerId); } catch { /* Pointer no longer active. */ }
    }
  }
});
bookViewport.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2 && pinchState) {
    event.preventDefault();
    const [a, b] = [...pointers.values()].slice(0, 2);
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    setZoom(pinchState.scale * dist / pinchState.dist, midX, midY);
  } else if (zoom > 1 && panState && panState.id === event.pointerId && !pinchState) {
    event.preventDefault();
    bookViewport.scrollLeft = panState.scrollLeft - (event.clientX - panState.x);
    bookViewport.scrollTop = panState.scrollTop - (event.clientY - panState.y);
  }
});
function releaseReaderPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchState = null;
  if (pointers.size === 0) { panState = null; suppressSwipe = false; swipeStart = null; }
  if (panState?.id === event.pointerId) panState = null;
}
bookViewport.addEventListener('pointerup', releaseReaderPointer);
bookViewport.addEventListener('pointercancel', releaseReaderPointer);
bookViewport.addEventListener('lostpointercapture', releaseReaderPointer);
// A drag can finish over the sidebar or outside the reader surface.
// Clear its state after the normal book/viewport handlers have received the release.
window.addEventListener('pointerup', releaseReaderPointer);
window.addEventListener('pointercancel', releaseReaderPointer);
window.addEventListener('blur', () => {
  pointers.clear();
  pinchState = null;
  panState = null;
  suppressSwipe = false;
  swipeStart = null;
});

mobileQuery.addEventListener('change', () => {
  if (dialog.open && currentDocId) {
    jumpTo(currentPage);
    requestAnimationFrame(measureAndLayoutZoom);
  }
});
window.addEventListener('resize', () => {
  if (!dialog.open || !currentDocId) return;
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(measureAndLayoutZoom);
});
dialog.addEventListener('close', () => {
  ++viewVersion;
  endFlip();
  turning = false;
  swipeStart = null;
  pointers.clear();
  pinchState = null;
  panState = null;
  suppressSwipe = false;
  zoom = 1;
  baseBookWidth = 0;
  baseBookHeight = 0;
  cancelAnimationFrame(resizeRaf);
  book.style.transform = book.style.width = book.style.height = book.style.maxHeight = '';
  bookZoomStage.style.width = bookZoomStage.style.height = '';
  zoomButtonState();
  currentDocId = null;
  document.body.style.overflow = '';
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeBook();
});
[rightImage, leftImage].forEach((image) => {
  image.addEventListener('error', () => {
    image.alt = '페이지 이미지를 불러오지 못했습니다. PDF로 보기 버튼을 이용해 주세요.';
  });
});

// Existing deep links such as ?book=cases&page=55 remain supported.
const startParams = new URLSearchParams(window.location.search);
const startBook = startParams.get('book');
if (startBook && LIBRARY[startBook]) {
  window.addEventListener('load', () => openBook(startBook, startParams.get('page') || 1), { once: true });
}
