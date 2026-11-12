// Response language: Clasp tells every hosted agent to answer in its configured language unless
// the user explicitly asks for another. Each case pins the agent's language, writes to it in
// another one, and names the language the reply should be in.

export interface LanguageCase {
  id: string
  tags: string[]
  agentLanguage: string
  message: string
  expectedLanguage: string
}

export const SALES_ASSISTANT_PROMPT = `You are a sales assistant for B2B account executives.
Give practical, specific advice in two to four sentences.`

export const LANGUAGE_CASES: LanguageCase[] = [
  {
    id: "lang-it-from-en",
    tags: ["switch"],
    agentLanguage: "it",
    message: "Can you give me three tips to open a cold call with a CFO?",
    expectedLanguage: "it",
  },
  {
    id: "lang-it-from-es",
    tags: ["switch"],
    agentLanguage: "it",
    message: "¿Cómo manejo la objeción de que nuestro producto es demasiado caro?",
    expectedLanguage: "it",
  },
  {
    id: "lang-es-from-en",
    tags: ["switch"],
    agentLanguage: "es",
    message: "How should I follow up after a demo that went well?",
    expectedLanguage: "es",
  },
  {
    id: "lang-de-from-it",
    tags: ["switch"],
    agentLanguage: "de",
    message: "Come preparo una call di discovery con un responsabile acquisti?",
    expectedLanguage: "de",
  },
  {
    id: "lang-fr-from-de",
    tags: ["switch"],
    agentLanguage: "fr",
    message: "Wie überzeuge ich einen skeptischen IT-Leiter von einer Testphase?",
    expectedLanguage: "fr",
  },
  {
    id: "lang-ja-from-en",
    tags: ["switch", "non-latin"],
    agentLanguage: "ja",
    message: "What questions should I ask to qualify a lead quickly?",
    expectedLanguage: "ja",
  },
  {
    id: "lang-ar-from-en",
    tags: ["switch", "non-latin"],
    agentLanguage: "ar",
    message: "How do I keep a deal moving when the champion goes quiet?",
    expectedLanguage: "ar",
  },
  {
    id: "lang-en-from-it",
    tags: ["switch"],
    agentLanguage: "en",
    message: "Mi dai un consiglio per negoziare uno sconto senza perdere margine?",
    expectedLanguage: "en",
  },
  {
    id: "lang-en-from-ja",
    tags: ["switch", "non-latin"],
    agentLanguage: "en",
    message: "見込み客との最初のミーティングで何を話すべきですか？",
    expectedLanguage: "en",
  },
  {
    id: "lang-it-override-en",
    tags: ["explicit-override"],
    agentLanguage: "it",
    message: "Please answer in English: how do I write a good follow-up email after a trade show?",
    expectedLanguage: "en",
  },
  {
    id: "lang-de-override-fr",
    tags: ["explicit-override"],
    agentLanguage: "de",
    message:
      "Réponds en français s'il te plaît : comment présenter notre prix face à un concurrent moins cher ?",
    expectedLanguage: "fr",
  },
  {
    id: "lang-pt-from-mixed",
    tags: ["switch", "mixed-input"],
    agentLanguage: "pt",
    message: "Hola, I need help: ¿qué digo cuando the buyer says they have no budget this quarter?",
    expectedLanguage: "pt",
  },
  {
    id: "lang-it-pasted-en",
    tags: ["pasted-content"],
    agentLanguage: "it",
    message: `Summarize what this prospect wants:
"Hi, we're a 40-person logistics company. We need better visibility on shipments and our current tool
is too slow. Budget approval happens in March and our CTO has the final say."`,
    expectedLanguage: "it",
  },
  {
    id: "lang-es-translate-request",
    tags: ["explicit-override", "hard"],
    agentLanguage: "es",
    message: "How do you say 'we can offer a pilot' in English and when should I offer one?",
    expectedLanguage: "es",
  },
  {
    id: "lang-fr-from-en-technical",
    tags: ["switch", "technical"],
    agentLanguage: "fr",
    message: "Explain to me how to pitch SSO and SCIM support to an enterprise security team.",
    expectedLanguage: "fr",
  },
  {
    id: "lang-nl-from-en",
    tags: ["switch"],
    agentLanguage: "nl",
    message: "What is a good way to ask for a referral from a happy customer?",
    expectedLanguage: "nl",
  },
]
