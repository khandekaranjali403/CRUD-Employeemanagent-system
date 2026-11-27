import { Readable } from 'node:stream'
import { handleRequest } from '../backend/index.js'

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url)
    const forwardedPath = requestUrl.searchParams.get('path')
    const headers = Object.fromEntries(request.headers.entries())
    const nodeRequest = {
      method: request.method,
      url: forwardedPath === null ? `${requestUrl.pathname}${requestUrl.search}` : `/api/${forwardedPath}`,
      headers,
      async *[Symbol.asyncIterator]() {
        if (!request.body) return
        for await (const chunk of Readable.fromWeb(request.body)) yield chunk
      },
    }

    const responseHeaders = new Headers()
    let statusCode = 200
    let body = ''
    const nodeResponse = {
      headersSent: false,
      writeHead(status, values = {}) {
        statusCode = status
        for (const [name, value] of Object.entries(values)) responseHeaders.set(name, value)
        this.headersSent = true
      },
      setHeader(name, value) {
        responseHeaders.set(name, value)
      },
      end(value = '') {
        body = value
        this.headersSent = true
      },
      destroy(error) {
        throw error
      },
    }

    await handleRequest(nodeRequest, nodeResponse)
    return new Response(body, { status: statusCode, headers: responseHeaders })
  },
}
