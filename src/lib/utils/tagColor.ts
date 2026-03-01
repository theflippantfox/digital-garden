import type { Accent } from '$lib/types';

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ── 10 accent colors ──────────────────────────────────────────────────────────

const ACCENTS: Accent[] = [
  'violet', 'coral', 'cyan', 'lime', 'amber', 'rose', 'sky', 'emerald', 'indigo', 'orange'
];

const KNOWN_ACCENTS: Record<string, Accent> = {
  // Tech / engineering
  engineering: 'violet', code: 'violet', coding: 'violet', programming: 'violet',
  dev: 'violet', development: 'violet', software: 'violet', tools: 'violet',
  tech: 'indigo', technology: 'indigo', systems: 'indigo', architecture: 'indigo',
  backend: 'sky', frontend: 'sky', web: 'sky', api: 'sky', database: 'sky',
  data: 'cyan', ml: 'cyan', ai: 'cyan', analytics: 'cyan', science: 'cyan',
  // Philosophy / thought
  philosophy: 'coral', reflection: 'coral', thinking: 'coral', opinion: 'coral',
  essay: 'rose', ideas: 'rose', thoughts: 'rose', theory: 'rose', concept: 'rose',
  // Design / art / creativity
  design: 'cyan', ux: 'sky', ui: 'sky', product: 'sky',
  art: 'orange', illustration: 'orange', photography: 'orange', visual: 'orange',
  typography: 'amber', fonts: 'amber', aesthetics: 'rose', creativity: 'orange',
  // Writing / learning
  writing: 'amber', journaling: 'amber', notes: 'amber', documentation: 'amber',
  reading: 'amber', books: 'amber', literature: 'amber',
  learning: 'lime', education: 'lime', research: 'indigo', math: 'indigo',
  // Life / wellbeing
  life: 'emerald', health: 'emerald', fitness: 'emerald', wellness: 'emerald',
  productivity: 'lime', habits: 'lime', goals: 'lime', focus: 'lime',
  finance: 'emerald', money: 'emerald', career: 'sky',
  // Misc
  travel: 'cyan', food: 'orange', music: 'rose', film: 'coral', gaming: 'violet',
  psychology: 'coral', sociology: 'rose', history: 'amber', politics: 'indigo',
  nature: 'emerald', environment: 'emerald', space: 'indigo',
  personal: 'rose', daily: 'amber', log: 'amber', journal: 'amber',
  project: 'sky', planning: 'sky', ideas2: 'rose',
};

export function tagToAccent(tag: string): Accent {
  const key = tag.toLowerCase().trim();
  return KNOWN_ACCENTS[key] ?? ACCENTS[djb2(key) % ACCENTS.length];
}

// ── Emojis ────────────────────────────────────────────────────────────────────

const EMOJI_POOL = ['💡', '🔧', '🎨', '📐', '🧪', '🌊', '🔬', '📡', '⚡', '🎯', '🧩', '🌀', '🔑', '🛸', '🎪'];

const KNOWN_EMOJIS: Record<string, string> = {
  // Tech / engineering
  engineering: '⚙️', code: '💻', coding: '💻', programming: '💻', dev: '💻',
  development: '🛠️', software: '💾', tools: '🔧', tech: '🖥️', technology: '🖥️',
  systems: '🧩', architecture: '🏗️', backend: '🗄️', frontend: '🖼️',
  web: '🌐', api: '🔌', database: '🗃️', data: '📊', ml: '🤖', ai: '🤖',
  analytics: '📈', science: '🔬',
  // Philosophy / thought
  philosophy: '🔮', reflection: '🪞', thinking: '💭', opinion: '🗣️',
  essay: '📝', ideas: '💡', thoughts: '💭', theory: '🧠', concept: '🔷',
  // Design / art
  design: '✦', ux: '🖌️', ui: '🎛️', product: '📦',
  art: '🎨', illustration: '✏️', photography: '📷', visual: '👁️',
  typography: '🔤', fonts: '🅰️', aesthetics: '✨', creativity: '🌈',
  // Writing / learning
  writing: '✍️', journaling: '📔', notes: '📋', documentation: '📚',
  reading: '📖', books: '📚', literature: '📜', learning: '🧠',
  education: '🎓', research: '🔭', math: '∑', history: '🏛️',
  // Life / wellbeing
  life: '🌸', health: '🫀', fitness: '💪', wellness: '🧘',
  productivity: '⚡', habits: '🔄', goals: '🎯', focus: '🔆',
  finance: '💰', money: '💸', career: '💼',
  // Misc
  travel: '✈️', food: '🍳', music: '🎵', film: '🎬', gaming: '🎮',
  psychology: '🧬', sociology: '🫂', politics: '🗳️',
  nature: '🌿', environment: '🌍', space: '🚀',
  personal: '🪴', daily: '📅', log: '📓', journal: '📔',
  project: '📌', planning: '🗓️',
};

