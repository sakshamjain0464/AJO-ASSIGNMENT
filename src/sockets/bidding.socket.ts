import { Server, Socket } from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData } from '../types/socket';
import * as auctionService from '../services/auction.service';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Initializes Socket.io event handlers for bidding
 */
export function initializeBiddingSocket(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * Handler for BID_PLACED event
     * Validates and processes bids atomically, then broadcasts results
     */
    socket.on('BID_PLACED', async (data) => {
      const { itemId, amount, bidderName } = data;

      // Validate input
      if (!itemId || typeof amount !== 'number' || !bidderName) {
        socket.emit('OUTBID', {
          itemId: itemId || 'unknown',
          currentBid: 0,
          message: 'Invalid bid data',
        });
        return;
      }

      if (amount <= 0) {
        socket.emit('OUTBID', {
          itemId,
          currentBid: 0,
          message: 'Bid amount must be positive',
        });
        return;
      }

      try {
        // Place bid using service layer (atomic via Lua)
        const result = await auctionService.placeBid(itemId, amount, bidderName);

        if (result.success && result.item) {
          // Bid accepted - notify bidder and broadcast to all clients
          socket.emit('BID_ACCEPTED', result.item);
          io.emit('UPDATE_BID', result.item);

          // Notify previous bidder they've been outbid
          if (result.previousBidder && result.previousBidder !== bidderName) {
            io.emit('OUTBID', {
              itemId,
              currentBid: result.item.currentBid,
              message: `You have been outbid on ${result.item.title}`,
            });
          }

          console.log(`Bid accepted: ${bidderName} bid $${amount} on ${itemId}`);
        } else {
          // Bid rejected
          if (result.status === 'AUCTION_ENDED') {
            socket.emit('OUTBID', {
              itemId,
              currentBid: result.item?.currentBid || 0,
              message: 'Auction has ended',
            });
          } else if (result.status === 'BID_TOO_LOW' && result.item) {
            socket.emit('OUTBID', {
              itemId,
              currentBid: result.item.currentBid,
              message: `Bid too low. Current bid is $${result.item.currentBid}`,
            });
          }

          console.log(`Bid rejected: ${bidderName} bid $${amount} on ${itemId} - ${result.status}`);
        }
      } catch (error) {
        console.error('Error processing bid:', error);
        socket.emit('OUTBID', {
          itemId,
          currentBid: 0,
          message: 'Server error processing bid',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  /**
   * Periodic check for expired auctions
   * Runs every 1 second to detect and broadcast auction endings
   */
  setInterval(async () => {
    try {
      const endedAuctions = await auctionService.checkAndEndExpiredAuctions();

      for (const item of endedAuctions) {
        io.emit('AUCTION_ENDED', item);
        console.log(`Auction ended: ${item.title} (${item.id})`);
      }
    } catch (error) {
      console.error('Error checking expired auctions:', error);
    }
  }, 1000);

  console.log('Socket.io bidding handlers initialized');
}

