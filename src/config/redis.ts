import { createClient } from 'redis'
import { config } from './env'

export type RedisClientType = ReturnType<typeof createClient>

let redisClient: RedisClientType | null = null

export async function getRedisClient (): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  redisClient = createClient({
    password: config.redisPassword,
    socket: {
      host: config.redisHost,
      port: config.redisPort,

      reconnectStrategy: retries => {
        if (retries > 10) {
          console.error('Redis connection failed after 10 retries')
          return new Error('Redis connection failed')
        }
        return retries * 500
      }
    }
  })

  redisClient.on('error', err => {
    console.error('Redis Client Error:', err)
  })

  redisClient.on('connect', () => {
    console.log('Redis client connected')
  })

  redisClient.on('ready', () => {
    console.log('Redis client ready')
  })

  await redisClient.connect()

  return redisClient
}

export async function closeRedisClient (): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis client disconnected')
  }
}
