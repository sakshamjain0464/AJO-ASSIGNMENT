/**
 * Live Auction Platform - Client-Side JavaScript
 * Handles Socket.io connections, real-time updates, and countdown timers
 */

;(function () {
  'use strict'

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const state = {
    socket: null,
    serverTimeOffset: 0,
    bidderName: localStorage.getItem('bidderName') || '',
    pendingBid: null,
    timers: {}
  }

  // ============================================
  // DOM ELEMENTS
  // ============================================
  const elements = {
    modal: document.getElementById('bidder-modal'),
    modalInput: document.getElementById('bidder-name-input'),
    modalCancel: document.getElementById('modal-cancel'),
    modalConfirm: document.getElementById('modal-confirm'),
    toast: document.getElementById('toast'),
    serverTimeDisplay: document.getElementById('server-time-display')
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init () {
    calculateServerTimeOffset()
    initializeSocket()
    startServerTimeClock()
    startCountdownTimers()
    attachEventListeners()

    console.log('Live Auction Platform initialized')
  }

  /**
   * Calculate offset between server and client time
   * This ensures countdown timers are accurate regardless of client clock
   */
  function calculateServerTimeOffset () {
    const serverTime = parseInt(document.body.dataset.serverTime, 10)
    const clientTime = Date.now()
    state.serverTimeOffset = serverTime - clientTime

    console.log(`Server time offset: ${state.serverTimeOffset}ms`)
  }

  /**
   * Get current server time (adjusted from client time)
   */
  function getServerTime () {
    return Date.now() + state.serverTimeOffset
  }

  // ============================================
  // SOCKET.IO CONNECTION
  // ============================================
  function initializeSocket () {
    state.socket = io()

    state.socket.on('connect', () => {
      console.log('Socket.io connected:', state.socket.id)
      showToast('Connected to auction server', 'success')
    })

    state.socket.on('disconnect', () => {
      console.log('Socket.io disconnected')
      showToast('Disconnected from server', 'error')
    })

    state.socket.on('UPDATE_BID', handleUpdateBid)
    state.socket.on('BID_ACCEPTED', handleBidAccepted)
    state.socket.on('OUTBID', handleOutbid)
    state.socket.on('AUCTION_ENDED', handleAuctionEnded)
  }

  // ============================================
  // SOCKET EVENT HANDLERS
  // ============================================

  /**
   * Handle bid update broadcast (sent to all clients)
   */
  function handleUpdateBid (item) {
    console.log('UPDATE_BID:', item)

    const card = document.getElementById(`auction-${item.id}`)
    if (!card) return

    updateCardPrice(card, item.currentBid)
    updateCardBidder(card, item.highestBidder)
    flashCard(card, 'green')
  }

  /**
   * Handle bid acceptance (sent to bidder who placed successful bid)
   */
  function handleBidAccepted (item) {
    console.log('BID_ACCEPTED:', item)

    const card = document.getElementById(`auction-${item.id}`)
    if (!card) return

    updateCardStatus(card, 'winning')
    showToast(`Bid accepted! You're winning ${item.title}`, 'success')
  }

  /**
   * Handle bid rejection (sent to bidder whose bid was rejected)
   */
  function handleOutbid (data) {
    console.log('OUTBID:', data)

    const card = document.getElementById(`auction-${data.itemId}`)
    if (!card) return

    updateCardStatus(card, 'outbid')
    flashCard(card, 'red')
    showToast(data.message, 'error')
  }

  /**
   * Handle auction ending (broadcast to all clients)
   */
  function handleAuctionEnded (item) {
    console.log('AUCTION_ENDED:', item)

    const card = document.getElementById(`auction-${item.id}`)
    if (!card) return

    card.dataset.ended = 'true'
    updateCardStatus(card, 'ended')
    disableBidButton(card)
    stopCountdown(item.id)

    const timerElement = card.querySelector('[data-timer]')
    if (timerElement) {
      timerElement.innerHTML =
        '<span class="timer-expired">Auction Ended</span>'
    }

    showToast(`${item.title} auction has ended`, 'info')
  }

  // ============================================
  // DOM UPDATES
  // ============================================

  function updateCardPrice (card, newPrice) {
    const priceElement = card.querySelector('.price-amount')
    if (priceElement) {
      priceElement.textContent = newPrice.toLocaleString()
    }

    const priceValue = card.querySelector('[data-current-bid]')
    if (priceValue) {
      priceValue.dataset.currentBid = newPrice
    }
  }

  function updateCardBidder (card, bidderName) {
    const bidderElement = card.querySelector('.highest-bidder')
    if (bidderElement) {
      if (bidderName) {
        bidderElement.innerHTML = `Highest bidder: <strong>${bidderName}</strong>`
      } else {
        bidderElement.textContent = 'No bids yet'
      }
    }
  }

  function updateCardStatus (card, status) {
    const badge = card.querySelector('.status-badge')
    if (!badge) return

    // Remove all status classes
    badge.classList.remove(
      'status-active',
      'status-winning',
      'status-outbid',
      'status-ended'
    )

    // Add new status class
    badge.classList.add(`status-${status}`)

    // Update text
    const statusText = {
      active: 'Active',
      winning: 'Winning',
      outbid: 'Outbid',
      ended: 'Ended'
    }
    badge.textContent = statusText[status] || 'Active'
    badge.dataset.status = status
  }

  function flashCard (card, color) {
    const className = color === 'green' ? 'flash-green' : 'flash-red'
    card.classList.add(className)
    setTimeout(() => card.classList.remove(className), 800)
  }

  function disableBidButton (card) {
    const button = card.querySelector('.bid-button')
    if (button) {
      button.disabled = true
    }
  }

  // ============================================
  // COUNTDOWN TIMERS
  // ============================================

  function startCountdownTimers () {
    const cards = document.querySelectorAll('.auction-card')

    cards.forEach(card => {
      const itemId = card.dataset.itemId
      const endsAt = parseInt(card.dataset.endsAt, 10)
      const ended = card.dataset.ended === 'true'

      if (!ended && endsAt) {
        startCountdown(itemId, endsAt)
      }
    })
  }

  function startCountdown (itemId, endsAt) {
    // Clear existing timer if any
    if (state.timers[itemId]) {
      clearInterval(state.timers[itemId])
    }

    // Update immediately
    updateCountdown(itemId, endsAt)

    // Update every second
    state.timers[itemId] = setInterval(() => {
      updateCountdown(itemId, endsAt)
    }, 1000)
  }

  function updateCountdown (itemId, endsAt) {
    const timerElement = document.querySelector(`[data-timer="${itemId}"]`)
    if (!timerElement) return

    const now = getServerTime()
    const remaining = endsAt - now

    if (remaining <= 0) {
      timerElement.innerHTML =
        '<span class="timer-expired">Auction Ended</span>'
      stopCountdown(itemId)

      // Disable bid button
      const card = document.getElementById(`auction-${itemId}`)
      if (card) {
        disableBidButton(card)
      }
      return
    }

    const seconds = Math.floor(remaining / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    const remainingSeconds = seconds % 60
    const remainingMinutes = minutes % 60

    let timeString = ''
    if (hours > 0) {
      timeString = `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      timeString = `${minutes}m ${remainingSeconds}s`
    } else {
      timeString = `${seconds}s`
    }

    // Add urgency class if less than 10 seconds
    const className = seconds < 10 ? 'timer-urgent' : 'timer-countdown'
    timerElement.innerHTML = `<span class="${className}">${timeString}</span>`
  }

  function stopCountdown (itemId) {
    if (state.timers[itemId]) {
      clearInterval(state.timers[itemId])
      delete state.timers[itemId]
    }
  }

  // ============================================
  // SERVER TIME DISPLAY
  // ============================================

  function startServerTimeClock () {
    updateServerTimeClock()
    setInterval(updateServerTimeClock, 1000)
  }

  function updateServerTimeClock () {
    if (!elements.serverTimeDisplay) return

    const serverTime = getServerTime()
    const date = new Date(serverTime)

    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    elements.serverTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`
  }

  // ============================================
  // BID PLACEMENT
  // ============================================

  function attachEventListeners () {
    // Bid button clicks
    document.addEventListener('click', e => {
      const bidButton = e.target.closest('[data-bid-action]')
      console.log('BIDBUTTON: ', bidButton)
      if (!bidButton) return // 🔒 CRITICAL GUARD
      if (bidButton.disabled) return

      handleBidButtonClick(bidButton)
    })

    // Modal events
    if (elements.modalCancel) {
      elements.modalCancel.addEventListener('click', closeModal)
    }

    if (elements.modalConfirm) {
      elements.modalConfirm.addEventListener('click', confirmBid)
    }

    // Enter key in modal input
    if (elements.modalInput) {
      elements.modalInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          confirmBid()
        }
      })

      elements.modalInput.addEventListener('input', () => {
        if (elements.modalConfirm) {
          elements.modalConfirm.disabled =
            elements.modalInput.value.trim() === ''
        }
      })
    }
  }

  function handleBidButtonClick (button) {
    const itemId = button.dataset.bidAction
    const card = document.getElementById(`auction-${itemId}`)
    if (!card) return

    const bidElement = card.querySelector('[data-current-bid]')
    if (!bidElement) {
      console.error('Current bid element not found for item:', itemId)
      return
    }

    const currentBid = parseFloat(bidElement.dataset.currentBid)
    const increment = parseFloat(button.dataset.bidIncrement || '0')
    const newBid = currentBid + increment

    // Store pending bid
    state.pendingBid = { itemId, amount: newBid }

    console.log('Bidder name:', state.bidderName)
    console.log('Current Bid:', currentBid)
    console.log('New Bif:', newBid)

    // Show modal if no bidder name stored
    if (!state.bidderName) {
      console.log('OPENING MODAL')
      openModal()
    } else {
      placeBid(itemId, newBid, state.bidderName)
    }
  }

  function placeBid (itemId, amount, bidderName) {
    if (!state.socket || !state.socket.connected) {
      showToast('Not connected to server', 'error')
      return
    }

    console.log('Placing bid:', { itemId, amount, bidderName })

    state.socket.emit('BID_PLACED', {
      itemId,
      amount,
      bidderName
    })

    showToast('Bid placed...', 'info')
  }

  // ============================================
  // MODAL
  // ============================================

  function openModal () {
    if (elements.modal) {
      elements.modal.classList.add('show')
      if (elements.modalInput) {
        elements.modalInput.value = state.bidderName
        elements.modalInput.focus()
      }
    }
  }

  function closeModal () {
    if (elements.modal) {
      elements.modal.classList.remove('show')
    }
    state.pendingBid = null
  }

  function confirmBid () {
    if (!elements.modalInput) {
      console.error('Modal input not found')
      return
    }

    const name = elements.modalInput.value.trim()
    if (!name) {
      showToast('Please enter your name', 'error')
      return
    }

    state.bidderName = name
    localStorage.setItem('bidderName', name)

    closeModal()

    if (state.pendingBid) {
      placeBid(state.pendingBid.itemId, state.pendingBid.amount, name)
      state.pendingBid = null
    }
  }

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================

  function showToast (message, type = 'info') {
    if (!elements.toast) return

    elements.toast.textContent = message
    elements.toast.className = 'toast show'
    elements.toast.classList.add(type)

    setTimeout(() => {
      elements.toast.classList.remove('show')
    }, 3000)
  }

  // ============================================
  // START APPLICATION
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
