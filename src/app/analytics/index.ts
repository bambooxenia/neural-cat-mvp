// src/app/analytics/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

type EventName =
  | 'REWARD_ACCEPTED'
  | 'BAIT_COMPLETED'
  | 'TASK_COMPLETED'
  | 'MOOD_SELECTED'
  | 'BAIT_REROLL'
  | 'TASK_REROLL'
  | 'ERROR';

export type AnalyticsContext = {
  ts: number;                 // epoch ms
  sessionId: string;          // stable session id
  uid?: string;               // 可选：登录用户 id（如有）
  platform?: 'web' | 'ios' | 'android' | 'unknown';
  ua?: string;                // 简化的 UA，debug 用
  // 你可以按需补充 route, locale 等
};

export type AnalyticsEvent = {
  name: EventName;
  payload?: Record<string, any>;
  ctx: AnalyticsContext;
};

export type AnalyticsAdapter = {
  /** 全局唯一 id */
  id: string;
  /** 处理一条事件；可以是同步或异步 */
  track: (evt: AnalyticsEvent) => void | Promise<void>;
  /** 可选：flush 队列 */
  flush?: () => void | Promise<void>;
};

/* ---------------------------------------------------------------------------------------------- */
/* 内部：适配器注册 & 分发                                                                          */
/* ---------------------------------------------------------------------------------------------- */

const _adapters: AnalyticsAdapter[] = [];

/** 注册一个适配器（按加入顺序依次触发） */
export function registerAdapter(adapter: AnalyticsAdapter) {
  if (_adapters.find((a) => a.id === adapter.id)) return; // 防重
  _adapters.push(adapter);
}

/** 注销适配器（可用于 HMR 或测试） */
export function unregisterAdapter(id: string) {
  const idx = _adapters.findIndex((a) => a.id === id);
  if (idx >= 0) _adapters.splice(idx, 1);
}

/**（可选）调试查看当前已注册的适配器 */
export function getRegisteredAdapters(): string[] {
  return _adapters.map((a) => a.id);
}

/* ---------------------------------------------------------------------------------------------- */
/* 内部：上下文与事件分发                                                                          */
/* ---------------------------------------------------------------------------------------------- */

const LS_SESSION_KEY = 'NC_SESSION_ID';

