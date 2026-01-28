import { getRedisClient, closeRedisClient } from '../config/redis'
import * as auctionStore from '../store/auction.store'
import { AuctionItem } from '../models/auctionItem'
import { createFutureTimestamp } from '../utils/time'

/**
 * Seeds initial auction items into Redis
 */
async function seedAuctionItems (): Promise<void> {
  console.log('Starting auction items seed...')

  try {
    // Connect to Redis
    await getRedisClient()

    // Clear existing items
    await auctionStore.clearAllItems()
    console.log('Cleared existing auction items')

    // Create seed data
    const items: AuctionItem[] = [
      {
        id: '1',
        title: 'Vintage Rolex Submariner',
        startingPrice: 5000,
        currentBid: 5000,
        highestBidder: '',
        endsAt: createFutureTimestamp(518400), // 60 seconds from now
        ended: false,
        version: 0
      },
      {
        id: '2',
        title: 'Rare Pokemon Card Collection',
        startingPrice: 1500,
        currentBid: 1500,
        highestBidder: '',
        endsAt: createFutureTimestamp(518400), // 90 seconds from now
        ended: false,
        version: 0
      },
      {
        id: '3',
        title: 'MacBook Pro M3 Max',
        startingPrice: 2500,
        currentBid: 2500,
        highestBidder: '',
        endsAt: createFutureTimestamp(518400), // 120 seconds from now
        ended: false,
        version: 0
      },
      {
        id: '4',
        title: 'Signed Baseball by Babe Ruth',
        startingPrice: 10000,
        currentBid: 10000,
        highestBidder: '',
        endsAt: createFutureTimestamp(518400), // 45 seconds from now
        ended: false,
        version: 0
      }
    ]

    // Save items to Redis
    for (const item of items) {
      await auctionStore.saveItem(item)
      console.log(
        `Seeded: ${item.title} - Ends in ${(item.endsAt - Date.now()) / 1000}s`
      )
    }

    console.log(`Successfully seeded ${items.length} auction items`)
  } catch (error) {
    console.error('Error seeding auction items:', error)
    throw error
  } finally {
    await closeRedisClient()
  }
}

// Run seed if executed directly
if (require.main === module) {
  seedAuctionItems()
    .then(() => {
      console.log('Seed completed successfully')
      process.exit(0)
    })
    .catch(error => {
      console.error('Seed failed:', error)
      process.exit(1)
    })
}

export { seedAuctionItems }
