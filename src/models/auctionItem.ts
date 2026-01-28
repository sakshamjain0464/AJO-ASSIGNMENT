export interface AuctionItem {
  id: string;
  title: string;
  startingPrice: number;
  currentBid: number;
  highestBidder: string;
  endsAt: number; // epoch milliseconds
  ended: boolean;
  version: number;
}

export interface AuctionItemRedis {
  id: string;
  title: string;
  startingPrice: string;
  currentBid: string;
  highestBidder: string;
  endsAt: string;
  ended: string; // "true" | "false"
  version: string;
}

export interface BidRequest {
  itemId: string;
  amount: number;
}

export interface BidResult {
  success: boolean;
  status: 'BID_ACCEPTED' | 'BID_TOO_LOW' | 'AUCTION_ENDED';
  item?: AuctionItem;
  previousBidder?: string;
}

