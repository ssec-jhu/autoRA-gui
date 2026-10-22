/**
 * JsonGenerator.js
 *
 * Generates an AutoRA component JSON file (matching the schema of the files in
 * autora_gui/JSON/components/) from a GitHub link to the Python function or
 * class implementing the component, e.g.
 *
 *   https://github.com/AutoResearch/autora-experimentalist-bandit-random/blob/main/src/autora/experimentalist/bandit_random/__init__.py#L137
 *
 * The linked source file is fetched from GitHub, the function/class signature
 * and docstring are parsed, and a component description is assembled:
 *   - protocolType / target subfolder from the import path
 *     (experimentalist -> experimentalists, theorist -> theorists,
 *      experiment_runner -> experiment_runners)
 *   - parameters grouped by function name (or __init__/fit for classes,
 *     plus a "run" group for synthetic runner factories)
 *   - inputDataType / outputDataType from data-like arguments and the
 *     Returns section of the docstring
 *   - pipInstall resolved from the repo's pyproject.toml and PyPI
 *
 * CLI usage (from autora_gui/react_app):
 *   node src/utils/JsonGenerator.js <github-url> [--out <dir>] [--force] [--dry-run]
 *
 * By default the file is written to autora_gui/JSON/components/<subfolder>/.
 * Generated descriptions come from docstrings and may deserve a manual polish.
 */

// ---------------------------------------------------------------------------
// GitHub URL handling
// ---------------------------------------------------------------------------

