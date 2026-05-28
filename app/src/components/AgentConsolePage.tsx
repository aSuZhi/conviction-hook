import { useMemo, useState } from 'react';
import { config } from '../config';
import {
  loadImportedAgentEvidence,
  saveImportedAgentEvidence,
  type EvidenceItem,
} from '../evidence';
import type { Language } from '../i18n';
import { isAddress } from '../routes';
import { shortAddress, type WalletState } from '../wallet';

type Props = {
  wallet: WalletState;
  evidence: EvidenceItem[];
  language: Language;
  onEvidenceImported: () => void;
};

const skillPath = '.agents/skills/conviction-agentic-wallet';
const helperPath = '.agents/skills/conviction-agentic-wallet/scripts/conviction-agent.mjs';
const githubSkillRepo = 'aSuZhi/conviction-agentic-wallet';
const githubInstallCommand = `npx skills add ${githubSkillRepo}`;
const githubPublishCommand = [
  'cd .agents/skills/conviction-agentic-wallet',
  'git init',
  'git add .',
  'git commit -m "Publish Conviction Agentic Wallet skill"',
  'git branch -M main',
  'gh auth login',
  'gh repo create conviction-agentic-wallet --public --source . --remote origin --push',
].join('\n');

const capabilities = [
  ['Discover markets', 'Read active Conviction markets, probability split, deadline, pool, and token addresses.'],
  ['Start demo session', 'Create a wallet-scoped demo market so one user settlement never blocks another user.'],
  ['Claim demo assets', 'Call DemoJourneyController for capped cUSDC and pool-token funding.'],
  ['Buy or sell', 'Build exact approvals and Router-facing enter or exit payloads.'],
  ['Settle market', 'Resolve the caller session through DemoJourneyController and ConvictionMarketManager.'],
  ['Claim winnings', 'Call ConvictionMarket.claim(address) after settlement accounting is ready.'],
  ['Inspect proof', 'Check PoolManager swap, Hook observation, and Market events from a receipt.'],
  ['Import evidence', 'Bring Agentic Wallet transaction hashes back into the DApp proof surface.'],
] as const;

const prompts = [
  'Open a Conviction demo session on X Layer, claim demo funds, then buy YES with 0.5 cUSDC.',
  'Settle my current Conviction demo market as YES, inspect the receipt, then claim winnings if claimable is above zero.',
  'Inspect this X Layer tx and summarize whether PoolManager, ConvictionHook, and ConvictionMarket events were observed.',
  'Show active Conviction markets, my position, claimable amount, and the safest next action.',
];

