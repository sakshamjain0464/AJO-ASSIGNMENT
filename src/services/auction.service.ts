import { AuctionItem, BidResult } from '../models/auctionItem'
import * as auctionStore from '../store/auction.store'
import { getServerTime, isExpired } from '../utils/time'

/**
 * Retrieves all auction items with current server time
 */
export async function getAuctionItems (): Promise<{
  items: AuctionItem[]
  serverTime: number
}> {
  const items = await auctionStore.getAllItems()
  const serverTime = getServerTime()

  return { items, serverTime }
}

/**
 * Places a bid on an auction item using atomic Lua script
 * Handles all business logic for bid validation and state updates
 */
export async function placeBid (
  itemId: string,
  amount: number,
  bidderName: string
): Promise<BidResult> {
  const serverTime = getServerTime()

  // Get current item state before attempting bid
  const itemBefore = await auctionStore.getItemById(itemId)

  if (!itemBefore) {
    return {
      success: false,
      status: 'AUCTION_ENDED'
    }
  }

  const previousBidder = itemBefore.highestBidder || undefined

  // Execute atomic bid placement via Lua script
  const resultCode = await auctionStore.placeBidAtomic(
    itemId,
    amount,
    bidderName,
    serverTime
  )

  // Fetch updated item state after bid attempt
  const itemAfter = await auctionStore.getItemById(itemId)

  if (!itemAfter) {
    return {
      success: false,
      status: 'AUCTION_ENDED'
    }
  }

  // Interpret Lua script result code
  if (resultCode === 1) {
    // BID_ACCEPTED
    return {
      success: true,
      status: 'BID_ACCEPTED',
      item: itemAfter,
      previousBidder
    }
  } else if (resultCode === 0) {
    // BID_TOO_LOW
    return {
      success: false,
      status: 'BID_TOO_LOW',
      item: itemAfter
    }
  } else {
    // AUCTION_ENDED
    return {
      success: false,
      status: 'AUCTION_ENDED',
      item: itemAfter
    }
  }
}

/**
 * Checks all active auctions and marks expired ones as ended
 * Returns list of newly ended auctions
 */
export async function checkAndEndExpiredAuctions (): Promise<AuctionItem[]> {
  // const serverTime = getServerTime();
  const items = await auctionStore.getAllItems()

  const endedItems: AuctionItem[] = []

  for (const item of items) {
    if (!item.ended && isExpired(item.endsAt)) {
      await auctionStore.markAuctionEnded(item.id)

      const updatedItem: AuctionItem = {
        ...item,
        ended: true
      }

      endedItems.push(updatedItem)
    }
  }

  return endedItems
}
