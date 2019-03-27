const AbstractSyntaxTree = require('abstract-syntax-tree')
const { convertKey } = require('../convert')

module.exports = function ({ fragment, tree, variables, attrs, collectChildren }) {
  const ast = new AbstractSyntaxTree('')
  let left, right, key, value

  if (attrs.length === 3) {
    [left, , right] = attrs
  } else if (attrs.length === 5) {
    [key, , value, , right] = attrs
  }

  if (left) {
    variables.push(left.key)
  } else if (key && value) {
    variables.push(key.key)
    variables.push(value.key)
  }

  collectChildren(fragment, ast)

  if (left) {
    variables.pop()
  } else if (key && value) {
    variables.pop()
    variables.pop()
  }

  tree.append({
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: convertKey(right.key, variables),
        property: {
          type: 'Identifier',
          name: fragment.tagName === 'foreach' ? 'forEach' : 'each'
        },
        computed: false
      },
      arguments: [
        {
          type: 'FunctionExpression',
          params: [
            left ? {
              type: 'Identifier',
              name: left.key
            } : null,
            key ? {
              type: 'Identifier',
              name: key.key
            } : null,
            value ? {
              type: 'Identifier',
              name: value.key
            } : null
          ].filter(Boolean),
          body: {
            type: 'BlockStatement',
            body: ast.body
          }
        }
      ]
    }
  })
}