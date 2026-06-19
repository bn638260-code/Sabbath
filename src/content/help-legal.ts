import packageJson from "../../package.json"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"

export const HELP_LEGAL_CREATOR = "Fanelesibonge Ndlovu"
export const HELP_LEGAL_COPYRIGHT_HOLDER = HELP_LEGAL_CREATOR
export const HELP_LEGAL_APP_VERSION = packageJson.version

/** Update this when the Terms and Conditions text materially changes. */
export const HELP_LEGAL_TERMS_LAST_UPDATED = "10 June 2026"

export const HELP_LEGAL_AGREEMENT_NOTICE =
  `By downloading, installing, launching, or continuing to use ${APP_DISPLAY_NAME}, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions and the Copyright notice below. If you do not agree, do not install or use the application.`

export const HELP_GUIDE_SECTIONS = [
  {
    title: "Getting started",
    items: [
      "Open Live Desk to run real-time verse detection during a sermon or Bible study.",
      "Choose your microphone and speech engine under System Settings > Speech Recognition.",
      "Use Vosk for fully offline transcription, or Deepgram / Gladia when you have a stable internet connection and API key.",
      "Detected Bible, hymn, and Ellen White matches appear in Recent detections. Auto mode can queue and present high-confidence matches; Manual mode waits for you.",
    ],
  },
  {
    title: "Core workspaces",
    items: [
      "Live Desk - transcript, preview, live output, recent detections, queue, and manual search.",
      "Run Service Flow - step through a prepared service plan during worship.",
      "Service Schedules - build service-plan items and attach sermon slides or media before worship.",
      "Broadcast Control - configure NDI, projector windows, themes, and live presentation.",
      "SDA Hymns Search - find hymns, build lyric slides, and send them live.",
      "Church Library - manage themes, images, songs, slide templates, and media assets.",
    ],
  },
  {
    title: "Speech recognition",
    items: [
      "Offline (Vosk): audio stays on your computer. No per-minute cloud fees. Requires the bundled speech model.",
      "Online (Deepgram): strong live transcription for noisy rooms. Requires your own API key and an active internet connection.",
      "Online (Gladia): streams audio through Gladia Solaria-1 for live transcription. Requires your own API key and an active internet connection.",
      "The transcript feeds Bible references, Ellen White paragraph references, hymns, sermon-slide voice commands, and reading-mode advances.",
    ],
  },
  {
    title: "Transcription do's and don'ts",
    items: [
      "Do choose the cleanest microphone input and test levels before the service starts.",
      "Do restart transcription after changing the microphone, speech provider, or API key.",
      "Do speak naturally, but say references clearly when you want detection to lock on.",
      "Don't place the microphone where speakers or room echo feed back into it.",
      "Don't switch between Vosk, Deepgram, and Gladia mid-service without a quick test.",
      "Don't expect cloud transcription to work without internet access and the matching API key.",
    ],
  },
  {
    title: "Auto detection do's and don'ts",
    items: [
      "Do enable Auto mode only when you are comfortable with high-confidence matches going to live output.",
      "Do keep the Auto-live threshold near the default 80% unless your room needs a stricter or looser setting.",
      "Do say Ellen White references as book, chapter, and paragraph, for example 'Patriarchs and Prophets chapter one paragraph two'.",
      "Do use Manual mode for important services where every slide must be reviewed before display.",
      "Don't expect semantic suggestions below the Auto-live threshold to go live; they stay visible for review.",
      "Don't leave stale suggestions in the box during a new topic; Recent detections auto-clear after 10 seconds and can be cleared manually.",
      "Don't treat automatic detections as final authority; verify the reference before relying on it publicly.",
    ],
  },
  {
    title: "Broadcast & presentation",
    items: [
      "Configure outputs in Broadcast Control and System Settings > Broadcast Settings.",
      "Use themes and display modes to match your church's visual style.",
      "Find hymnal lyrics and custom song slides in SDA Hymns Search, then present them from the hymn deck in Run Service Flow.",
      "Attach sermon slides in Service Schedules, then present them from Run Service Flow.",
      "Test your output on a secondary monitor or NDI receiver before going live.",
    ],
  },
  {
    title: "Tips & troubleshooting",
    items: [
      "Restart the interactive tutorial from System Settings > Help if you need a refresher.",
      "If offline speech fails, confirm the Vosk model is installed and your microphone is selected.",
      "If cloud speech fails, confirm the selected provider has its API key saved and the network is stable.",
      "If an Ellen White reference detects but does not present automatically, confirm Auto mode is on and the detection is at or above the Auto-live threshold.",
      "Keep your Bible database and embeddings up to date when preparing a new release build.",
      "Save service plans regularly - they are stored locally on your machine.",
    ],
  },
] as const

