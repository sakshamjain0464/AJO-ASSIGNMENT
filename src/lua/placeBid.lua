-- placeBid.lua
-- Atomically validates and places a bid on an auction item
--
-- KEYS[1]: Redis key for the auction item (e.g., "auction:item:123")
--
-- ARGV[1]: bid amount (number)
-- ARGV[2]: bidder name (string)
-- ARGV[3]: current server time (epoch millis)
--
-- RETURN VALUES:
--   1  = BID_ACCEPTED
--   0  = BID_TOO_LOW
--  -1  = AUCTION_ENDED

local key = KEYS[1]

local bidAmount = tonumber(ARGV[1])
local bidderName = ARGV[2]
local serverTime = tonumber(ARGV[3])

-- Check if auction exists
if redis.call('EXISTS', key) == 0 then
  return -1
end

-- Read current state
local currentBid = tonumber(redis.call('HGET', key, 'currentBid'))
local endsAt = tonumber(redis.call('HGET', key, 'endsAt'))
local ended = redis.call('HGET', key, 'ended')
local version = tonumber(redis.call('HGET', key, 'version'))

-- Check if auction has ended
if ended == 'true' or serverTime > endsAt then
  -- Mark as ended if time expired
  if ended ~= 'true' then
    redis.call('HSET', key, 'ended', 'true')
  end
  return -1
end

-- Validate bid is strictly greater than current bid
if bidAmount <= currentBid then
  return 0
end

-- Atomically update the auction state
redis.call('HSET', key, 'currentBid', bidAmount)
redis.call('HSET', key, 'highestBidder', bidderName)
redis.call('HSET', key, 'version', version + 1)

return 1

