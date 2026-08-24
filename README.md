# Ponytail Codex Adaptive

面向 Codex 的质量优先规则适配器。

它保留 Ponytail 的核心原则：先理解问题，再选择满足需求的最小正确实现；同时针对 Codex 的游戏和网站开发任务做了自适应路由，减少重复注入的上下文，让规则更贴近当前任务。

> 本项目基于 [DietrichGebert/ponytail](https://github.com/dietrichgebert/ponytail) 改造，重点是 Codex 适配、任务识别和质量保护。

## 解决什么问题

通用的“少写代码”规则并不适合所有任务：游戏和交互式网站需要保留动画、反馈、可访问性和视觉细节，工程任务则更关心边界、测试和安全。

本适配版把规则分成一个轻量核心和四个按需 profile：

| Profile | 适用任务 | 重点 |
| --- | --- | --- |
| `game` | 游戏、玩法、关卡、角色控制 | 手感、反馈、状态一致性、性能 |
| `visual` | 网站视觉、动画、交互、响应式布局 | 视觉层次、动效、可用性、移动端 |
| `engineering` | API、数据、重构、测试、工具链 | 正确性、边界、错误处理、安全 |
| `quality` | 无法明确分类或高风险任务 | 质量优先，避免激进删减 |

任务不明确时默认使用 `quality`，不会为了省 token 强行套用极简规则。

## 核心行为

- SessionStart 只注入轻量核心规则。
- 每次提交任务时自动判断任务类型并选择 profile。
- 支持项目级配置，项目规则优先于全局规则。
- 支持用自然语言临时覆盖，例如“按游戏模式处理，但不要牺牲动画和手感”。
- 子 agent 默认只接收核心规则，避免在每个子上下文重复完整规则集。
- 质量保护始终有效：不删安全校验、错误处理、数据保护、可访问性和必要测试。

这个项目优化的是规则层上下文，不承诺每个任务的总 token 都会下降。复杂任务仍然应该优先保证结果质量，并通过测试和实际运行验证。

## 安装到 Codex

在终端执行：

```bash
codex plugin marketplace add yufengxie08-pixel/ponytail-codex-adaptive
codex plugin add ponytail@ponytail
```

安装后：

1. 重启 Codex Desktop，或重新启动 Codex CLI。
2. 打开 `/hooks`，检查并信任 Ponytail 的生命周期 hooks。
3. 新建一个任务进行验证。

如果你的 Codex 版本不支持 marketplace 命令，可以直接从本仓库加载插件目录，并确保 `.codex-plugin/plugin.json` 和 `hooks/` 一起保留。

## 配置

### 项目级配置

在项目根目录创建 `.ponytail.json`：

```json
{
  "profile": "auto"
}
```

也可以放在 `.codex/ponytail.json`。可选值为：`auto`、`game`、`visual`、`engineering`、`quality`、`core`。

例如，一个需要稳定视觉回归的交互式网站可以固定使用：

```json
{
  "profile": "visual"
}
```

### 全局配置

在 `~/.config/ponytail/config.json` 中设置默认 profile：

```json
{
  "profile": "auto"
}
```

也支持环境变量：

```bash
export PONYTAIL_PROFILE=quality
```

项目配置优先于全局配置；单次任务中的自然语言要求优先于自动识别。

## 工作方式

规则选择遵循以下顺序：

1. 先读取相关代码和现有约定。
2. 判断任务属于游戏、视觉、工程，还是需要质量优先兜底。
3. 优先复用现有能力、标准库和平台原生功能。
4. 只实现当前需求需要的部分。
5. 对视觉和交互任务保留必要的细节，对工程任务保留必要的校验和测试。

“最小实现”不是“最少代码”，而是没有删掉必要质量保障的最小正确实现。

## 目录说明

```text
hooks/
  ponytail-profile.js       Codex 任务路由和配置读取
  ponytail-instructions.js  Codex 核心与 profile 注入
  ponytail-mode-tracker.js  每次任务的模式跟踪
  ponytail-subagent.js      子 agent 的轻量注入
skills/ponytail/profiles/   core、game、visual、engineering、quality 规则
docs/codex-adaptive.md      适配器的配置和实现说明
tests/codex-adaptive.test.js Codex 路由测试
```

## 本地验证

```bash
node --check hooks/ponytail-profile.js
node scripts/check-rule-copies.js
npm test
```

完整测试需要 Node.js；仓库测试还会使用 Python 完成部分数据校验。

## 已知边界

- 自动识别是启发式路由，不会替代对需求和代码的理解。
- 没有固定技术栈时，profile 只提供决策约束，不会强制引入框架。
- token 节省比例取决于任务、代码库和模型，应该用自己的任务进行对比测试。
- 如果质量和 token 预算发生冲突，默认选择质量优先。

## 来源与许可

本项目继承上游 Ponytail 的部分 hooks、skills 和测试结构，并在此基础上增加 Codex 自适应路由。原始项目作者和贡献者信息见上游仓库。

代码以 [MIT License](LICENSE) 发布。
