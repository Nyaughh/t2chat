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
      for (const msg of parseLine(line)) {
        yield msg
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
        const jsonData = JSON.parse(data)
        if (prefix === 'g') {
          if (typeof jsonData === 'string' && jsonData.startsWith('**')) {
            yield { type: 'reasoning', value: jsonData }
          } else {
            yield { type: 'text', value: jsonData }
          }
        } else if (prefix === 'e') {
          yield { type: 'event', value: jsonData }
        } else if (prefix === 'd') {
          yield { type: 'data', value: jsonData }
        } else if (prefix === 'f') {
          yield { type: 'metadata', value: jsonData }
        } else if (prefix === '0') {
          yield { type: 'text', value: jsonData }
        }
      } catch (e) {
        // ignore parse errors
      }
    } else {
      try {
        const jsonData = JSON.parse(line)
        if (jsonData.messageId) {
          yield { type: 'metadata', value: jsonData }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
} 