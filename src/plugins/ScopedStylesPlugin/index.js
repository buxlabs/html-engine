'use strict'

const AbstractSyntaxTree = require('abstract-syntax-tree')
const { unique } = require('pure-utilities/array')
const { extractValues, getTagValue, isCurlyTag, isSquareTag } = require('../../utilities/string')
const Plugin = require('../Plugin')
const { addScopeToCssSelectors } = require('./css')


function addScopeToHtmlClassAttribute (tag, attributes, scopes) {
  const attribute = attributes.find(attribute => attribute.key === 'class')
  const values = extractValues(attribute)
  const classes = values.reduce((strings, string) => {
    if (isCurlyTag(string)) {
      strings.push(string)
      const source = getTagValue(string)
      const tree = new AbstractSyntaxTree(source)
      tree.walk(node => {
        if (node.type === 'Literal' && typeof node.value === 'string') {
          const candidate = node.value.trim()
          if (candidate) {
            const parts = candidate.split(/\s+/g)
            scopes.forEach(scope => {
              if (scope.type === 'class' && parts.includes(scope.name)) {
                strings.unshift(scope.id)
              }
            })
          }
        }
      })
    } else if (isSquareTag(string)) {
      const isStringLiteral = (node) => {
        return node.type === 'Literal' && typeof node.value === 'string'
      }
      const isTemplateLiteral = (node) => {
        return node.type === 'TemplateLiteral'
      }
      const setScopeFromStringLiteral = (node) => {
        const candidate = node.value.trim()
        if (candidate) {
          const parts = candidate.split(/\s+/g)
          scopes.forEach(scope => {
            if (scope.type === 'class' && parts.includes(scope.name)) {
              strings.unshift(scope.id)
            }
          })
        }
      }
      const setScopeFromTemplateLiteral = (node) => {
        const { quasis } = node
        quasis.forEach(item => {
          const { raw } = item.value
          if (typeof raw === 'string') {
            const parts = raw.split(/\s+/g)
            scopes.forEach(scope => {
              if (scope.type === 'class' && parts.includes(scope.name)) {
                strings.unshift(scope.id)
              }
            })
          }
        })
      }
      const source = string
      const tree = new AbstractSyntaxTree(source)
      AbstractSyntaxTree.walk(tree, node => {
        if (isStringLiteral(node)) { setScopeFromStringLiteral(node) }
        if (isTemplateLiteral(node)) { setScopeFromTemplateLiteral(node) }
      })
      tree.body[0].expression.elements.forEach(node => {
        if (isStringLiteral(node)) {
          strings.push(node.value)
        } else {
          const expression = AbstractSyntaxTree.generate(node)
          strings.push(`{${expression}}`)
        }
      })
    } else {
      strings.push(string)
      scopes.forEach(scope => {
        if (scope.type === 'class' && scope.name === string) {
          strings.unshift(scope.id)
        }
      })
    }
    return strings
  }, [])
  scopes.forEach(scope => {
    if (scope.type === 'tag' && scope.name === tag) {
      classes.unshift(scope.id)
    }
  })
  attribute.value = unique(classes).join(' ')
}

function addClassAttributeWithScopeToHtmlTag (tag, attributes, scopes) {
  const matchesAnyScope = !!scopes.find(scope => scope.type === 'tag' && scope.name === tag)
  if (matchesAnyScope) {
    attributes.push({
      key: 'class',
      value: scopes.reduce((array, scope) => {
        if (tag === scope.name) {
          array.push(scope.id)
        }
        return array
      }, []).join(' ')
    })
  }
}

class ScopedStylesPlugin extends Plugin {
  constructor () {
    super()
    this.scopes = {}
  }

  beforeprerun () {
    this.scopes[this.depth] = []
  }

  prerun ({ tag, keys, children, attributes }) {
    if (tag === 'style' && keys.includes('scoped')) {
      children.forEach(node => addScopeToCssSelectors(node, this.scopes[this.depth], attributes))
    }
  }

  run ({ tag, keys, attributes }) {
    if (this.scopes[this.depth].length > 0) {
      if (keys && keys.includes('class')) {
        addScopeToHtmlClassAttribute(tag, attributes, this.scopes[this.depth])
      } else {
        addClassAttributeWithScopeToHtmlTag(tag, attributes, this.scopes[this.depth])
      }
    }
  }
}

module.exports = ScopedStylesPlugin
