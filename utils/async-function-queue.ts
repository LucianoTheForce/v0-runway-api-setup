export class AsyncFunctionQueue {
  private queue: { fn: Function; args: any[]; retryCount?: number }[] = []
  private isFunctionRunning = false
  private queryIsFull = false

  enqueue(fn: Function, ...args: any[]) {
    this.queryIsFull = false
    this.queue.push({ fn, args, retryCount: 0 })
    this.processQueue()
  }

  async processQueue() {
    if (this.queryIsFull || this.isFunctionRunning || this.queue.length === 0) return

    try {
      this.isFunctionRunning = true

      const item = this.queue[0]

      try {
        const result = await item.fn(...item.args)

        switch (result) {
          case "full":
            console.log("Fila está cheia, aguardando...", item)
            this.queryIsFull = true
            return
          case "retry":
            console.log("Tentando novamente mais tarde", item)
            this.queryIsFull = false

            // Incrementar contador de tentativas
            item.retryCount = (item.retryCount || 0) + 1

            // Implementar backoff exponencial (esperar mais tempo entre tentativas)
            const delayMs = Math.min(30000, 1000 * Math.pow(2, item.retryCount || 0))
            console.log(`Aguardando ${delayMs}ms antes da próxima tentativa (tentativa ${item.retryCount})`)

            // Se exceder o número máximo de tentativas, remover da fila
            if (item.retryCount > 5) {
              console.log("Número máximo de tentativas excedido, removendo da fila", item)
              const index = this.queue.indexOf(item)
              if (index !== -1) this.queue.splice(index, 1)
            }
            break
          default:
            this.queryIsFull = false
            const index = this.queue.indexOf(item)
            if (index !== -1) this.queue.splice(index, 1)
        }
      } catch (error) {
        console.error("Erro ao processar item da fila:", error)

        // Incrementar contador de tentativas
        item.retryCount = (item.retryCount || 0) + 1

        // Se exceder o número máximo de tentativas, remover da fila
        if (item.retryCount > 5) {
          console.log("Número máximo de tentativas excedido após erro, removendo da fila", item)
          const index = this.queue.indexOf(item)
          if (index !== -1) this.queue.splice(index, 1)
        } else {
          // Implementar backoff exponencial
          const delayMs = Math.min(30000, 1000 * Math.pow(2, item.retryCount || 0))
          console.log(`Erro na tentativa ${item.retryCount}. Aguardando ${delayMs}ms antes da próxima tentativa`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    } catch (error) {
      console.error("Erro crítico ao processar fila:", error)
    } finally {
      this.isFunctionRunning = false
      this.processQueue()
    }
  }

  get length() {
    return this.queue.length
  }

  clear() {
    this.queue = []
  }
}
