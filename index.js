const { parseFragment } = require('parse5')
const AbstractSyntaxTree = require('@buxlabs/ast')

function walk(node, callback) {
  callback(node)
  if (node.childNodes) {
    let child = node.childNodes[0]
    let i = 0
    while (child) {
      walk(child, callback)
      child = node.childNodes[++i]
    }
  }
}

class Tree extends AbstractSyntaxTree {
  getTemplateAssignmentExpression (node) {
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '+=',
        left: {
          type: 'Identifier',
          name: 't'
        },
        right: node
      }
    }
  }
  addTemplateAssignmentExpression (node) {
    const expression = this.getTemplateAssignmentExpression(node)
    this.append(expression)
  }
}

function singlespace (string) {
  return string.replace(/\s\s+/g, ' ')
}

function extract (value) {
  let values = []
  let string = ''
  singlespace(value).split('').forEach(character => {
    if (character === '{') {
      if (string) {
        values.push(string)
        string = ''
      }  
    }
    string += character
    if (character === '}') {
      values.push(string)
      string = ''
    }
  })
  values.push(string)
  
  return values.map(string => string.trim()).filter(Boolean)
}

function getName (name) {
  if (name.endsWith('.bind')) {
    return name.substring(0, name.length - 5)
  }
  return name
}

function getValue (name, value) {
  if (value.includes('{') && value.includes('}')) {
    let values = extract(value)
    if (values.length === 1) {
      let property = value.substring(1, value.length - 1)
      return {
        type: 'MemberExpression',
        computed: false,
        object: { type: 'Identifier', name: 'o' },
        property: { type: 'Identifier', name: property }
      }
    } else {
      const nodes = []
      values.map((value, index) => {
        if (index > 0) {
          nodes.push({ type: 'Literal', value: ' ' })
        }
        if (value.includes('{') && value.includes('}')) {
          let property = value.substring(1, value.length - 1)
          return nodes.push({
            type: 'MemberExpression',
            computed: false,
            object: { type: 'Identifier', name: 'o' },
            property: { type: 'Identifier', name: property }
          })
        }
        return nodes.push({ type: 'Literal', value: value })
      })
      const expression = nodes.reduce((previous, current) => {
        if (!previous.left) {
          previous.left = current
          return previous
        } else if (!previous.right) {
          previous.right = current
          return previous
        }
        return { type: 'BinaryExpression', operator: '+', left: previous, right: current }
      }, {
        type: 'BinaryExpression', operator: '+'
      })
      return { type: 'ExpressionStatement', expression }
    }
  } else if (name.endsWith('.bind')) {
    return {
      type: 'MemberExpression',
      computed: false,
      object: { type: 'Identifier', name: 'o' },
      property: { type: 'Identifier', name: value }
    }
  } else {
    return { type: 'Literal', value }
  }
}

function serialize (node, attrs) {
  let html = attrs.find(attr => attr.name === 'html' || attr.name === 'html.bind')
  if (html) {
    return getValue(html.name, html.value)
  } else {
    let text = attrs.find(attr => attr.name === 'text' || attr.name === 'text.bind')
    if (text) {
      let argument = getValue(text.name, text.value)
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'e'
        },
        arguments: [argument.expression ? argument.expression : argument]
      }
    }
  }
  return null
}

module.exports = {
  render () {},
  compile (source) {
    const htmlTree = parseFragment(source, { locationInfo: true })
    const start = new Tree('')
    const end = new Tree('')
    start.append({
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 't' },
          init: { type: 'Literal', value: '' }
        }
      ],
      kind: 'var'
    })
    walk(htmlTree, fragment => {
      const node = fragment.nodeName
      const attrs = fragment.attrs
      if (node === '#document-fragment') return
      if (node === '#text') {
        start.addTemplateAssignmentExpression({
          type: 'Literal',
          value: fragment.value
        })
      }
      if (node === 'slot' && attrs) {
        const repeat = attrs.find(attr => attr.name === 'repeat.for') 
        if (repeat) {

        } else {
          let right = serialize(node, attrs)
          if (right) {
            start.addTemplateAssignmentExpression(right)
          }
        }
      } else if (attrs) {
        start.addTemplateAssignmentExpression({
          type: 'Literal',
          value: `<${node}`
        })
        let allowed = attrs.filter(attr => attr.name !== 'html' && attr.name !== 'text')
        if (allowed.length) {
          allowed.forEach(attr => {
            const booleanAttributes = [
              "autofocus",
              "checked",
              "readonly",
              "disabled",
              "formnovalidate",
              "multiple",
              "required"
            ]
            if (booleanAttributes.includes(getName(attr.name))) {
              const expression = start.getTemplateAssignmentExpression({
                type: 'Literal',
                value: ` ${getName(attr.name)}`
              })
              if (!attr.value) {
                start.append(expression)
              } else {
                start.append({
                  type: 'IfStatement',
                  test: getValue(attr.name, attr.value),
                  consequent: {
                    type: 'BlockStatement',
                    body: [expression]
                  }
                })
              }
            } else {
              start.addTemplateAssignmentExpression({
                type: 'Literal',
                value: ` ${getName(attr.name)}="`
              })
              let { value } = attr
              if (value.includes('{') && value.includes('}')) {
                let values = extract(value)
                values.forEach((value, index) => {
                  if (index > 0) {
                    start.addTemplateAssignmentExpression({ type: 'Literal', value: ' ' })
                  }
                  start.addTemplateAssignmentExpression(getValue(attr.name, value))
                })
              } else {
                start.addTemplateAssignmentExpression(getValue(attr.name, value))
              }
              start.addTemplateAssignmentExpression({ type: 'Literal', value: '"' })
            }

          })
        }
        start.addTemplateAssignmentExpression({
          type: 'Literal',
          value: `>`
        })
        let right = serialize(node, attrs)
        if (right) {
          start.addTemplateAssignmentExpression(right)
        }
      }
      if (fragment.__location.endTag) {
        if (node !== 'slot') {
          end.addTemplateAssignmentExpression({
            type: 'Literal',
            value: `</${node}>`
          })
        }
      }
    })
    end.append({
      type: 'ReturnStatement',
      argument: { type: 'Identifier', name: 't' }
    })
    const body = start.toString() + end.toString()
    const fn = new Function('o', 'e', body) // eslint-disable-line
    return fn
  }
}
