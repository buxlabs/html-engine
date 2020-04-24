'use strict'

class CompilerError extends Error {
  constructor (option, message) {
    message = `Compiler option "${option}" ${message}`
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class SVGError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class TranslationError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class ExpressionError extends Error {
  constructor (type) {
    const message = `Expression type: ${type} isn't supported yet.`
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

function normalizeErrors (error) {
  const stack = error.stack || ''
  const lines = stack.split('\n')
  const type = lines.shift().split(':')[0]
  return {
    type: error.type || type,
    message: error.message,
    stack: lines.join('\n').trim()
  }
}

module.exports = {
  CompilerError,
  SVGError,
  TranslationError,
  ExpressionError,
  normalizeErrors
}
