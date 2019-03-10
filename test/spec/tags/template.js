import test from '../../helpers/test'
import compile from '../../helpers/compile'
import escape from 'escape-html'
import { join } from 'path'

test('template: component', async assert => {
  const template = await compile('<template foo>foo</template><foo/>')
  assert.deepEqual(template({}, escape), 'foo')
})

// TODO add a possibility to declare a local component with the same
// name as the imported component
test('template: component inside of a imported component', async assert => {
  const template = await compile(`
    <import foo from='./foo.html'>
    <foo />
  `, {
    paths: [ join(__dirname, '../../fixtures/template') ]
  })
  assert.deepEqual(template({}, escape), 'bar')
})

test('template: objects as parameters', async assert => {
  const template = await compile(`
    <template foo>{bar.baz}</template>
    <foo bar="{ { baz: 'qux' } }" />
  `)
  assert.deepEqual(template({}, escape), 'qux')
})

test('template: padding attribute', async assert => {
  let template = await compile(`<template section><div padding="{{ bottom: 30 }}"><p>Inline component</p></div></template><section></section>`)
  assert.deepEqual(template({}, escape), '<div style="padding-bottom: 30px;"><p>Inline component</p></div>')

  template = await compile(`<template section><div padding="{{ bottom: "30", top: "150" }}"><p>Inline component</p></div></template><section></section>`)
  assert.deepEqual(template({}, escape), '<div style="padding-bottom: 30px; padding-top: 150px;"><p>Inline component</p></div>')

  template = await compile(`<template section><div margin="{{ top: 100, bottom: 100, right: 100, left: 100 }}"><p>Inline component</p></div></template><section></section>`)
  assert.deepEqual(template({}, escape), '<div style="margin-top: 100px; margin-bottom: 100px; margin-right: 100px; margin-left: 100px;"><p>Inline component</p></div>')
})