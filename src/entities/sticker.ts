// src/entities/sticker.ts
/**
 * 贴纸实体（领域层）
 */

export type StickerId = number;

export interface Sticker {
  id: StickerId;     // 建议使用毫秒级时间戳生成
  dateISO: string;   // ISO-8601 字符串（new Date().toISOString()）
  kaomoji: string;   // 展示内容（如: "(=^･ω･^=)"）
}

/**
 * 工厂：创建一条贴纸记录
 * @param kaomoji 展示的颜文字
 * @param at 记录时间（默认当前）
 */
export function createSticker(kaomoji: string, at: Date = new Date()): Sticker {
  return {
    id: Date.now(),
    dateISO: at.toISOString(),
    kaomoji: (kaomoji ?? '').trim(),
  };
}

/**
 * 运行时类型守卫：在导入/恢复本地数据时做最小校验
 */
export function isSticker(v: unknown): v is Sticker {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<Sticker>;
  return (
    typeof o.id === 'number' &&
    typeof o.dateISO === 'string' &&
    typeof o.kaomoji === 'string'
  );
}
