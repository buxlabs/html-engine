const fs = require('fs')
const { join, dirname } = require('path')
const util = require('util')
const readFile = util.promisify(fs.readFile)
const { flatten } = require('pure-utilities/collection')
const Linter = require('./Linter')
const { isRemotePath } = require('./files')
const request = require('axios')
const URL = require('url')

const { getComponentNames, getAssetPaths, getImportNodes } = require('./node')
const parse = require('./html/parse')
const linter = new Linter()

async function loadComponent (path, isRemote, remoteUrl, paths = []) {
  if (isRemotePath(path) || isRemote) {
    try {
      const url = remoteUrl ? URL.parse(remoteUrl).protocol + '//' + join(URL.parse(remoteUrl).host, dirname(URL.parse(remoteUrl).pathname), path) : path
      const response = await request.get(url)
      if (response.status === 200) {
        let buffer = Buffer.from('') // TODO: parse response to the buffer
        let base64 = '' // TODO: find a good way to change data to base64, like readFile
        return {
          path,
          source: response.data,
          buffer,
          base64,
          remote: true,
          url
        }
      }
    } catch (exception) {}
  } else {
    for (let option of paths) {
      try {
        const location = join(option, path)
        const result = {}
        result.path = location
        result.buffer = await readFile(location)
        result.base64 = await readFile(location, 'base64')
        // TODO: Read once convert base64
        result.source = await readFile(location, 'utf8')
        result.remote = false
        return result
      } catch (exception) {}
    }
  }
  return {}
}

async function fetch (node, kind, context, isRemote, remoteUrl, options) {
  const paths = options.paths || []
  const names = kind === 'IMPORT' ? getComponentNames(node) : ['']
  return Promise.all(names.map(async name => {
    const type = kind === 'IMPORT' ? 'COMPONENT' : kind
    const dir = dirname(context)
    const assetPaths = getAssetPaths(node, name)
    return Promise.all(assetPaths.map(async assetPath => {
      const { source, path, base64, remote, url, buffer } = await loadComponent(assetPath, isRemote, remoteUrl, [dir, ...paths])
      if (!path) {
        return {
          warnings: [{ type: 'COMPONENT_NOT_FOUND', message: `Component not found: ${name}` }]
        }
      }
      const tree = parse(source)
      const files = [context]
      const warnings = []
      return { name, source, base64, remote, url, buffer, path, files, warnings, tree, type }
    }))
  }))
}
const MAXIMUM_IMPORT_DEPTH = 50
async function recursiveImport (tree, source, path, options, depth, remote, url) {
  if (depth > MAXIMUM_IMPORT_DEPTH) {
    return {
      assets: [],
      warnings: [{ type: 'MAXIMUM_IMPORT_DEPTH_EXCEEDED', message: 'Maximum import depth exceeded' }]
    }
  }
  const imports = getImportNodes(tree, options)
  const warnings = linter.lint(tree, source, imports.map(({ node }) => node))
  const assets = await Promise.all(imports.map(({ node, kind }) => fetch(node, kind, path, remote, url, options)))
  const current = flatten(assets)
  const nested = await Promise.all(current.filter(element => element.tree).map(async element => {
    return recursiveImport(element.tree, element.source, element.path, options, depth + 1, element.remote, element.url)
  }))
  let nestedAssets = current.concat(flatten(nested.map(object => object.assets)))
  nestedAssets = mergeAssets(nestedAssets)
  const nestedWarnings = warnings.concat(flatten(nested.map(object => object.warnings)))
  return {
    assets: nestedAssets,
    warnings: nestedWarnings.concat(flatten(nestedAssets.map(file => file.warnings)))
  }
}

function mergeAssets (assets) {
  const object = {}
  assets.forEach(component => {
    const { path, files } = component
    if (!object[path]) {
      object[path] = component
    } else {
      object[path].files = [...object[path].files, ...files]
    }
  })
  return Object.values(object)
}

module.exports = class Importer {
  constructor (source, options = {}) {
    this.source = source
    this.tree = parse(source)
    this.options = options
  }
  async import () {
    return recursiveImport(this.tree, this.source, '.', this.options, 0, false, null)
  }
}
