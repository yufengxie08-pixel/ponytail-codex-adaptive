const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const { getCodexPonytailInstructions } = require('../hooks/ponytail-instructions');
const {
  explicitProfile,
  findProjectConfig,
  resolveProfile,
  scoreProfile,
} = require('../hooks/ponytail-profile');

test('automatic routing favors game, visual, and engineering prompts', () => {
  assert.equal(scoreProfile('add enemy collision and particle feedback', { manifests: '', entries: [] }), 'game');
  assert.equal(scoreProfile('add a responsive landing page with scroll animation', { manifests: '', entries: [] }), 'visual');
  assert.equal(scoreProfile('add pagination to the users API and validate query params', { manifests: '', entries: [] }), 'engineering');
});

test('ambiguous work uses the quality-first profile', () => {
  assert.equal(scoreProfile('make this better', { manifests: '', entries: [] }), 'quality');
  assert.equal(explicitProfile('这次按游戏模式处理，但不要牺牲手感'), 'game');
  assert.equal(explicitProfile('质量优先，不要简化视觉'), 'quality');
});

test('project profile overrides global profile', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-profile-'));
  const project = path.join(temp, 'project');
  const nested = path.join(project, 'src');
  const configHome = path.join(temp, 'config');
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(path.join(configHome, 'ponytail'), { recursive: true });
  fs.writeFileSync(path.join(configHome, 'ponytail', 'config.json'), JSON.stringify({ profile: 'visual' }));
  fs.writeFileSync(path.join(project, '.ponytail.json'), JSON.stringify({ profile: 'game' }));

  const oldXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = configHome;
  try {
    assert.equal(findProjectConfig(nested).config.profile, 'game');
    assert.equal(resolveProfile({ cwd: nested, prompt: 'add a page' }), 'game');
  } finally {
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('Codex core is materially smaller than the original full skill', () => {
  const context = getCodexPonytailInstructions('full', { profile: 'core' });
  assert.match(context, /PONYTAIL CODEX PROFILE: CORE/);
  assert.ok(context.length < 1800, 'core context should stay below roughly 450 tokens');
});

test('Codex prompt hook routes a project prompt and emits one JSON object', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-codex-hook-'));
  const project = path.join(temp, 'project');
  const pluginData = path.join(temp, 'plugin-data');
  fs.mkdirSync(project, { recursive: true });
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'ponytail-mode-tracker.js')], {
    cwd: project,
    env: {
      ...process.env,
      HOME: temp,
      USERPROFILE: temp,
      PLUGIN_DATA: pluginData,
      PONYTAIL_DEFAULT_MODE: 'full',
    },
    input: JSON.stringify({ prompt: 'build a playable level with enemy collision and particles', cwd: project }),
    encoding: 'utf8',
  });
  try {
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL CODEX PROFILE: GAME/);
    assert.equal(output.additionalContext, undefined);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