export function AgentConsolePage({ wallet, evidence, language, onEvidenceImported }: Props) {
  const zh = language === 'zh';
  const [txHash, setTxHash] = useState('');
  const [market, setMarket] = useState('');
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState('');
  const imported = useMemo(loadImportedAgentEvidence, []);
  const agentEvidence = evidence.filter((item) => item.source === 'agentic-wallet');
  const readyAgentEvidence = agentEvidence.filter(
    (item) => item.hookObserved && item.poolManagerObserved && item.marketEventObserved,
  );

  async function copyText(value: string, label: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1400);
  }

  function importEvidence() {
    const item: EvidenceItem = {
      id: txHash || `agent-${Date.now()}`,
      kind: 'agent-wallet',
      label: 'Agentic Wallet operation',
      market: isAddress(market) ? market : undefined,
      txHash: txHash.startsWith('0x') ? (txHash as `0x${string}`) : undefined,
      actor: wallet.account ?? undefined,
      source: 'agentic-wallet',
      hookObserved: Boolean(summary),
      poolManagerObserved: Boolean(summary),
      marketEventObserved: Boolean(summary),
      timestamp: Date.now(),
    };
    saveImportedAgentEvidence([item, ...imported]);
    onEvidenceImported();
    setTxHash('');
    setMarket('');
    setSummary('');
  }

  return (
    <section className="agent-skill-page">
      <header className="agent-skill-hero">
        <div>
          <p className="eyebrow">{zh ? 'Agentic Wallet Skill' : 'Agentic Wallet Skill'}</p>
          <h1>{zh ? 'Conviction Agent Skill' : 'Conviction Agent Skill'}</h1>
          <p>
            {zh
              ? '把 Conviction 从一个可点击 DApp 升级成可被 AI Agent 自然语言操作的 X Layer 市场协议。Skill 负责生成安全交易步骤，钱包负责确认和签名。'
              : 'Turn Conviction from a clickable DApp into an X Layer market protocol that an AI agent can operate from natural language. The skill builds safe actions, the wallet confirms and signs.'}
          </p>
        </div>
        <div className="agent-proof-summary">
          <span>{zh ? '当前钱包' : 'Wallet'}</span>
          <strong>{wallet.account ? shortAddress(wallet.account) : zh ? '未连接' : 'Not connected'}</strong>
          <span>{zh ? 'Agent 证据' : 'Agent evidence'}</span>
          <strong>{agentEvidence.length}</strong>
          <span>{zh ? '可评审证据' : 'Ready proofs'}</span>
          <strong>{readyAgentEvidence.length}</strong>
        </div>
      </header>

      <section className="agent-skill-grid">
        {capabilities.map(([title, body]) => (
          <article className="agent-capability-card" key={title}>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="agent-install-layout">
        <article className="card agent-install-card">
          <p className="eyebrow">{zh ? '安装' : 'Install'}</p>
          <h2>{zh ? '把 Skill 装进你的 Agent 环境' : 'Install the skill into your agent environment'}</h2>
          <div className="agent-install-step">
            <span>1</span>
            <div>
              <strong>{zh ? 'GitHub 安装' : 'GitHub install'}</strong>
              <code>{githubInstallCommand}</code>
              <button className="secondary-cta" onClick={() => void copyText(githubInstallCommand, 'github-install')}>
                {copied === 'github-install' ? (zh ? '已复制' : 'Copied') : (zh ? '复制 GitHub 安装命令' : 'Copy GitHub install')}
              </button>
              <p className="muted">
                {zh
                  ? '已发布到 GitHub，可直接复制安装命令给评审或 Agent 环境。'
                  : 'Published on GitHub. Copy this install command for judges or agent environments.'}
              </p>
            </div>
          </div>
          <div className="agent-install-step">
            <span>2</span>
            <div>
              <strong>{zh ? '本地评审安装' : 'Local judging install'}</strong>
              <code>xcopy ".agents\skills\conviction-agentic-wallet" "%USERPROFILE%\.agents\skills\conviction-agentic-wallet" /E /I /Y</code>
              <button className="secondary-cta" onClick={() => void copyText(`xcopy ".agents\\skills\\conviction-agentic-wallet" "%USERPROFILE%\\.agents\\skills\\conviction-agentic-wallet" /E /I /Y`, 'windows-install')}>
                {copied === 'windows-install' ? (zh ? '已复制' : 'Copied') : (zh ? '复制 Windows 命令' : 'Copy Windows command')}
              </button>
            </div>
          </div>
          <div className="agent-install-step">
            <span>3</span>
            <div>
              <strong>{zh ? '跨平台目录安装' : 'Cross-platform directory install'}</strong>
              <code>mkdir -p ~/.agents/skills && cp -R {skillPath} ~/.agents/skills/</code>
              <button className="secondary-cta" onClick={() => void copyText(`mkdir -p ~/.agents/skills && cp -R ${skillPath} ~/.agents/skills/`, 'unix-install')}>
                {copied === 'unix-install' ? (zh ? '已复制' : 'Copied') : (zh ? '复制 shell 命令' : 'Copy shell command')}
              </button>
            </div>
          </div>
          <div className="agent-install-step">
            <span>4</span>
            <div>
              <strong>{zh ? '发布到 GitHub' : 'Publish to GitHub'}</strong>
              <code>{githubPublishCommand}</code>
              <button className="secondary-cta" onClick={() => void copyText(githubPublishCommand, 'github-publish')}>
                {copied === 'github-publish' ? (zh ? '已复制' : 'Copied') : (zh ? '复制发布命令' : 'Copy publish command')}
              </button>
              <p className="muted">{zh ? '在 skill 文件夹内执行。当前环境尚未登录 GitHub。' : 'Run inside the skill folder. This environment is not logged into GitHub yet.'}</p>
            </div>
          </div>
        </article>

        <article className="card agent-command-card">
          <p className="eyebrow">{zh ? '自然语言调用' : 'Natural-language calls'}</p>
          <h2>{zh ? '复制给 Agent 的任务' : 'Prompts to give your agent'}</h2>
          <div className="agent-prompt-list">
            {prompts.map((prompt, index) => (
              <button className="agent-prompt" key={prompt} onClick={() => void copyText(prompt, `prompt-${index}`)}>
                <span>{prompt}</span>
                <strong>{copied === `prompt-${index}` ? (zh ? '已复制' : 'Copied') : (zh ? '复制' : 'Copy')}</strong>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="agent-config-grid">
        <article className="card">
          <p className="eyebrow">{zh ? 'Helper CLI' : 'Helper CLI'}</p>
          <h2>{zh ? '只构造交易，不签名广播' : 'Builds transactions, never signs or broadcasts'}</h2>
          <code>node {helperPath} build enter --from 0x... --market 0x... --outcome yes --amount 0.5</code>
          <code>node {helperPath} inspect-tx --hash 0x... --market 0x...</code>
        </article>
        <article className="card">
          <p className="eyebrow">{zh ? '安全路径' : 'Safe route'}</p>
          <h2>{zh ? '所有买卖都必须经过 Router' : 'All entry and exit goes through Router'}</h2>
          <ol className="agent-route-list">
            <li>Agentic Wallet</li>
            <li>ConvictionRouter</li>
            <li>PoolManager.swap</li>
            <li>ConvictionHook</li>
            <li>ConvictionMarket</li>
          </ol>
        </article>
      </section>

      <section className="card agent-address-card">
        <div>
          <p className="eyebrow">{zh ? '当前部署' : 'Current deployment'}</p>
          <h2>X Layer mainnet</h2>
        </div>
        <dl>
          <dt>Controller</dt><dd>{config.demoJourneyController}</dd>
          <dt>Router</dt><dd>{config.routerAddress}</dd>
          <dt>Hook</dt><dd>{config.hookAddress}</dd>
          <dt>Manager</dt><dd>{config.managerAddress}</dd>
          <dt>Fallback market</dt><dd>{config.marketAddress}</dd>
          <dt>Collateral</dt><dd>{config.collateralToken}</dd>
        </dl>
      </section>

      <section className="studio-view agent-evidence-import">
        <div>
          <p className="eyebrow">{zh ? '证据导入' : 'Evidence import'}</p>
          <h2>{zh ? '导入 Agentic Wallet 交易' : 'Import an Agentic Wallet transaction'}</h2>
          <p className="muted">
            {zh
              ? '如果 Agent 已经完成链上操作，把 tx hash 和 market 放进这里，证据中心会把它归类为 Agentic Wallet 证明。'
              : 'When an agent has executed on-chain, import the tx hash and market here so the proof center classifies it as Agentic Wallet evidence.'}
          </p>
        </div>
        <div className="studio-form">
          <label><span>Transaction hash</span><input value={txHash} onChange={(event) => setTxHash(event.target.value)} /></label>
          <label><span>Market address</span><input value={market} onChange={(event) => setMarket(event.target.value)} /></label>
          <label><span>Hook event summary</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
          <button className="primary-cta" onClick={importEvidence}>Import to proof center</button>
        </div>
      </section>
    </section>
  );
}
