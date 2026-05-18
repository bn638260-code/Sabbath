export type Faq = { question: string; answer: string };

export const FAQS: readonly Faq[] = [
  {
    question: "What is SabbathCue?",
    answer:
      "SabbathCue is a free, open-source desktop app that detects Bible verses in real time from live sermon audio. It listens to a sermon feed, transcribes speech as it happens, identifies scripture references — including paraphrased quotations — and renders broadcast-ready overlays via NDI for OBS, vMix, and other live production tools. SabbathCue is built with Tauri v2, a React frontend, and a Rust backend.",
  },
  {
    question: "Does SabbathCue work during live sermons?",
    answer:
      "Yes. SabbathCue is built specifically for live services and processes spoken words in real time, typically displaying referenced scriptures within seconds without interrupting the flow of the service.",
  },
  {
    question: "What equipment do I need to run SabbathCue?",
    answer:
      "You need a computer running Windows or macOS with an internet connection, an audio feed from your sound system, and a projector or display screen. SabbathCue works with your existing audio setup — no specialized hardware required.",
  },
  {
    question: "What Bible translations does SabbathCue support?",
    answer:
      "SabbathCue supports KJV, ESV, NIV, NKJV, NLT, and more. You can switch between translations on-the-fly from the operator panel, and each translation is stored locally in your app database for offline use.",
  },
  {
    question: "How do I get started with SabbathCue?",
    answer:
      "Download the free desktop app for Windows or macOS, connect your audio feed, and you're ready to go. Most teams are running in under five minutes. Full setup instructions and documentation are available in-app and on the GitHub repository.",
  },
  {
    question: "What happens if the pastor paraphrases a verse?",
    answer:
      "SabbathCue is trained to recognize paraphrased scripture references, not just exact quotations, allowing it to surface the intended Bible passage even when the wording differs from the source translation.",
  },
  {
    question: "Do we still need a projection or media operator?",
    answer:
      "Yes, but their role becomes simpler. Instead of manually searching and switching verses, media operators focus on visuals, livestreams, and overall service quality while SabbathCue handles scripture projection automatically.",
  },
  {
    question: "Is SabbathCue difficult to set up or use?",
    answer:
      "No. SabbathCue is designed for church teams of all technical skill levels. Setup is straightforward, and once running, it operates automatically with minimal interaction during services.",
  },
  {
    question: "How much does SabbathCue cost?",
    answer:
      "SabbathCue is completely free and open source. There is no subscription, no account required, and no usage limits. The full source code is available on GitHub.",
  },
  {
    question: "Does SabbathCue work with OBS Studio and vMix?",
    answer:
      "Yes. SabbathCue outputs broadcast-ready overlays via NDI, which integrates natively with OBS Studio, vMix, and other professional live production software.",
  },
];
