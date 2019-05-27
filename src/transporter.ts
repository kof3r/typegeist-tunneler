
export interface Transporter {
  receive(queue: string, handler: (msg: any) => void, options?: { durable: boolean, autoDelete: boolean }): void,
  send(queue: string, message: any, options?: { expiration: number }): boolean
}
