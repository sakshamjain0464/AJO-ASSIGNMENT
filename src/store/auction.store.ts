import { readFileSync } from 'fs'
import { join } from 'path'
import { getRedisClient } from '../config/redis'
import { AuctionItem, AuctionItemRedis } from '../models/auctionItem'

const AUCTION_KEY_PREFIX = 'auction:item:'

// Load Lua script at module initialization
const placeBidScript = readFileSync(
  join(__dirname, '../lua/placeBid.lua'),
  'utf-8'
)

/**
 * Converts Redis hash data to AuctionItem interface
 */
function parseAuctionItem (redisData: AuctionItemRedis): AuctionItem {
  return {
    id: redisData.id,
    title: redisData.title,
    startingPrice: parseFloat(redisData.startingPrice),
    currentBid: parseFloat(redisData.currentBid),
    highestBidder: redisData.highestBidder,
    endsAt: parseInt(redisData.endsAt, 10),
    ended: redisData.ended === 'true',
    version: parseInt(redisData.version, 10)
  }
}

/**
 * Retrieves all auction items from Redis
 */
export async function getAllItems (): Promise<AuctionItem[]> {
  const client = await getRedisClient()
  const keys = await client.keys(`${AUCTION_KEY_PREFIX}*`)

  if (keys.length === 0) {
    return []
  }

  const items: AuctionItem[] = []

  for (const key of keys) {
    const redisData = (await client.hGetAll(key)) as unknown as AuctionItemRedis
    if (redisData && redisData.id) {
      items.push(parseAuctionItem(redisData))
    }
  }

  return items
}

/**
 * Retrieves a single auction item by ID
 */
export async function getItemById (itemId: string): Promise<AuctionItem | null> {
  const client = await getRedisClient()
  const key = `${AUCTION_KEY_PREFIX}${itemId}`

  const redisData = (await client.hGetAll(key)) as unknown as AuctionItemRedis

  if (!redisData || !redisData.id) {
    return null
  }

  return parseAuctionItem(redisData)
}

/**
 * Creates or updates an auction item in Redis
 */
export async function saveItem (item: AuctionItem): Promise<void> {
  const client = await getRedisClient()
  const key = `${AUCTION_KEY_PREFIX}${item.id}`

  await client.hSet(key, {
    id: item.id,
    title: item.title,
    startingPrice: item.startingPrice.toString(),
    currentBid: item.currentBid.toString(),
    highestBidder: item.highestBidder,
    endsAt: item.endsAt.toString(),
    ended: item.ended.toString(),
    version: item.version.toString()
  })
}

/**
 * Atomically places a bid using Lua script
 * Returns status code: 1 (accepted), 0 (too low), -1 (ended)
 */
export async function placeBidAtomic (
  itemId: string,
  bidAmount: number,
  bidderName: string,
  serverTime: number
): Promise<number> {
  const client = await getRedisClient()
  const key = `${AUCTION_KEY_PREFIX}${itemId}`

  const result = await client.eval(placeBidScript, {
    keys: [key],
    arguments: [bidAmount.toString(), bidderName, serverTime.toString()]
  })

  return result as number
}

/**
 * Marks an auction as ended
 */
export async function markAuctionEnded (itemId: string): Promise<void> {
  const client = await getRedisClient()
  const key = `${AUCTION_KEY_PREFIX}${itemId}`

  await client.hSet(key, 'ended', 'true')
}

/**
 * Deletes all auction items (used for testing/seeding)
 */
export async function clearAllItems (): Promise<void> {
  const client = await getRedisClient()
  const keys = await client.keys(`${AUCTION_KEY_PREFIX}*`)

  if (keys.length > 0) {
    await client.del(keys)
  }
}
