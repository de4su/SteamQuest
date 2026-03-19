import { useEffect, useRef, useCallback } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

function buildTourOptions(): Shepherd.Tour.TourOptions {
  return {
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 8,
      modalOverlayOpeningRadius: 8,
    },
  };
}

function gifStep(opts: {
  id: string;
  title: string;
  attachTo?: Shepherd.Step.StepOptionsAttachTo;
  text: string;
  gifSrc: string;
  gifAlt: string;
  gifWidth: number;
  gifHeight: number;
  buttons: Shepherd.Step.StepOptionsButton[];
}): Shepherd.Step.StepOptions {
  const img = `<img
    src="${opts.gifSrc}"
    alt="${opts.gifAlt}"
    width="${opts.gifWidth}"
    height="${opts.gifHeight}"
    style="
      display:block;
      width:100%;
      height:auto;
      border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5),0 2px 8px rgba(102,192,244,0.15);
      margin:12px auto 0;
      animation:shepherdGifFadeIn 0.4s ease;
    "
  />`;

  return {
    id: opts.id,
    title: opts.title,
    ...(opts.attachTo ? { attachTo: opts.attachTo } : {}),
    text: `${opts.text}${img}`,
    buttons: opts.buttons,
  };
}

export function useTours() {
  const tourRef = useRef<Shepherd.Tour | null>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shepherdGifFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .shepherd-element {
        position: fixed !important;
        bottom: 96px !important;
        right: 24px !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
        max-width: 520px !important;
        width: calc(100vw - 48px) !important;
        font-family: inherit;
      }
      .shepherd-arrow {
        display: none !important;
      }
      .shepherd-header {
        background: #1b2838 !important;
        border-bottom: 1px solid rgba(102,192,244,0.2) !important;
        padding: 14px 18px !important;
        border-radius: 12px 12px 0 0 !important;
      }
      .shepherd-title {
        color: #66c0f4 !important;
        font-weight: 900 !important;
        font-size: 1rem !important;
        letter-spacing: 0.05em !important;
        text-transform: uppercase !important;
      }
      .shepherd-text {
        background: #171a21 !important;
        color: #c7d5e0 !important;
        padding: 16px 18px !important;
        font-size: 0.875rem !important;
        line-height: 1.6 !important;
      }
      .shepherd-footer {
        background: #1b2838 !important;
        border-top: 1px solid rgba(102,192,244,0.15) !important;
        padding: 12px 18px !important;
        border-radius: 0 0 12px 12px !important;
        display: flex !important;
        gap: 8px !important;
        justify-content: flex-end !important;
      }
      .shepherd-button {
        border-radius: 99px !important;
        font-weight: 900 !important;
        font-size: 0.75rem !important;
        letter-spacing: 0.08em !important;
        text-transform: uppercase !important;
        padding: 8px 20px !important;
        border: none !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
      }
      .shepherd-button-primary {
        background: #66c0f4 !important;
        color: #0d1117 !important;
      }
      .shepherd-button-primary:hover {
        background: #00d2ff !important;
      }
      .shepherd-button-secondary {
        background: transparent !important;
        color: #8f98a0 !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
      }
      .shepherd-button-secondary:hover {
        color: #fff !important;
        border-color: rgba(255,255,255,0.3) !important;
      }
      .shepherd-element,
      .shepherd-content {
        border-radius: 12px !important;
        border: 1px solid rgba(102,192,244,0.2) !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6) !important;
        overflow: hidden !important;
      }
      .shepherd-modal-overlay-container {
        opacity: 0.85 !important;
      }
      .shepherd-cancel-icon {
        color: #8f98a0 !important;
      }
      .shepherd-cancel-icon:hover {
        color: #fff !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const startTour = useCallback(() => {
    tourRef.current?.cancel();
    const tour = new Shepherd.Tour(buildTourOptions());

    tour.addStep(gifStep({
      id: 'quiz',
      title: 'Quiz',
      attachTo: { element: '[data-tour="quiz-start"]', on: 'bottom' },
      text: `<ul style="margin:0;padding-left:1.2em;line-height:2">
        <li>Start a quiz to get personalized game recommendations</li>
        <li>View your results with match scores for each game</li>
        <li>Track your quiz history in your profile</li>
      </ul>`,
      gifSrc: '/gifs/quiz-demo.gif',
      gifAlt: 'Quiz in action',
      gifWidth: 800,
      gifHeight: 600,
      buttons: [
        { text: 'Close', classes: 'shepherd-button-secondary', action: () => tour.cancel() },
        { text: 'Next', classes: 'shepherd-button-primary', action: () => tour.next() },
      ],
    }));

    tour.addStep(gifStep({
      id: 'search',
      title: 'Search',
      attachTo: { element: '[data-tour="search"]', on: 'bottom' },
      text: `<ul style="margin:0;padding-left:1.2em;line-height:2">
        <li>Filter games by difficulty and other criteria</li>
        <li>Search by keyword, developer, or publisher</li>
        <li>Save your favorite games for later</li>
      </ul>`,
      gifSrc: '/gifs/search-demo.gif',
      gifAlt: 'Search in action',
      gifWidth: 800,
      gifHeight: 600,
      buttons: [
        { text: 'Back', classes: 'shepherd-button-secondary', action: () => tour.back() },
        { text: 'Next', classes: 'shepherd-button-primary', action: () => tour.next() },
      ],
    }));

    tour.addStep(gifStep({
      id: 'profile',
      title: 'Profile',
      attachTo: { element: '[data-tour="profile"]', on: 'bottom' },
      text: `<ul style="margin:0;padding-left:1.2em;line-height:2">
        <li>View your completed quizzes and results</li>
        <li>Export your quiz results as a PNG card</li>
        <li>See favorites saved from search and quiz results</li>
        <li>View your Steam statistics and playtime</li>
      </ul>`,
      gifSrc: '/gifs/steam-signin-demo.gif',
      gifAlt: 'Profile and Steam features',
      gifWidth: 800,
      gifHeight: 600,
      buttons: [
        { text: 'Back', classes: 'shepherd-button-secondary', action: () => tour.back() },
        { text: 'Done', classes: 'shepherd-button-primary', action: () => tour.complete() },
      ],
    }));

    tourRef.current = tour;
    tour.start();
  }, []);

  useEffect(() => {
    return () => {
      tourRef.current?.cancel();
    };
  }, []);

  return { startTour };
}
