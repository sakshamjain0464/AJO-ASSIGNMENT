import { AuctionItem } from '../models/auctionItem';

export interface ServerToClientEvents {
  UPDATE_BID: (item: AuctionItem) => void;
  BID_ACCEPTED: (item: AuctionItem) => void;
  OUTBID: (data: { itemId: string; currentBid: number; message: string }) => void;
  AUCTION_ENDED: (item: AuctionItem) => void;
}

export interface ClientToServerEvents {
  BID_PLACED: (data: { itemId: string; amount: number; bidderName: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId?: string;
}

