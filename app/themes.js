export const pondProviders = ['Claude', 'OpenAI', 'Gemini', 'OpenCode'];

export const themes = {
  'koi-pond': {
    name: 'Koi pond',
    description: 'Claude, OpenAI, Gemini, and OpenCode each have their own fish and swimming pattern.',
    studioDescription: 'Pick your water colors, set the pace, and see how the fish swim together.',
    action: 'Customize pond',
    download: '/downloads/koi-pond.json',
    defaults: {
      dark: '#101010',
      light: '#e5e5e5',
      'claude-time': 72,
      'openai-time': 27,
      'gemini-time': 43,
      'opencode-time': 54,
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
