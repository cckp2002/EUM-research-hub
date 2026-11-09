'use strict';

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
const pageImage = document.querySelector('#readerImage');
const pageFrame = document.querySelector('#bookPage');
const pageInput = document.querySelector('#readerPageInput');
const totalNode = document.querySelector('#readerTotal');
const prevButton = document.querySelector('#readerPrev');
const nextButton = document.querySelector('#readerNext');
const prevOverlay = document.querySelector('#pagePrevOverlay');
const nextOverlay = document.querySelector('#pageNextOverlay');
const progress = document.querySelector('#readerProgressFill');
const chaptersNode = document.querySelector('#readerChapters');
const pdfLink = document.querySelector('#readerPdf');
const pdfDownload = document.querySelector('#readerDownload');
const closeButton = document.querySelector('#readerClose');
let currentDocId = null;
let currentPage = 1;
let turning = false;
let lastFocus = null;
let turnTimer = null;

function pageSrc(docId, page) {
  const number = String(page).padStart(3, '0');
  return `pages/${LIBRARY[docId].folder}/${number}.webp`;
}

function clampPage(value) {
  if (!currentDocId) return 1;
  return Math.min(LIBRARY[currentDocId].pages, Math.max(1, Math.floor(Number(value) || 1)));
}

function updateNavigation() {
  const doc = LIBRARY[currentDocId];
  if (!doc) return;
  pageInput.value = String(currentPage);
  pageInput.max = String(doc.pages);
  totalNode.textContent = `/ ${doc.pages}`;
  prevButton.disabled = prevOverlay.disabled = currentPage <= 1;
  nextButton.disabled = nextOverlay.disabled = currentPage >= doc.pages;
  progress.style.width = `${(currentPage / doc.pages) * 100}%`;
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

function loadPage(page) {
  if (!currentDocId) return;
  currentPage = clampPage(page);
  const doc = LIBRARY[currentDocId];
  pageImage.src = pageSrc(currentDocId, currentPage);
  pageImage.alt = `${doc.name}, 전체 ${doc.pages}쪽 중 ${currentPage}쪽`;
  updateNavigation();
  [currentPage - 1, currentPage + 1].forEach((next) => {
    if (next >= 1 && next <= doc.pages) {
      const img = new Image();
      img.src = pageSrc(currentDocId, next);
    }
  });
}

function navigate(page, animate = true) {
  if (!currentDocId || turning) return;
  const requested = clampPage(page);
  if (requested === currentPage) return;
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    loadPage(requested);
    return;
  }
  turning = true;
  pageFrame.classList.remove('turn-next', 'turn-prev');
  void pageFrame.offsetWidth;
  pageFrame.classList.add(requested > currentPage ? 'turn-next' : 'turn-prev');
  turnTimer = window.setTimeout(() => {
    loadPage(requested);
    pageFrame.classList.remove('turn-next', 'turn-prev');
    turning = false;
    turnTimer = null;
  }, 240);
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
    button.addEventListener('click', () => navigate(page, false));
    chaptersNode.appendChild(button);
  });
}

function openBook(docId, page = 1) {
  const doc = LIBRARY[docId];
  if (!doc) return;
  if (turnTimer) window.clearTimeout(turnTimer);
  turnTimer = null;
  turning = false;
  pageFrame.classList.remove('turn-next', 'turn-prev');
  currentDocId = docId;
  lastFocus = document.activeElement;
  titleNode.textContent = doc.name;
  pdfLink.href = doc.pdf;
  pdfDownload.href = doc.pdf;
  populateChapters(doc);
  loadPage(page);
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = 'hidden';
  closeButton.focus();
}

function closeBook() {
  if (dialog.open) dialog.close();
}

document.querySelectorAll('[data-open-book]').forEach((button) => {
  button.addEventListener('click', () => openBook(button.dataset.openBook));
});

closeButton.addEventListener('click', closeBook);
prevButton.addEventListener('click', () => navigate(currentPage - 1));
nextButton.addEventListener('click', () => navigate(currentPage + 1));
prevOverlay.addEventListener('click', () => navigate(currentPage - 1));
nextOverlay.addEventListener('click', () => navigate(currentPage + 1));
pageInput.addEventListener('change', () => navigate(pageInput.value, false));
pageInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    navigate(pageInput.value, false);
    pageInput.blur();
  }
});

document.addEventListener('keydown', (ev) => {
  if (!dialog.open || !currentDocId) return;
  if (ev.target instanceof HTMLInputElement) return;
  if (ev.key === 'ArrowRight') { ev.preventDefault(); navigate(currentPage + 1); }
  if (ev.key === 'ArrowLeft') { ev.preventDefault(); navigate(currentPage - 1); }
});

dialog.addEventListener('close', () => {
  if (turnTimer) window.clearTimeout(turnTimer);
  turnTimer = null;
  turning = false;
  currentDocId = null;
  document.body.style.overflow = '';
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeBook();
});

pageImage.addEventListener('error', () => {
  pageImage.alt = '페이지 이미지를 불러오지 못했습니다. PDF로 보기 버튼을 이용해 주세요.';
});

// Printable or shareable deep links such as ?book=cases&page=55 are supported.
const startParams = new URLSearchParams(window.location.search);
const startBook = startParams.get('book');
if (startBook && LIBRARY[startBook]) {
  window.addEventListener('load', () => openBook(startBook, startParams.get('page') || 1), { once: true });
}
