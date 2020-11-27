'use strict'

function render (node) {
  if (typeof node === 'string') {
    return renderText(node)
  }
  return renderElement(node)
}

function renderText (node) {
  return document.createTextNode(node)
}

function renderElement (node) {
  const { name, attributes, children } = node
  const element = document.createElement(name)

  for (const key in attributes) {
    const value = attributes[key]
    if (key === 'onclick') {
      // setting event handlers like this is
      // not efficient, e.g. for lists of items
      // it would be better to have one global handler
      element.addEventListener('click', value)
    } else {
      element.setAttribute(key, value)
    }
  }

  for (let i = 0, ilen = children.length; i < ilen; i++) {
    const child = children[i]
    element.appendChild(render(child))
  }

  return element
}

module.exports = render
