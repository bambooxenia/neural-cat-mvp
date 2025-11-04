// src/entities/task.ts
export type Domain = string
export type TaskCard = {
  id: number
  title: string
  domain: Domain
  minutes: 5 | 10
  typeTag?: string
}
export type UserTaskCard = Omit<TaskCard, 'typeTag'> & { typeTag: string }

// —— 系统内置任务池（可扩充/本地化） —— //
export const TASK_POOL: TaskCard[] = [
  // study 学习
  { id: 101, title: '背 20 个单词（或复习 1 组卡片）', domain: 'study', minutes: 10 },
  { id: 102, title: '大声朗读外语段落 3 段并录音',      domain: 'study', minutes: 10 },
  { id: 103, title: '看一小节语法/短视频学习笔记',      domain: 'study', minutes: 5  },
  { id: 104, title: '10 分钟听力跟读（字幕跟拍）',      domain: 'study', minutes: 10 },
  { id: 105, title: '写 5 句外语造句（同一结构）',        domain: 'study', minutes: 5  },

  // clean 整理
  { id: 201, title: '清理桌面 A5 区域的一切杂物',         domain: 'clean', minutes: 5  },
  { id: 202, title: '下载夹删除或归档 10 个文件',         domain: 'clean', minutes: 10 },
  { id: 203, title: '分类收纳散落的纸张/票据',           domain: 'clean', minutes: 10 },
  { id: 204, title: '把待洗衣物集中到筐里并分类',         domain: 'clean', minutes: 5  },

  // write 写作
  { id: 301, title: '为当前主题写 5 句自由联想',           domain: 'write', minutes: 5  },
  { id: 302, title: '列一个 6 条的提纲/要点清单',          domain: 'write', minutes: 10 },
  { id: 303, title: '补写 1 段 80–120 字的草稿',           domain: 'write', minutes: 10 },
  { id: 304, title: '写 3 句奇迹日记或复盘',               domain: 'write', minutes: 5  },

  // move 运动
  { id: 401, title: '原地快走/室内踏步 600 步',           domain: 'move',  minutes: 10 },
  { id: 402, title: '颈肩拉伸 + 胸椎旋转',                 domain: 'move',  minutes: 5  },
  { id: 403, title: '俯卧撑/深蹲 任一 2 组',               domain: 'move',  minutes: 5  },
  { id: 404, title: '核心激活：平板支撑间歇',               domain: 'move',  minutes: 10 },
]
