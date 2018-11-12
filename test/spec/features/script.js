import test from 'ava'
import compile from '../../helpers/compile'
import { rollup } from 'rollup'
import svelte from 'rollup-plugin-svelte'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import coffeescript from 'coffeescript'

function normalize (string) {
  return string.replace(/\s+/g, '')
}

test('script', async assert => {
  let template
  console.time('script')

  template = await compile('<script store>console.log(STORE.foo)</script>')
  assert.deepEqual(template({ foo: 2 }, html => html), '<script>const STORE = {"foo":2}\nconsole.log(STORE.foo)</script>')

  template = await compile('<script store>const { foo } = STORE</script>')
  assert.deepEqual(template({ foo: 1 }, html => html), '<script>const STORE = {"foo":1}\nconst { foo } = STORE</script>')

  template = await compile('<script store>const { foo, bar } = STORE</script>')
  assert.deepEqual(template({ foo: 1, bar: 2 }, html => html), '<script>const STORE = {"foo":1,"bar":2}\nconst { foo, bar } = STORE</script>')

  template = await compile('<script store>const { foo } = STORE</script>')
  assert.deepEqual(template({ foo: 'some text' }, html => html), '<script>const STORE = {"foo":"some text"}\nconst { foo } = STORE</script>')

  template = await compile('<script store>const { foo } = STORE</script>')
  assert.deepEqual(template({ 'foo': 'some text' }, html => html), '<script>const STORE = {"foo":"some text"}\nconst { foo } = STORE</script>')

  template = await compile('<script store>const { foo } = STORE</script>')
  assert.deepEqual(template({ foo: ['bar', 'baz'] }, html => html), '<script>const STORE = {"foo":["bar","baz"]}\nconst { foo } = STORE</script>')

  template = await compile('<script store>const bar = STORE.foo[0]</script>')
  assert.deepEqual(template({ foo: ['bar', 'baz'] }, html => html), '<script>const STORE = {"foo":["bar","baz"]}\nconst bar = STORE.foo[0]</script>')

  template = await compile('<script store>const { foo } = STORE</script>')
  assert.deepEqual(template({ foo: ['bar', 'baz'] }, html => html), '<script>const STORE = {"foo":["bar","baz"]}\nconst { foo } = STORE</script>')

  template = await compile('<script store>const button = document.querySelector("button")\nbutton.innerText = STORE.text\n</script>')
  assert.deepEqual(template({ 'text': 'fooBar' }, html => html), '<script>const STORE = {"text":"fooBar"}\nconst button = document.querySelector("button")\nbutton.innerText = STORE.text\n</script>')

  template = await compile('<script store>const isHidden = STORE.isHidden</script>')
  assert.deepEqual(template({ isHidden: true }, html => html), '<script>const STORE = {"isHidden":true}\nconst isHidden = STORE.isHidden</script>')

  template = await compile('<script compiler="foo2bar">const foo = 42</script>', { compilers: { foo2bar: (source) => { return source.replace('foo', 'bar') } } })
  assert.deepEqual(template({}, html => html), '<script>const bar = 42</script>')

  template = await compile(`<script compiler="foo2bar" options='{"baz": "qux"}'>const foo = 42</script>`, { compilers: { foo2bar: (source, options) => { return source.replace('foo', options.baz) } } })
  assert.deepEqual(template({}, html => html), '<script>const qux = 42</script>')

  template = await compile(`<script compiler="async">const foo = 42</script>`, {
    compilers: {
      async: (source) => {
        return new Promise(resolve => {
          resolve(source.replace('foo', 'bar'))
        })
      }
    }
  })

  assert.deepEqual(template({}, html => html), '<script>const bar = 42</script>')

  template = await compile(`<div>foo</div><script compiler="bar2qux">const bar = 42</script><div>baz</div>`, {
    compilers: {
      bar2qux: (source) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(source.replace('bar', 'qux'))
          }, 5)
        })
      }
    }
  })

  assert.deepEqual(template({}, html => html), '<div>foo</div><script>const qux = 42</script><div>baz</div>')

  template = await compile(`
    <script compiler="rollup">console.log('x')</script>
  `, {
    compilers: {
      rollup: async (source, options) => {
        const input = join(tmpdir(), 'rollup.js')
        writeFileSync(input, source)
        const bundle = await rollup({ input })
        unlinkSync(input)
        const { code } = await bundle.generate({
          format: 'iife'
        })
        return code
      }
    }
  })

  assert.deepEqual(normalize(template({}, html => html)), normalize(`<script>(function () { 'use strict'; console.log('x'); }());</script>`))

  template = await compile(`
    <script compiler="svelte">import Foo from './Foo.html'; const target = document.getElementById('app'); new Foo({ target });</script>
  `, {
    compilers: {
      svelte: async (source, options) => {
        const input = join(__dirname, '../../fixtures/svelte', 'actual.js')
        writeFileSync(input, source)
        const bundle = await rollup({ input, plugins: [ svelte() ] })
        unlinkSync(input)
        const { code } = await bundle.generate({
          format: 'iife'
        })
        writeFileSync(join(__dirname, '../../fixtures/svelte', 'expected.js'), code)
        return code
      }
    }
  })

  assert.deepEqual(normalize(template({}, html => html)), normalize('<script>' + readFileSync(join(__dirname, '../../fixtures/svelte', 'expected.js'), 'utf8')) + '</script>')

  template = await compile(`
    <script compiler="coffeescript">console.log "Hello, world!"</script>
  `, {
    compilers: {
      coffeescript (source, options) {
        return coffeescript.compile(source)
      }
    }
  })

  assert.deepEqual(normalize(template({}, html => html)), normalize('<script>(function () { console.log("Hello, world!"); }).call(this);</script>'))

  console.timeEnd('script')
})