export function parseGithubUrl(url) {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:#L(\d+))?$/
  )
  if (!match) {
    throw new Error(
      `Not a recognizable GitHub file link: ${url}\n` +
      'Expected https://github.com/<owner>/<repo>/blob/<ref>/<path>#L<line>'
    )
  }
  const [, owner, repo, ref, filePath, line] = match
  return {
    owner,
    repo,
    ref,
    filePath,
    line: line ? parseInt(line, 10) : 1,
    rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`
  }
}

export function deriveImportPath(filePath) {
  let path = filePath
  const srcIdx = path.indexOf('src/')
  if (srcIdx !== -1) path = path.slice(srcIdx + 4)
  path = path.replace(/\/__init__\.py$/, '').replace(/\.py$/, '')
  return path.replace(/\//g, '.')
}

export function deriveCategory(importPath, kind) {
  if (importPath.includes('experiment_runner')) {
    return { protocolType: 'experiment_runner', folder: 'experiment_runners' }
  }
  if (importPath.includes('.theorist')) {
    return { protocolType: 'theorist', folder: 'theorists' }
  }
  if (importPath.includes('.experimentalist')) {
    return { protocolType: 'experimentalist', folder: 'experimentalists' }
  }
  // fall back on the shape of the definition: classes are regressor-style
  return kind === 'class'
    ? { protocolType: 'theorist', folder: 'theorists' }
    : { protocolType: 'experimentalist', folder: 'experimentalists' }
}

// ---------------------------------------------------------------------------
// Python source parsing
// ---------------------------------------------------------------------------

const DEF_RE = /^(\s*)(?:async\s+)?(def|class)\s+(\w+)/

function indentOf(line) {
  return line.match(/^(\s*)/)[1].length
}

/**
 * Split a string on top-level commas (ignoring commas inside brackets/quotes).
 */
export function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let quote = null
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      current += ch
      if (ch === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/**
 * Parse one signature entry into { name, annotation, defaultText }.
 * Returns null for self/cls and *args/**kwargs style entries.
 */
export function parseParam(text) {
  const trimmed = text.trim()
  if (!trimmed || trimmed === '*' || trimmed === '/') return null
  if (trimmed.startsWith('*')) return null

  let depth = 0
  let quote = null
  let colonPos = -1
  let eqPos = -1
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (quote) {
      if (ch === quote && trimmed[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; continue }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (depth === 0) {
      if (ch === ':' && colonPos === -1) colonPos = i
      if (ch === '=' && eqPos === -1) eqPos = i
    }
  }

  let name, annotation = null, defaultText
  if (eqPos !== -1) {
    defaultText = trimmed.slice(eqPos + 1).trim()
  }
  const head = eqPos !== -1 ? trimmed.slice(0, eqPos) : trimmed
  if (colonPos !== -1 && colonPos < (eqPos === -1 ? trimmed.length : eqPos)) {
    name = head.slice(0, colonPos).trim()
    annotation = head.slice(colonPos + 1).trim()
  } else {
    name = head.trim()
  }
  if (!name || name === 'self' || name === 'cls') return null
  return { name, annotation, defaultText }
}

/**
 * Parse a Python literal into a JSON value. Returns undefined for
 * non-literal expressions (module constants, list comprehensions, ...).
 */
export function parsePythonLiteral(text) {
  if (text === undefined || text === null) return undefined
  const t = text.trim()
  if (t === 'None') return null
  if (t === 'True') return true
  if (t === 'False') return false
  if (/^-?\d+$/.test(t)) return parseInt(t, 10)
  if (/^-?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(t) && t.match(/[.eE]/)) {
    return parseFloat(t)
  }
  const str = t.match(/^(["'])(.*)\1$/)
  if (str) return str[2]
  return undefined
}

/**
 * Locate the def/class the linked line refers to. Handles the line pointing
 * at an alias assignment (pool = bandit_random_pool) or into the body of the
 * definition (searches upward for the nearest def/class).
 */
export function findDefinition(source, lineNumber) {
  const lines = source.split('\n')
  let idx = Math.min(Math.max((lineNumber || 1) - 1, 0), lines.length - 1)

  if (!DEF_RE.test(lines[idx])) {
    const alias = lines[idx].match(/^(\w+)\s*=\s*(\w+)\s*(#.*)?$/)
    if (alias) {
      const targetRe = new RegExp(`^\\s*(?:async\\s+)?def\\s+${alias[2]}\\b`)
      const target = lines.findIndex(l => targetRe.test(l))
      if (target !== -1) idx = target
    }
  }
  while (idx > 0 && !DEF_RE.test(lines[idx])) idx--

  const match = lines[idx].match(DEF_RE)
  if (!match) {
    throw new Error(`No function or class definition found at or above line ${lineNumber}`)
  }
  return { lines, index: idx, indent: match[1].length, kind: match[2], name: match[3] }
}

/**
 * Read a def/class header starting at lines[index]: returns the text between
 * the header parentheses and the index of the line the header ends on.
 */
function readHeader(lines, index) {
  let text = ''
  let endIndex = index
  for (let i = index; i < lines.length; i++) {
    text += (i > index ? '\n' : '') + lines[i]
    endIndex = i
    // header is complete once brackets balance out and the line ends with ':'
    let depth = 0
    let quote = null
    for (let j = 0; j < text.length; j++) {
      const ch = text[j]
      if (quote) {
        if (ch === quote && text[j - 1] !== '\\') quote = null
        continue
      }
      if (ch === '"' || ch === "'") { quote = ch; continue }
      if ('([{'.includes(ch)) depth++
      else if (')]}'.includes(ch)) depth--
    }
    if (depth === 0 && /:\s*(#.*)?$/.test(text)) break
  }
  const open = text.indexOf('(')
  let signature = ''
  if (open !== -1) {
    let depth = 0
    let quote = null
    for (let j = open; j < text.length; j++) {
      const ch = text[j]
      if (quote) {
        if (ch === quote && text[j - 1] !== '\\') quote = null
        signature += ch
        continue
      }
      if (ch === '"' || ch === "'") { quote = ch; signature += ch; continue }
      if ('([{'.includes(ch)) {
        depth++
        if (depth === 1) continue
      } else if (')]}'.includes(ch)) {
        depth--
        if (depth === 0) break
      }
      signature += ch
    }
  }
  return { signature: signature.replace(/\n/g, ' '), endIndex }
}

/** Index of the first line after the block that starts at defIndex. */
function blockEnd(lines, defIndex, headerEndIndex, defIndent) {
  for (let i = headerEndIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue
    if (indentOf(lines[i]) <= defIndent) return i
  }
  return lines.length
}

/** Extract a docstring immediately following the header, if any. */
function readDocstring(lines, headerEndIndex, endIndex) {
  let i = headerEndIndex + 1
  while (i < endIndex && lines[i].trim() === '') i++
  if (i >= endIndex) return ''
  const open = lines[i].match(/^\s*[rRbBuUfF]*("""|''')/)
  if (!open) return ''
  const delim = open[1]
  let text = lines[i].slice(lines[i].indexOf(delim) + 3)
  if (text.includes(delim)) {
    return text.slice(0, text.indexOf(delim))
  }
  const collected = [text]
  for (let j = i + 1; j < endIndex; j++) {
    const line = lines[j]
    if (line.includes(delim)) {
      collected.push(line.slice(0, line.indexOf(delim)))
      break
    }
    collected.push(line)
  }
  return collected.join('\n')
}

/**
 * Parse a def/class at the linked line into a normalized description:
 *   function -> { kind, name, params, docstring, body }
 *   class    -> { kind, name, docstring, methods: { __init__, fit, ... } }
 */
export function extractDefinition(source, lineNumber) {
  const { lines, index, indent, kind, name } = findDefinition(source, lineNumber)
  const { signature, endIndex } = readHeader(lines, index)
  const end = blockEnd(lines, index, endIndex, indent)
  const docstring = readDocstring(lines, endIndex, end)

  if (kind === 'def') {
    return {
      kind: 'function',
      name,
      params: splitTopLevel(signature).map(parseParam).filter(Boolean),
      docstring,
      body: lines.slice(endIndex + 1, end)
    }
  }

  // class: collect direct methods
  const methods = {}
  for (let i = endIndex + 1; i < end; i++) {
    const m = lines[i].match(DEF_RE)
    if (!m || m[2] !== 'def') continue
    if (indentOf(lines[i]) <= indent) break
    const header = readHeader(lines, i)
    const methodEnd = blockEnd(lines, i, header.endIndex, indentOf(lines[i]))
    methods[m[3]] = {
      name: m[3],
      params: splitTopLevel(header.signature).map(parseParam).filter(Boolean),
      docstring: readDocstring(lines, header.endIndex, methodEnd)
    }
    i = methodEnd - 1
  }
  return { kind: 'class', name, docstring, methods }
}

/**
 * Extract IV(...)/DV(...) variable declarations from a synthetic runner
 * factory body: [{ role: 'IV'|'DV', name, label }].
 */
export function extractVariableDefs(bodyLines) {
  const text = bodyLines.join('\n')
  const variables = []
  const callRe = /\b(IV|DV)\s*\(/g
  let call
  while ((call = callRe.exec(text)) !== null) {
    let depth = 1
    let end = callRe.lastIndex
    while (end < text.length && depth > 0) {
      const ch = text[end]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      end++
    }
    const argsText = text.slice(callRe.lastIndex, end - 1)
    const name = argsText.match(/\bname\s*=\s*["']([^"']+)["']/)
    const label = argsText.match(/\bvariable_label\s*=\s*["']([^"']+)["']/)
    if (name) {
      variables.push({ role: call[1], name: name[1], label: label ? label[1] : '' })
    }
  }
  return variables
}

/** Find a nested `def run(...)` inside a factory function body (synthetic runners). */
export function extractNestedRun(bodyLines) {
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(/^(\s*)def\s+run\s*\(/)
    if (!m) continue
    const { signature, endIndex } = readHeader(bodyLines, i)
    const end = blockEnd(bodyLines, i, endIndex, m[1].length)
    return {
      name: 'run',
      params: splitTopLevel(signature).map(parseParam).filter(Boolean),
      docstring: readDocstring(bodyLines, endIndex, end)
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Docstring parsing (Google style: Args/Arguments + Returns sections)
// ---------------------------------------------------------------------------

const SECTION_RE = /^\s*(Args|Arguments|Parameters|Returns?|Yields?|Raises|Examples?|Attributes|Notes?)\s*:\s*(.*)$/

export function parseDocstring(docstring, paramNames = []) {
  const lines = (docstring || '').split('\n')
  const summaryLines = []
  const argLines = []
  const returnLines = []
  let section = 'summary'

  for (const line of lines) {
    const header = line.match(SECTION_RE)
    if (header) {
      const key = header[1].toLowerCase()
      if (key.startsWith('arg') || key === 'parameters') section = 'args'
      else if (key.startsWith('return')) section = 'returns'
      else section = 'other'
      // inline form: "Returns: Sampled conditions"
      if (header[2] && section === 'returns') returnLines.push(header[2])
      continue
    }
    if (section === 'summary') summaryLines.push(line)
    else if (section === 'args') argLines.push(line)
    else if (section === 'returns') returnLines.push(line)
  }

  // summary: first paragraph, collapsed to one line
  const paragraphs = summaryLines
    .join('\n')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const summary = paragraphs[0] || ''

  // args: attribute continuation lines to the entry above them
  const args = {}
  let currentArg = null
  const names = new Set(paramNames)
  for (const line of argLines) {
    const entry = line.match(/^\s*(\w+)(?:\s*\([^)]*\))?\s*:\s*(.*)$/)
    if (entry && names.has(entry[1])) {
      currentArg = entry[1]
      args[currentArg] = entry[2].trim()
    } else if (currentArg && line.trim()) {
      args[currentArg] += ' ' + line.trim()
    }
  }

  const returnsText = returnLines.map(l => l.trim()).filter(Boolean).join(' ')
  const named = returnsText.match(/^(\w+)\s*:\s*(.+)$/)
  const returns = returnsText
    ? { name: named ? named[1] : null, description: (named ? named[2] : returnsText).trim() }
    : null

  return { summary, args, returns }
}

// ---------------------------------------------------------------------------
// Datatype inference
// ---------------------------------------------------------------------------

// datatypes for well-known parameter names when the source has no annotation
const KNOWN_PARAM_DATATYPES = {
  num_samples: 'integer',
  random_state: 'integer',
  epochs: 'integer',
  resolution: 'integer',
  plot: 'boolean',
  verbose: 'boolean'
}

export function inferDatatype(annotation, defaultText, paramName) {
  const ann = annotation || ''
  const literal = ann.match(/Literal\s*\[([^\]]*)\]/)
  if (literal) {
    const values = splitTopLevel(literal[1])
      .map(v => parsePythonLiteral(v))
      .filter(v => v !== undefined)
    return { datatype: 'categorical', validValues: values.length ? values : null }
  }
  if (/\bbool\b/.test(ann)) return { datatype: 'boolean', validValues: null }
  if (/\bint\b/.test(ann)) return { datatype: 'integer', validValues: null }
  if (/\bfloat\b/.test(ann)) return { datatype: 'real', validValues: null }
  if (/\bstr\b/.test(ann)) return { datatype: 'string', validValues: null }
  if (/\b(Iterable|List|Sequence|ndarray|DataFrame|Series|array)\b/i.test(ann)) {
    return { datatype: 'real', validValues: null }
  }
  // no usable annotation: fall back to the default value's literal form,
  // which preserves int/float distinctions JSON numbers would lose (1 vs 1.0)
  const text = (defaultText || '').trim()
  if (text === 'True' || text === 'False') return { datatype: 'boolean', validValues: null }
  if (/^-?\d+$/.test(text)) return { datatype: 'integer', validValues: null }
  if (/^-?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(text) || /^-?\d+[eE][+-]?\d+$/.test(text)) {
    return { datatype: 'real', validValues: null }
  }
  if (/^(["']).*\1$/.test(text)) return { datatype: 'string', validValues: null }
  if (KNOWN_PARAM_DATATYPES[paramName]) {
    return { datatype: KNOWN_PARAM_DATATYPES[paramName], validValues: null }
  }
  return { datatype: 'string', validValues: null }
}

function isOptional(param, defaultValue) {
  return defaultValue === null && param.defaultText !== undefined
    ? true
    : /Optional\s*\[/.test(param.annotation || '') || param.defaultText === 'None'
}

// dict/callable parameters are not settable from the GUI; skip them the way
// the hand-written JSONs do (e.g. BMSRegressor.prior_par)
function isGuiSettable(param) {
  return !/\b(dict|Dict|Mapping|Callable)\b/.test(param.annotation || '')
}

// Arguments that carry data flowing through the workflow state rather than
// configuration; they populate inputDataType instead of parameters.
const DATA_PARAM_NAMES = new Set([
  'conditions', 'reference_conditions', 'reference_observations',
  'experiment_data', 'model', 'models', 'variables', 'ivs',
  'X', 'x', 'Y', 'y'
])

const DATA_PARAM_DESCRIPTIONS = {
  conditions: 'Pool of candidate experimental conditions to evaluate.',
  reference_conditions: 'Existing experimental conditions to compare against.',
  reference_observations: 'Observations corresponding to the reference conditions.',
  experiment_data: 'Collected experimental data.',
  model: 'Trained model from the workflow state.',
  models: 'Trained models from the workflow state.',
  variables: 'Variable collection defining the experimental space.',
  ivs: 'Independent variables defining the experimental space.',
  X: 'Input features as a 2D array.',
  Y: 'Target values corresponding to the conditions.',
  y: 'Target values corresponding to the conditions.'
}

function toParameterSpec(param, argDescriptions) {
  const defaultValue = parsePythonLiteral(param.defaultText)
  let { datatype, validValues } = inferDatatype(param.annotation, param.defaultText, param.name)
  let description = argDescriptions[param.name] || ''

  // docstrings often enumerate string options as "Options: - `'a'`: ... - `'b'`: ..."
  if (datatype === 'string' && /Options?\s*:/i.test(description)) {
    const options = [...description.matchAll(/`?'([\w-]+)'`?/g)].map(m => m[1])
    if (options.length > 1) {
      datatype = 'categorical'
      validValues = [...new Set(options)]
      description = description.replace(/\s*Options?\s*:.*$/is, '').trim()
      if (description && !description.endsWith('.')) description += '.'
    }
  }

  return {
    name: param.name,
    description,
    datatype,
    cardinality: {
      minOccurs: isOptional(param, defaultValue) ? 0 : 1,
      maxOccurs: 1,
      unique: true
    },
    validValues,
    default: defaultValue === undefined ? null : defaultValue
  }
}

function toDataSpec(param, argDescriptions) {
  const objectLike = /model|variables|ivs/.test(param.name.toLowerCase())
  return {
    name: param.name,
    description: argDescriptions[param.name] || DATA_PARAM_DESCRIPTIONS[param.name] || '',
    datatype: objectLike && !/^(ivs)$/.test(param.name) ? 'string' : 'real',
    cardinality: {
      minOccurs: 1,
      maxOccurs: /^(model|variables)$/.test(param.name) ? 1 : -1,
      unique: /model/.test(param.name.toLowerCase()) || /^variables$/.test(param.name)
    },
    validValues: null,
    default: null
  }
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

const SUFFIX_MAP = { pool: 'pooler', sample: 'sampler' }

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function displayName(definition, importPath) {
  if (definition.kind === 'class') {
    const words = definition.name.match(/[A-Z]+(?=[A-Z][a-z])|[A-Z][a-z]+|[A-Z]+|[a-z]+|\d+/g) || [definition.name]
    return words.join(' ')
  }
  const modWords = importPath.split('.').pop().split('_').filter(Boolean)
  const funcWords = definition.name.split('_').filter(Boolean)

  // avoid repeating shared words: "weber_fechner_law" + "weber_fechner_law",
  // "grid" + "grid_pool", "prediction_filter" + "filter"
  const startsWith = (arr, prefix) => prefix.every((w, i) => arr[i] === w)
  const endsWith = (arr, suffix) =>
    suffix.every((w, i) => arr[arr.length - suffix.length + i] === w)

  let words
  if (startsWith(funcWords, modWords)) words = [...funcWords]
  else if (endsWith(modWords, funcWords)) words = [...modWords]
  else words = [...modWords, ...funcWords]

  const last = words[words.length - 1]
  if (SUFFIX_MAP[last]) words[words.length - 1] = SUFFIX_MAP[last]
  return words.map(capitalize).join(' ')
}

export function fileNameFor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.json'
}

// ---------------------------------------------------------------------------
// Component assembly
// ---------------------------------------------------------------------------

function buildFunctionComponent(definition, doc, protocolType) {
  const isRunner = protocolType === 'experiment_runner'
  const configParams = []
  const dataParams = []
  for (const param of definition.params) {
    if (DATA_PARAM_NAMES.has(param.name)) dataParams.push(param)
    // a runner factory's `name` argument is a display label, not a setting
    else if (isGuiSettable(param) && !(isRunner && param.name === 'name')) {
      configParams.push(param)
    }
  }

  const parameters = { [definition.name]: configParams.map(p => toParameterSpec(p, doc.args)) }

  let variableDefs = []
  if (isRunner) {
    const run = extractNestedRun(definition.body || [])
    if (run) {
      const runDoc = parseDocstring(run.docstring, run.params.map(p => p.name))
      parameters.run = run.params
        .filter(p => !DATA_PARAM_NAMES.has(p.name) && isGuiSettable(p))
        .map(p => toParameterSpec(p, { ...doc.args, ...runDoc.args }))
    }
    variableDefs = extractVariableDefs(definition.body || [])
  }

  const variableSpec = v => ({
    name: v.name,
    description: v.label || '',
    datatype: 'real',
    cardinality: { minOccurs: 1, maxOccurs: -1, unique: false },
    validValues: null,
    default: null
  })
  const ivs = variableDefs.filter(v => v.role === 'IV')
  const dv = variableDefs.find(v => v.role === 'DV')

  let inputDataType = null
  if (ivs.length === 1) {
    inputDataType = variableSpec(ivs[0])
  } else if (ivs.length > 1) {
    inputDataType = { variables: ivs.map(variableSpec) }
  } else if (dataParams.length === 1) {
    inputDataType = toDataSpec(dataParams[0], doc.args)
  } else if (dataParams.length > 1) {
    inputDataType = { variables: dataParams.map(p => toDataSpec(p, doc.args)) }
  }

  const outputDataType = dv ? variableSpec(dv) : {
    name: doc.returns?.name || 'conditions',
    description: doc.returns?.description || 'Generated experimental conditions.',
    datatype: 'real',
    cardinality: { minOccurs: 1, maxOccurs: -1, unique: false },
    validValues: null,
    default: null
  }

  return { parameters, inputDataType, outputDataType }
}

function buildClassComponent(definition) {
  const parameters = {}
  const init = definition.methods.__init__
  if (init) {
    const initDoc = parseDocstring(init.docstring, init.params.map(p => p.name))
    parameters.__init__ = init.params
      .filter(isGuiSettable)
      .map(p => toParameterSpec(p, initDoc.args))
  }
  const fit = definition.methods.fit
  let fitDoc = { args: {} }
  if (fit) {
    fitDoc = parseDocstring(fit.docstring, fit.params.map(p => p.name))
    const fitParams = fit.params
      .filter(p => !DATA_PARAM_NAMES.has(p.name) && p.annotation && isGuiSettable(p))
      .map(p => toParameterSpec(p, fitDoc.args))
    if (fitParams.length) parameters.fit = fitParams
  }

  const inputDataType = {
    name: 'X',
    description: fitDoc.args.X || 'Input features as a 2D array.',
    datatype: 'real',
    cardinality: { minOccurs: 1, maxOccurs: -1, unique: false },
    validValues: null,
    default: null
  }
  const outputDataType = {
    name: 'y',
    description: 'Predicted target values.',
    datatype: 'real',
    cardinality: { minOccurs: 1, maxOccurs: -1, unique: false },
    validValues: null,
    default: null
  }

  return { parameters, inputDataType, outputDataType }
}

export function buildComponent({ url, source, uuid }) {
  const link = parseGithubUrl(url)
  const importPath = deriveImportPath(link.filePath)
  const definition = extractDefinition(source, link.line)
  const { protocolType, folder } = deriveCategory(importPath, definition.kind)
  const doc = parseDocstring(
    definition.docstring,
    definition.kind === 'function' ? definition.params.map(p => p.name) : []
  )

  const parts = definition.kind === 'class'
    ? buildClassComponent(definition)
    : buildFunctionComponent(definition, doc, protocolType)

  const name = displayName(definition, importPath)
  const component = {
    uuid,
    protocolType,
    name,
    description: doc.summary || `${name} component.`,
    githubCommit: url,
    pythonName: definition.name,
    importPath,
    pipInstall: link.repo,
    ...parts
  }
  return { component, folder, fileName: fileNameFor(name), link }
}

// ---------------------------------------------------------------------------
// Network assembly (fetch source + resolve pip install spec)
// ---------------------------------------------------------------------------

async function fetchText(fetchImpl, url) {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

export async function resolvePipInstall(link, fetchImpl) {
  let packageName = link.repo
  try {
    const pyproject = await fetchText(
      fetchImpl,
      `https://raw.githubusercontent.com/${link.owner}/${link.repo}/${link.ref}/pyproject.toml`
    )
    const name = pyproject.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
    if (name) packageName = name[1]
  } catch {
    // keep the repo name as the package name
  }
  try {
    const res = await fetchImpl(`https://pypi.org/pypi/${packageName}/json`)
    if (res.ok) {
      const data = await res.json()
      const version = data?.info?.version
      if (version) return `${packageName}==${version}`
    }
  } catch {
    // fall through to unpinned spec
  }
  return packageName
}

