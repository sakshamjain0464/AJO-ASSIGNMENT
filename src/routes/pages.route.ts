import { Router, Request, Response } from 'express'
import * as auctionService from '../services/auction.service'

const router = Router()

/**
 * GET /
 * Renders the auction dashboard
 * Fetches data from existing auction service (no logic duplication)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log(req.baseUrl)
    const { items, serverTime } = await auctionService.getAuctionItems()

    console.log(items)

    res.render('index', {
      title: 'Live Auction Platform',
      serverTime,
      items,
      body: '' // Will be filled by index.ejs content
    })
  } catch (error) {
    console.error('Error rendering dashboard:', error)
    res.status(500).send('Error loading auction dashboard')
  }
})

export default router