export function tagToEmoji(tag: string): string {
  const key = tag.toLowerCase().trim();
  return KNOWN_EMOJIS[key] ?? EMOJI_POOL[djb2(key) % EMOJI_POOL.length];
}

// ── Per-accent CSS values ─────────────────────────────────────────────────────

export const ACCENT_STYLES: Record<Accent, {
  hex: string; text: string; border: string; bg: string; hoverBorder: string;
}> = {
  violet: { hex: '#b44dff', text: 'text-[#b44dff]', border: 'border-[rgba(180,77,255,0.3)]', bg: 'bg-[rgba(180,77,255,0.1)]', hoverBorder: 'hover:border-[rgba(180,77,255,0.5)]' },
  coral: { hex: '#ff5c3a', text: 'text-[#ff5c3a]', border: 'border-[rgba(255,92,58,0.3)]', bg: 'bg-[rgba(255,92,58,0.1)]', hoverBorder: 'hover:border-[rgba(255,92,58,0.5)]' },
  cyan: { hex: '#00f0ff', text: 'text-[#00f0ff]', border: 'border-[rgba(0,240,255,0.3)]', bg: 'bg-[rgba(0,240,255,0.08)]', hoverBorder: 'hover:border-[rgba(0,240,255,0.5)]' },
  lime: { hex: '#b8ff3a', text: 'text-[#b8ff3a]', border: 'border-[rgba(184,255,58,0.3)]', bg: 'bg-[rgba(184,255,58,0.08)]', hoverBorder: 'hover:border-[rgba(184,255,58,0.5)]' },
  amber: { hex: '#ffb84d', text: 'text-[#ffb84d]', border: 'border-[rgba(255,184,77,0.3)]', bg: 'bg-[rgba(255,184,77,0.1)]', hoverBorder: 'hover:border-[rgba(255,184,77,0.5)]' },
  rose: { hex: '#ff4d8b', text: 'text-[#ff4d8b]', border: 'border-[rgba(255,77,139,0.3)]', bg: 'bg-[rgba(255,77,139,0.1)]', hoverBorder: 'hover:border-[rgba(255,77,139,0.5)]' },
  sky: { hex: '#4d9fff', text: 'text-[#4d9fff]', border: 'border-[rgba(77,159,255,0.3)]', bg: 'bg-[rgba(77,159,255,0.1)]', hoverBorder: 'hover:border-[rgba(77,159,255,0.5)]' },
  emerald: { hex: '#4dffb8', text: 'text-[#4dffb8]', border: 'border-[rgba(77,255,184,0.3)]', bg: 'bg-[rgba(77,255,184,0.08)]', hoverBorder: 'hover:border-[rgba(77,255,184,0.5)]' },
  indigo: { hex: '#6b4dff', text: 'text-[#6b4dff]', border: 'border-[rgba(107,77,255,0.3)]', bg: 'bg-[rgba(107,77,255,0.1)]', hoverBorder: 'hover:border-[rgba(107,77,255,0.5)]' },
  orange: { hex: '#ff7a4d', text: 'text-[#ff7a4d]', border: 'border-[rgba(255,122,77,0.3)]', bg: 'bg-[rgba(255,122,77,0.1)]', hoverBorder: 'hover:border-[rgba(255,122,77,0.5)]' },
};
