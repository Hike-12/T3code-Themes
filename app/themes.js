export const themes = {
  'koi-pond': {
    name: 'Koi pond',
    description: 'Claude, OpenAI, and Gemini each have their own fish, with different colors and swimming patterns.',
    studioDescription: 'Pick your water colors, set the pace, and see how the fish swim together.',
    action: 'Customize pond',
    download: '/downloads/koi-pond.json',
    defaults: {
      dark: '#101414',
      light: '#e8ede9',
      'reflection-dark': '#a8bdb7',
      'reflection-light': '#ffffff',
      'reflection-strength': 42,
      'claude-time': 72,
      'openai-time': 27,
      'gemini-time': 43,
    },
  },
  'dark-texture': {
    name: 'Dark texture',
    description: 'A fine charcoal grain in dark mode and the same texture on a light gray background.',
    studioDescription: 'Choose a background for each appearance and set how much grain shows through.',
    action: 'Customize texture',
    download: '/downloads/dark-texture.json',
    defaults: { dark: '#101010', light: '#e5e5e5', 'grain-strength': 72 },
  },
};
