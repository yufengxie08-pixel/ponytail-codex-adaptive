#!/usr/bin/env node
// Codex-only profile router. It keeps the always-on context small and adds
// task-specific quality guards only when they are relevant.

const fs = require('fs');
const path = require('path');
const { getConfigPath, VALID_PROFILES } = require('./ponytail-config');

const PROFILE_FILES = {
  core: 'core.md',
  engineering: 'engineering.md',
  game: 'game.md',
  visual: 'visual.md',
  quality: 'quality.md',
};

function normalizeProfile(profile) {
  if (typeof profile !== 'string') return null;
  const normalized = profile.trim().toLowerCase();
  return VALID_PROFILES.includes(normalized) ? normalized : null;
}

function readJson(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) {
    return {};
  }
}

function findProjectConfig(cwd) {
  let current = path.resolve(cwd || process.cwd());
  while (true) {
    const candidates = [
      path.join(current, '.ponytail.json'),
      path.join(current, '.codex', 'ponytail.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return { path: candidate, config: readJson(candidate) };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { path: null, config: {} };
}

function readGlobalConfig() {
  return readJson(getConfigPath());
}

function fileText(cwd, fileName) {
  try {
    return fs.readFileSync(path.join(cwd, fileName), 'utf8').toLowerCase();
  } catch (_) {
    return '';
  }
}

function projectSignals(cwd) {
  const names = [];
  const files = ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod'];
  for (const file of files) {
    if (fs.existsSync(path.join(cwd, file))) names.push(file);
  }

  const packageText = fileText(cwd, 'package.json');
  const manifests = packageText + ' ' + fileText(cwd, 'pyproject.toml') + ' ' +
    fileText(cwd, 'requirements.txt') + ' ' + fileText(cwd, 'Cargo.toml');
  const entries = [];
  try {
    for (const entry of fs.readdirSync(cwd, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'vendor'].includes(entry.name)) {
        entries.push(entry.name.toLowerCase());
      }
    }
  } catch (_) {}
  return { names, manifests, entries };
}

const GAME_PROMPT = /\b(game|gameplay|level|enemy|player|collision|physics|particle|sprite|canvas|webgl|three\.js|phaser|pixi|sound effect|audio feedback)\b|游戏|玩法|关卡|敌人|玩家|碰撞|物理|粒子|精灵|音效|手感/i;
const VISUAL_PROMPT = /\b(landing page|portfolio|marketing page|homepage|animation|transition|visual|interaction|responsive|layout|design system|ui|ux)\b|首页|官网|作品集|营销页|动画|动效|视觉|交互|响应式|布局|样式/i;
const ENGINEERING_PROMPT = /\b(api|crud|database|migration|schema|endpoint|backend|auth|authentication|validation|test|bug fix|refactor|config|dependency)\b|接口|数据库|迁移|后端|鉴权|校验|测试|修复|重构|配置|依赖/i;
const GAME_PROJECT = /\b(three|phaser|pixi|babylon|playcanvas|matter|box2d|canvas|webgl|game|godot|unity|levels?|entities|sprites?|particles?|collision)\b/i;
const VISUAL_PROJECT = /\b(react|next|vue|svelte|tailwind|framer-motion|gsap|three|webgl|canvas|storybook|frontend|pages?|app)\b|src\/components/i;
const ENGINEERING_PROJECT = /\b(express|fastify|nestjs|django|flask|fastapi|rails|spring|sql|postgres|mysql|redis|prisma|drizzle|backend|server|api|migrations?|models?|routes?)\b/i;

function scoreProfile(prompt, signals) {
  const text = String(prompt || '');
  const manifest = signals.manifests + ' ' + signals.entries.join(' ');
  const scores = { game: 0, visual: 0, engineering: 0 };
  if (GAME_PROMPT.test(text)) scores.game += 6;
  if (VISUAL_PROMPT.test(text)) scores.visual += 5;
  if (ENGINEERING_PROMPT.test(text)) scores.engineering += 5;
  if (GAME_PROJECT.test(manifest)) scores.game += 3;
  if (VISUAL_PROJECT.test(manifest)) scores.visual += 2;
  if (ENGINEERING_PROJECT.test(manifest)) scores.engineering += 2;

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] === 0) return 'quality';
  // A near tie is intentionally conservative: preserve experience and ask the
  // model to keep all competing requirements instead of picking a narrow mode.
  if (ranked[0][1] - ranked[1][1] < 2) return 'quality';
  return ranked[0][0];
}

function explicitProfile(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (/(按|使用|进入|切换到).{0,8}(游戏|game).{0,8}(模式|策略)?/.test(text)) return 'game';
  if (/(按|使用|进入|切换到).{0,8}(视觉|网站|visual).{0,8}(模式|策略)?/.test(text)) return 'visual';
  if (/(按|使用|进入|切换到).{0,8}(工程|engineering).{0,8}(模式|策略)?/.test(text)) return 'engineering';
  if (/(质量优先|quality first|不要牺牲|不要简化视觉|不要简化玩法)/.test(text)) return 'quality';
  return null;
}

function resolveProfile({ cwd = process.cwd(), prompt = '', profile } = {}) {
  const explicit = normalizeProfile(profile);
  if (explicit && explicit !== 'auto' && explicit !== 'core') return explicit;

  const project = findProjectConfig(cwd).config;
  const projectProfile = normalizeProfile(project.profile);
  if (projectProfile && projectProfile !== 'auto' && projectProfile !== 'core') return projectProfile;

  const envProfile = normalizeProfile(process.env.PONYTAIL_PROFILE);
  const global = readGlobalConfig();
  const configured = envProfile || normalizeProfile(global.profile) || normalizeProfile(global.defaultProfile);
  if (configured && configured !== 'auto' && configured !== 'core') return configured;

  return explicitProfile(prompt) || scoreProfile(prompt, projectSignals(path.resolve(cwd || process.cwd())));
}

function readProfile(profile) {
  const fileName = PROFILE_FILES[profile] || PROFILE_FILES.quality;
  const filePath = path.join(__dirname, '..', 'skills', 'ponytail', 'profiles', fileName);
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (_) {
    return '';
  }
}

module.exports = {
  explicitProfile,
  findProjectConfig,
  normalizeProfile,
  readProfile,
  resolveProfile,
  scoreProfile,
};