export const TERMS_SECTIONS = [
  {
    title: "1. Agreement to terms",
    body: `These Terms and Conditions ("Terms") form a binding agreement between you ("User", "you") and ${HELP_LEGAL_CREATOR} ("Licensor", "we", "us") governing your access to and use of ${APP_DISPLAY_NAME} ("the Software", "the App"). Installing, copying, or using the App constitutes your acceptance of these Terms.`,
  },
  {
    title: "2. Licence grant",
    body: `We grant you a limited, non-exclusive, non-transferable, revocable licence to install and use the App for lawful personal, ministry, and congregational purposes. You may not sell, rent, lease, sublicense, reverse engineer, decompile, or create derivative works of the App except where applicable law expressly permits.`,
  },
  {
    title: "3. Intellectual property",
    body: `The App — including its name, logo, user interface, source code, compiled binaries, documentation, and original creative assets — is owned by ${HELP_LEGAL_COPYRIGHT_HOLDER} and protected by copyright and other intellectual-property laws. Third-party components remain the property of their respective owners and are used under their own licences.`,
  },
  {
    title: "4. Bible and religious content",
    body: `Scripture text, translations, hymnals, and reference materials made available through the App may be subject to separate copyright or licensing terms held by their publishers. ${APP_DISPLAY_NAME} is a presentation and detection tool; it does not grant you any rights to redistribute copyrighted Bible translations or hymn content beyond what those publishers allow. You are responsible for ensuring your use complies with applicable translation licences in your region.`,
  },
  {
    title: "5. Third-party services",
    body: `Optional cloud speech recognition and other online services require separate accounts, API keys, and data processing by third parties. Your use of those services is governed by their terms and privacy policies. We are not responsible for outages, pricing changes, or data handling by third-party providers.`,
  },
  {
    title: "6. User responsibilities",
    body: `You are responsible for: (a) the accuracy of verses and lyrics you display to a congregation; (b) obtaining any permissions required for live streaming or recording; (c) securing API keys and local data on your devices; and (d) using the App in a manner consistent with your church's policies and applicable law.`,
  },
  {
    title: "7. Prohibited uses",
    body: `You may not use the App to infringe copyright, harass others, distribute malware, interfere with the App's operation, attempt unauthorised access to systems, or misrepresent detected scripture as authoritative without human review in safety-critical contexts.`,
  },
  {
    title: "8. Disclaimer of warranties",
    body: `THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY OF VERSE DETECTION, OR NON-INFRINGEMENT. SPEECH RECOGNITION AND AUTOMATIC VERSE DETECTION MAY PRODUCE ERRORS; ALWAYS VERIFY REFERENCES BEFORE PROJECTING THEM PUBLICLY.`,
  },
  {
    title: "9. Limitation of liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${HELP_LEGAL_COPYRIGHT_HOLDER.toUpperCase()} AND CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, REVENUE, GOODWILL, OR MINISTRY OPPORTUNITY, ARISING FROM YOUR USE OF OR INABILITY TO USE THE APP, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.`,
  },
  {
    title: "10. Termination",
    body: `We may suspend or terminate your licence if you breach these Terms. You may stop using the App at any time by uninstalling it. Sections that by their nature should survive termination (including intellectual property, disclaimers, and limitation of liability) will remain in effect.`,
  },
  {
    title: "11. Changes",
    body: `We may update these Terms from time to time. Material changes will be reflected in the App. Continued use after changes are published constitutes acceptance of the revised Terms.`,
  },
  {
    title: "12. Contact",
    body: `Questions about these Terms may be directed to the copyright holder: ${HELP_LEGAL_CREATOR}.`,
  },
] as const

export const COPYRIGHT_SECTIONS = [
  {
    title: "Software copyright",
    body: `Copyright © ${new Date().getFullYear()} ${HELP_LEGAL_COPYRIGHT_HOLDER}. All rights reserved.\n\n${APP_DISPLAY_NAME} (version ${HELP_LEGAL_APP_VERSION}) and its original software, visual design, and documentation are the property of ${HELP_LEGAL_COPYRIGHT_HOLDER}. Unauthorised reproduction, redistribution, or commercial exploitation of the App or its installers is prohibited except as expressly permitted in writing or by applicable open-source licences for bundled components.`,
  },
  {
    title: "Creator",
    body: `${APP_DISPLAY_NAME} was conceived, designed, and developed by ${HELP_LEGAL_CREATOR} to serve pastors, media teams, and congregations who want God's Word presented clearly and faithfully during worship.`,
  },
  {
    title: "Open-source components",
    body: `The App incorporates open-source libraries and tools, each governed by its own licence. Corresponding licence texts are available in the project repository where required by those licences. Nothing in this notice limits the rights granted by those open-source licences.`,
  },
  {
    title: "Scripture & hymn content",
    body: `Bible translations, cross-references, hymn texts, and other reference data included with or loaded by the App remain subject to the copyrights and terms of their respective publishers. Public-domain texts (such as the King James Version in many jurisdictions) may be used more freely; other translations may require separate licensing for public display or redistribution.`,
  },
  {
    title: "Trademarks",
    body: `${APP_DISPLAY_NAME}, its logo, and related branding are identifiers of this product. Third-party names (including Bible translation names, hymn publishers, and speech-recognition providers) are trademarks of their respective owners.`,
  },
] as const

export const HELP_LEGAL_CLOSING_MESSAGE = {
  greeting: `Thank you for using ${APP_DISPLAY_NAME}.`,
  body: `Whether you are behind the media desk on Sabbath morning, rehearsing midweek, or learning the app for the first time — thank you for labouring to lift up God's Word. May this tool lighten your load so you can focus on what matters most: helping people hear, see, and remember Scripture.`,
  verse: {
    reference: "Colossians 3:16 (KJV)",
    text: "Let the word of Christ dwell in you richly in all wisdom; teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.",
  },
  signOff: `With gratitude,\n${HELP_LEGAL_CREATOR}`,
} as const
