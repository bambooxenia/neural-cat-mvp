// eslint.config.ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  // 忽略
  { ignores: ['dist/**', 'node_modules/**'] },

  // ✅ 直接“展开” Vue 官方 Flat 推荐配置（不要去 .rules）
  ...vue.configs['flat/recommended'],

  // ✅ 让 .ts/.tsx 用 TS 解析，并开启类型感知（避免 tsconfigRootDir 报错）
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // 可按需添加 TS 规则
      // '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    }
  },

  // ✅ 让 <script lang="ts"> 也使用 TS 解析 & 工程化配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser, // 外层解析 SFC
      parserOptions: {
        parser: tsParser, // SFC 内脚本交给 TS
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    },
    // 这里不必重复合并 vue 的推荐 rules，上面已经通过 ...vue.configs 展开了
  },
]
