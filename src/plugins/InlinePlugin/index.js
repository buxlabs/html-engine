'use strict'

const Plugin = require('../Plugin')
const { convertElementValueToBase64, prepareStyles, applyStylesInFragment, removeEmptyStyleTag } = require('./css')

class InlinePlugin extends Plugin {
  constructor () {
    super()
    this.styles = []
  }

  beforeprerun () {
    this.styles = []
  }

  prerun ({ fragment, keys, assets, options }) {
    if (fragment.tagName === 'style' && keys.includes('inline')) {
      const child = fragment.children[0]
      const { styles, output } = prepareStyles(child.content, assets, options)
      styles.forEach(style => this.styles.push(style))
      child.content = output
    }
  }

  run ({ fragment, keys, assets, options }) {
    if (fragment.tagName === 'font' && keys.includes('inline')) {
      const attribute = fragment.attributes.find(attribute => attribute.key === 'from')
      convertElementValueToBase64({ element: attribute, value: attribute.value, assets, options, isFont: true })
    }
    if (fragment.type === 'element' && fragment.tagName !== 'style' && this.styles.length) {
      applyStylesInFragment(fragment, this.styles)
    }
    if (fragment.tagName === 'style') {
      removeEmptyStyleTag(fragment)
    }
  }
}

module.exports = InlinePlugin
