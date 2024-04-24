import path from 'path'
import { createFilter } from '@rollup/pluginutils'
import stylex from '@stylexjs/babel-plugin'
import type { Rule } from '@stylexjs/babel-plugin'
import type { RollupPluginContext, StylexPluginOptions } from '../interface'
import { slash } from '../shared'
import { scanImportStmt } from './import-stmt'
import type { ImportSpecifier } from './import-stmt'

export type ENV = 'dev' | 'prod'

type Options = Required<Pick<StylexPluginOptions, 'useCSSLayers' | 'importSources'>> & Pick<StylexPluginOptions, 'include' | 'exclude'>

function handleRelativePath(from: string, to: string) {
  const relativePath = path.relative(path.dirname(from), to).replace(/\.\w+$/, '')
  return `./${slash(relativePath)}`
}

export class StateContext {
  styleRules: Map<string, Rule[]>
  stylexOptions: Options
  env: ENV
  #filter: ReturnType<typeof createFilter> | null
  #pluginContext: RollupPluginContext | null
  stmts: ImportSpecifier[]
  constructor() {
    this.#filter = null
    this.#pluginContext = null
    this.styleRules = new Map()
    this.stylexOptions = Object.create(null)
    this.env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    this.stmts = []
  }

  send() {

  }

  recover() {

  }

  setupOptions(options: Options) {
    this.stylexOptions = options
    this.#filter = createFilter(options.include, options.exclude)
  }

  setupPluginContext(pluginContext: RollupPluginContext) {
    if (this.#pluginContext) return
    this.#pluginContext = pluginContext
  }

  get importSources() {
    if (!this.stylexOptions.importSources) throw new Error('[vite-plugin-stylex-dev]: Missing "importSources" in options')
    return this.stylexOptions.importSources
  }

  skipResolve(code: string, id: string): boolean {
    if (!this.#filter!(id) || id.startsWith('\0')) return true
    const stmts = scanImportStmt(code, this.#pluginContext!)
    for (const stmt of stmts) {
      const { n } = stmt
      if (n && this.importSources.some(i => !path.isAbsolute(n) && n.includes(typeof i === 'string' ? i : i.from))) {
        return false
      }
    }
    this.stmts = stmts
    return true
  }

  async rewriteImportStmts(code: string, id: string) {
    for (const stmt of this.stmts) {
      if (!stmt.n) continue
      if (path.isAbsolute(stmt.n) || stmt.n[0] === '.') continue
      if (!this.importSources.some(i => stmt.n!.includes(typeof i === 'string' ? i : i.from))) continue
      const resolved = await this.#pluginContext!.resolve(stmt.n, id)
      if (resolved && resolved.id && !resolved.external) {
        if (resolved.id === stmt.n) continue
        if (!resolved.id.includes('node_modules')) {
          const next = handleRelativePath(id, resolved.id)
          code = code.substring(0, stmt.s) + next + code.substring(stmt.e)
        }
      }
    }
    this.stmts = []
    return code
  }

  processCSS(): string {
    if (!this.styleRules.size) return ''
    const { useCSSLayers } = this.stylexOptions
    return stylex.processStylexRules([...this.styleRules.values()].flat().filter(Boolean), useCSSLayers)
  }

  destroy() {
    this.#filter = null
    this.#pluginContext = null
    this.styleRules.clear()
  }
}

export function createStateContext() {
  return new StateContext()
}