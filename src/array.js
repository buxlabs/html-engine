const ACTIONS = [
  { alias: ['is', 'positive'], name: 'is_positive' },
  { alias: ['is', 'negative'], name: 'is_negative' }
]

function normalize (array) { //['foo', 'is', 'negative']
  const result = []
  let index
  for (let i = 0, ilen = array.length; i < ilen; i++) {
    let attribute = array[i]
    let found = false
    index = i
    for (let j = 0, jlen = ACTIONS.length; j < jlen; j++) {
      let action = ACTIONS[j]
      if (action.alias[0] !== attribute) continue
      i++
      attribute = array[i]
      for (let k = 1, klen = action.alias.length; k < klen; k++) {
        let part = action.alias[k]
        if (part !== attribute) {
          i = index
          attribute = array[i]
          break
        }
        i++
        attribute = array[i]
        if (k === klen - 1) {
          result.push(action.name)
          found = true
        }
      }
    }
    if (!found) result.push(attribute)
  }
  return result
}

module.exports = { normalize }