function ensureSessionId(): string {
  try {
    const existed = localStorage.getItem(LS_SESSION_KEY);
    if (existed) return existed;
    const id =
      (globalThis.crypto && 'randomUUID' in globalThis.crypto
        ? (globalThis.crypto as any).randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    localStorage.setItem(LS_SESSION_KEY, id);
    return id;
  } catch {
    // SSR 或隐私模式兜底
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function detectPlatform(): AnalyticsContext['platform'] {
  try {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    return 'web';
  } catch {
    return 'unknown';
  }
}

function buildContext(): AnalyticsContext {
  return {
    ts: Date.now(),
    sessionId: ensureSessionId(),
    platform: detectPlatform(),
    ua: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',
  };
}

async function dispatch(name: EventName, payload?: Record<string, any>) {
  const evt: AnalyticsEvent = { name, payload, ctx: buildContext() };
  // 串行或并行都可以，这里用并行，避免阻塞主流程
  await Promise.allSettled(_adapters.map((a) => Promise.resolve(a.track(evt))));
}

/* ---------------------------------------------------------------------------------------------- */
/* 默认：控制台适配器（开发期可见）                                                                 */
/* ---------------------------------------------------------------------------------------------- */

const consoleAdapter: AnalyticsAdapter = {
  id: 'console',
  track(evt) {
    if (import.meta.env?.DEV) {
      // 控制台美化输出
      const color =
        evt.name === 'ERROR' ? 'crimson' :
        evt.name === 'REWARD_ACCEPTED' ? 'rebeccapurple' :
        'teal';
      // eslint-disable-next-line no-console
      console.log(
        `%c[ANALYTICS] ${evt.name}`,
        `color:${color};font-weight:700`,
        { payload: evt.payload, ctx: evt.ctx }
      );
    }
  },
};

registerAdapter(consoleAdapter);

/* ---------------------------------------------------------------------------------------------- */
/* 可选：注册“写入 Metrics Store”的适配器                                                          */
/* 说明：如果你希望把采集到的事件转成“每日计数”等基础指标，启动时调用一次 registerMetricsAdapter()。 */
/* ---------------------------------------------------------------------------------------------- */

let _metricsAdapterRegistered = false;

/**
 * 将事件转写到 Metrics Store（最小示例）。
 * - 你可以在这里做“每日 +1”、“分类计数”等轻聚合；
 * - 重/复杂聚合与报表建议在 metrics/selectors 层做。
 */
export async function registerMetricsAdapter() {
  if (_metricsAdapterRegistered) return;
  _metricsAdapterRegistered = true;

  // 动态 import，避免模块间的编译时强耦合（也利于单测替换）
  const mod = await import('@/features/records/metrics/store');
  const useNCMetricStore: () => { save: (n: number) => void } = (mod as any).useNCMetricStore;

  const adapter: AnalyticsAdapter = {
    id: 'metrics-store',
    track(evt) {
      try {
        const metrics = useNCMetricStore?.();
        if (!metrics || typeof metrics.save !== 'function') return;

        switch (evt.name) {
          case 'REWARD_ACCEPTED':
            // 最小实现：每次确认奖励 +1
            metrics.save(1);
            break;
          case 'BAIT_COMPLETED':
          case 'TASK_COMPLETED':
          case 'MOOD_SELECTED':
          case 'BAIT_REROLL':
          case 'TASK_REROLL':
            // 这里也可以做通用 +1，或根据 payload 分类计数
            metrics.save(1);
            break;
          default:
            break;
        }
      } catch {
        // 静默失败，避免影响主流程
      }
    },
  };

  registerAdapter(adapter);
}

/* ---------------------------------------------------------------------------------------------- */
/* 对外：语义化的 log*() API（页面/功能域只用这些，不直接接触适配器）                               */
/* ---------------------------------------------------------------------------------------------- */

export function logEvent(name: EventName, payload?: Record<string, any>) {
  return dispatch(name, payload);
}

/** 用户点击“领取奖励”并成功领取 */
export function logRewardAccepted(payload: {
  id?: string;
  type?: 'xp' | 'sticker' | 'badge' | string;
  rarity?: 'common' | 'rare' | 'epic' | string;
  amount?: number;
}) {
  return dispatch('REWARD_ACCEPTED', {
    amount: 1,
    ...payload,
  });
}

/** 完成了一条诱饵（或任务） */
export function logBaitCompleted(payload: {
  baitId?: string;          // 建议传稳定 id/slug
  title?: string;
  source?: 'system' | 'user';
  moodsResolved?: string[]; // 经过 resolveKey 的标准键
}) {
  // ✅ 同步广播奖励主题，供 RewardCenter 直接订阅展示奖励
  publish('reward.bait.completed', payload);
  return dispatch('BAIT_COMPLETED', payload);
}

/** 完成了一条任务 */
export function logTaskCompleted(payload: {
  taskId?: string;          // 建议传稳定 id/slug
  title?: string;
  source?: 'system' | 'user';
  moodsResolved?: string[]; // 经过 resolveKey 的标准键
}) {
  // 先广播给 UI（供 RewardCenter 订阅）
  publish('reward.task.completed', payload)
  // 再发埋点
  return dispatch('TASK_COMPLETED', payload)
}

// --- Journal reward event -----------------------------------------------
export type JournalCreatedPayload = {
  dayKeyLocal: string
  source: 'free' | 'template'
  length: number
}

/** 浏览器全局发布：供 RewardCenter 等 UI 订阅使用 */
function publish(topic: string, detail: any) {
  try {
    window.dispatchEvent(new CustomEvent(`nc:${topic}`, { detail }))
  } catch {
    // SSR / 不支持 CustomEvent 的环境忽略
  }
}

/** 订阅应用内主题（返回反注册函数） */
export function subscribe(topic: string, handler: (payload: any) => void): () => void {
  const key = `nc:${topic}`
  const fn = (e: Event) => {
    try { handler((e as CustomEvent).detail) } catch {}
  }
  try {
    window.addEventListener(key, fn as any)
    return () => window.removeEventListener(key, fn as any)
  } catch {
    return () => {}
  }
}

/** 新建日记成功：仅用于触发奖励 UI（与 dispatch 分离，避免强耦合） */
export function logJournalCreated(payload: JournalCreatedPayload) {
  publish('reward.journal.created', payload)
}

/** 记录/切换了心情 */
export function logMoodSelected(payload: {
  moodKey: string;          // 经过 resolveKey 的标准键
  via?: 'page' | 'shortcut' | 'auto';
}) {
  return dispatch('MOOD_SELECTED', payload);
}

/** 本轮“换一张” */
export function logBaitReroll(payload: {
  beforeKey?: string;
  afterKey?: string;
}) {
  return dispatch('BAIT_REROLL', payload);
}

/* ---------------------------------------------------------------------------------------------- */
/* HMR：开发期热更时，自动移除 console 适配器以避免重复输出                                        */
/* ---------------------------------------------------------------------------------------------- */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { unregisterAdapter('console'); } catch {}
    try { unregisterAdapter('metrics-store'); } catch {}
  });
}

/** 兼容层：将 feature 内的 'cards.*' / 'baits.*' / 'mood.*' / 'reward.*' 事件映射到本模块的枚举事件 */
export function emitAppEvent(name: string, payload?: Record<string, any>) {
  switch (name) {
    // Task-cards
    case 'cards.completed':
      return dispatch('TASK_COMPLETED', payload)
    case 'cards.reroll_used':
      return dispatch('TASK_REROLL', payload)

    // Mood-baits
    case 'baits.completed':
      return dispatch('BAIT_COMPLETED', payload)
    case 'baits.reroll_used':
      return dispatch('BAIT_REROLL', payload)

    // Mood select & Reward
    case 'mood.selected':
      return dispatch('MOOD_SELECTED', payload)
    case 'reward.accepted':
      return dispatch('REWARD_ACCEPTED', payload)

    default:
      // 未映射的事件统一打到 ERROR，便于后续观察与扩展映射表
      return dispatch('ERROR', { _unmapped: true, name, ...payload })
  }
}
