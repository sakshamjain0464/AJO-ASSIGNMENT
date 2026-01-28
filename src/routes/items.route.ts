import { Router, Request, Response } from 'express'
import * as auctionService from '../services/auction.service'

const router = Router()

/**
 * GET /items
 * Returns all auction items with current server time
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    console.log(req)
    const { items, serverTime } = await auctionService.getAuctionItems()

    res.json({
      serverTime,
      items
    })
  } catch (error) {
    console.error('Error fetching items:', error)
    res.status(500).json({ error: 'Failed to fetch auction items' })
  }
})

export default router
