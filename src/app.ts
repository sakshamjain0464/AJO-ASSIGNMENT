import express, { Application } from 'express'
import { createServer, Server as HTTPServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import itemsRouter from './routes/items.route'
import pagesRouter from './routes/pages.route'
import { initializeBiddingSocket } from './sockets/bidding.socket'
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData
} from './types/socket'
import { engine } from 'express-handlebars'

/**
 * Creates and configures the Express application with Socket.io
 */
export function createApp (): {
  app: Application
  httpServer: HTTPServer
  io: Server
} {
  const app: Application = express()

  // View engine setup (EJS)
  app.engine(
    'hbs',
    engine({
      extname: 'hbs',
      defaultLayout: 'main',
      layoutsDir: path.join(__dirname, '..', 'views/layouts'),
      partialsDir: path.join(__dirname, '..', 'views/partials')
    })
  )

  app.set('view engine', 'hbs')
  // Static files
  // Static files (MUST use app.use)
  app.use(express.static(path.join(__dirname, '..', 'public')))

  // Middleware
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST']
    })
  )
  app.use(express.json())

  // Health check endpoint
  app.get('/health', (req, res) => {
    console.log(req)
    res.json({ status: 'ok', timestamp: Date.now() })
  })

  // REST API routes
  app.use('/items', itemsRouter)

  // Page routes (must be last to avoid conflicting with API routes)
  app.use('/', pagesRouter)

  // Create HTTP server
  const httpServer = createServer(app)

  // Create Socket.io server with typed events
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  // Initialize socket handlers
  initializeBiddingSocket(io)

  return { app, httpServer, io }
}
