export async function* parseDataStream(
  readableStream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: string; value: any }> {
  const reader = readableStream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (buffer.length > 0) {
        // flush remaining buffer
        for (const msg of parseLine(buffer)) {
          yield msg
        }
      }
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const msg = parseLine(line)
      for (const m of msg) {
        yield m
      }
    }
  }

  function* parseLine(line: string): Generator<{ type: string; value: any }> {
    if (line.trim() === '') return

    const prefixMatch = line.match(/^([a-z0-9]):(.*)$/)
    if (prefixMatch) {
      const prefix = prefixMatch[1]
      const data = prefixMatch[2]
      try {
        const jsonData = JSON.parse(data)[0]
        if (jsonData.type === 'text') {
          yield { type: 'text', value: jsonData.value }
        } else if (jsonData.type === 'reasoning') {
          yield { type: 'reasoning', value: jsonData.value }
        } else if (jsonData.type === 'finish') {
          yield { type: 'finish', value: jsonData.value }
        } else if (jsonData.type === 'error') {
          yield { type: 'error', value: jsonData.value }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
}
