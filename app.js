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
}

function jumpTo(page) {
  if (!currentDocId) return;
  ++viewVersion;
  endFlip();
  turning = false;
  commitPage(page);
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
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); void animateStep(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); void animateStep(-1); }
});

// Horizontal drag and swipe to turn a sheet; natural page scrolling remains available.
book.addEventListener('pointerdown', (event) => {
  if (!currentDocId || turning || event.button !== 0) return;
  swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
});
book.addEventListener('pointerup', (event) => {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    void animateStep(dx < 0 ? 1 : -1);
  }
});
book.addEventListener('pointercancel', () => { swipeStart = null; });

mobileQuery.addEventListener('change', () => {
  if (dialog.open && currentDocId) jumpTo(currentPage);
});
dialog.addEventListener('close', () => {
  ++viewVersion;
  endFlip();
  turning = false;
  swipeStart = null;
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
