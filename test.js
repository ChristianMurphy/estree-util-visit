/**
 * @typedef {import('unist').Node} Node
 */

import assert from 'node:assert'
import test from 'tape'
import {parse} from 'acorn'
import {visit, EXIT, SKIP} from './index.js'

/** @type {import('estree-jsx').Node} */
// @ts-expect-error it’s fine.
let tree = parse(
  'export function x() { console.log(1 + "2"); process.exit(1) }',
  {sourceType: 'module', ecmaVersion: 2021}
)

const preorder = [
  'Program',
  'ExportNamedDeclaration',
  'FunctionDeclaration',
  'Identifier',
  'BlockStatement',
  'ExpressionStatement',
  'CallExpression',
  'MemberExpression',
  'Identifier',
  'Identifier',
  'BinaryExpression',
  'Literal',
  'Literal',
  'ExpressionStatement',
  'CallExpression',
  'MemberExpression',
  'Identifier',
  'Identifier',
  'Literal'
]

const postorder = [
  'Identifier',
  'Identifier',
  'Identifier',
  'MemberExpression',
  'Literal',
  'Literal',
  'BinaryExpression',
  'CallExpression',
  'ExpressionStatement',
  'Identifier',
  'Identifier',
  'MemberExpression',
  'Literal',
  'CallExpression',
  'ExpressionStatement',
  'BlockStatement',
  'FunctionDeclaration',
  'ExportNamedDeclaration',
  'Program'
]

test('estree-util-visit', (t) => {
  t.doesNotThrow(() => {
    visit(tree)
  }, 'should succeed w/o tree')

  let count = 0

  visit(tree, (node) => {
    assert.strictEqual(node.type, preorder[count++])
  })

  t.equal(count, 19, 'should walk')

  count = 0

  visit(tree, {
    leave(node) {
      assert.strictEqual(node.type, postorder[count++])
    }
  })

  t.equal(count, 19, 'should walk in postorder w/ `leave`')

  count = 0
  let postCount = 0

  visit(tree, {
    enter(node) {
      assert.strictEqual(node.type, preorder[count++])
    },
    leave(node) {
      assert.strictEqual(node.type, postorder[postCount++])
    }
  })

  t.equal(count, 19, 'should walk w/ both `enter` and `leave` (1)')
  t.equal(postCount, 19, 'should walk w/ both `enter` and `leave` (2)')

  count = 0

  visit(tree, (node) => {
    assert.strictEqual(node.type, preorder[count++])
    if (node.type === 'CallExpression') return EXIT
  })

  t.equal(count, 7, 'should stop when EXIT is returned')

  count = 0

  visit(tree, (node) => {
    assert.strictEqual(node.type, preorder[count++])
    if (node.type === 'CallExpression') return [EXIT]
  })

  t.equal(count, 7, 'should stop when EXIT in an array is returned')

  count = 0

  visit(tree, {
    leave(node) {
      assert.strictEqual(node.type, postorder[count++])
      if (node.type === 'CallExpression') return EXIT
    }
  })

  t.equal(count, 8, 'should stop when EXIT is returned from `leave`')

  count = 0

  t.doesNotThrow(() => {
    visit(tree, {
      enter(node) {
        assert.strictEqual(node.type, preorder[count++])
        if (node.type === 'CallExpression') return EXIT
      },
      leave(node) {
        assert.notStrictEqual(node.type, 'CallExpression')
      }
    })
  }, 'should not call `leave` after `enter` returned EXIT')

  count = 0
  let skip = 0

  visit(tree, (node) => {
    assert.strictEqual(node.type, preorder[count++ + skip])

    if (node.type === 'CallExpression') {
      skip = 6 // Skip a couple nodes.
      return SKIP
    }
  })

  t.equal(count, 9, 'should not walk a node when SKIP is returned')

  count = 0

  visit(tree, (node, key, index) => {
    assert.deepStrictEqual(
      [key, index],
      count === 0
        ? [null, null]
        : count === 1
        ? ['body', 0]
        : ['declaration', null],
      '`key` and `index` (' + count + ')'
    )

    assert.strictEqual(node.type, preorder[count++])

    if (node.type === 'FunctionDeclaration') return EXIT
  })

  t.equal(count, 3, 'should pass `key` and `index`')

  count = 0

  // @ts-expect-error runtime.
  visit({type: 'Program', position: {type: '!'}}, () => {
    count++
  })

  t.equal(count, 1, 'should not walk into `position`')

  count = 0

  visit({type: 'Program', data: {type: '!'}}, () => {
    count++
  })

  t.equal(count, 1, 'should not walk into `data`')

  count = 0

  // @ts-expect-error: meant to be custom.
  visit({type: 'Program', random: {type: '!'}}, () => {
    count++
  })

  t.equal(count, 2, 'should walk into other fields')

  count = 0

  // @ts-expect-error: meant to be custom.
  visit({type: 'Program', random: [1, 2, {type: '!'}]}, () => {
    count++
  })

  t.equal(count, 2, 'should walk into arrays')

  tree = JSON.parse(
    JSON.stringify(
      // @ts-expect-error It’s fine!
      parse(';[1, 2, 3, 4]', {sourceType: 'module', ecmaVersion: 2021}).body[1]
        .expression
    )
  )

  visit(tree, (node, key, index, parents) => {
    if (
      key === 'elements' &&
      node.type === 'Literal' &&
      'value' in node &&
      node.value === 3
    ) {
      // Remove the previous element.
      // @ts-expect-error it’s
      parents[parents.length - 1][key].splice(index - 1, 1)
      // Move to the element now at `index`.
      return index
    }
  })

  t.deepEqual(
    tree,
    {
      type: 'ArrayExpression',
      start: 1,
      end: 13,
      elements: [
        {type: 'Literal', start: 2, end: 3, value: 1, raw: '1'},
        {type: 'Literal', start: 8, end: 9, value: 3, raw: '3'},
        {type: 'Literal', start: 11, end: 12, value: 4, raw: '4'}
      ]
    },
    'should support removing a node and returning the next index'
  )

  t.end()
})