/**
 * Build the component JSON for a GitHub function link.
 * Returns { component, folder, fileName }.
 */
export async function createComponentJson(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  const uuid = options.uuid || globalThis.crypto.randomUUID()
  const link = parseGithubUrl(url)
  const source = await fetchText(fetchImpl, link.rawUrl)
  const result = buildComponent({ url, source, uuid })
  result.component.pipInstall = await resolvePipInstall(link, fetchImpl)
  return result
}

// ---------------------------------------------------------------------------
// CLI (Node only): write the JSON into autora_gui/JSON/components/<folder>/
// ---------------------------------------------------------------------------

async function main() {
  const [, , ...argv] = process.argv
  const args = { positional: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i]
    else if (argv[i] === '--force') args.force = true
    else if (argv[i] === '--dry-run') args.dryRun = true
    else args.positional.push(argv[i])
  }
  const url = args.positional[0]
  if (!url) {
    console.error(
      'Usage: node JsonGenerator.js <github-function-url> [--out <dir>] [--force] [--dry-run]'
    )
    process.exit(1)
  }

  const { component, folder, fileName } = await createComponentJson(url)
  const json = JSON.stringify(component, null, 2) + '\n'

  if (args.dryRun) {
    console.log(`# -> ${folder}/${fileName}`)
    console.log(json)
    return
  }

  const path = await import('node:path')
  const fs = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const componentsRoot = args.out
    ? path.resolve(args.out)
    : path.resolve(here, '../../../JSON/components')
  const targetDir = args.out ? componentsRoot : path.join(componentsRoot, folder)
  const targetPath = path.join(targetDir, fileName)

  if (fs.existsSync(targetPath) && !args.force) {
    console.error(`Refusing to overwrite existing ${targetPath} (use --force)`)
    process.exit(1)
  }
  fs.mkdirSync(targetDir, { recursive: true })
  fs.writeFileSync(targetPath, json)
  console.log(`Created ${targetPath}`)
}

const isNode = typeof process !== 'undefined' && !!process.versions?.node
if (isNode && process.argv[1] && /JsonGenerator\.js$/.test(process.argv[1])) {
  main().catch(err => {
    console.error(err.message)
    process.exit(1)
  })
}
