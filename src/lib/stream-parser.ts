export async function* parseDataStream(
  readableStream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: string; value: any }> {
  const reader = readableStream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.trim() === '') continue
      const match = line.match(/^(\d+):(.*)$/)
      if (match) {
        const type = match[1]
        const data = JSON.parse(match[2])

        if (type === '0') {
          yield { type: 'text', value: data }
        } else if (type === '2') {
          // Assuming type '2' is for data messages that can be ignored for now.
        }
      }
    }
  }
} 