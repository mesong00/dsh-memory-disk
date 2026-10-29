import { apply } from '../index.js'

const sections = []
const tools = []
const ctx = {
  systemPrompt: {
    getSectionOrder: () => -1000,
    section(section) {
      sections.push(section)
      return () => {}
    },
  },
  tools: {
    register(definition) {
      tools.push(definition)
      return () => {}
    },
  },
}

apply(ctx)
console.log('sections:', sections.map((s) => `${s.name}@${s.order}`).join(', '))
console.log('tools:', tools.map((t) => t.name).join(', '))
console.log('section chars:', sections[0]?.text({})?.length)

const tool = tools[0]
if (!tool) throw new Error('memory_search was not registered')
const signal = new AbortController().signal
const output = await tool.execute({ query: '增程器', limit: 3 }, { signal })
console.log(output.split('\n').slice(0, 6).join('\n'))
if (!output.includes('归档')) throw new Error('search output has no archive path')
