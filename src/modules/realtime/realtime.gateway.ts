import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

/**
 * Realtime WebSocket Gateway
 *
 * Events emitted to clients:
 *  - sale:completed     { saleId, receiptNumber, totalPesewas, cashierId }
 *  - stock:alert        { alertId, productId, type, severity, message }
 *  - stock:low          { productId, quantityOnHand, reorderPoint }
 *  - eod:closed         { storeId, businessDate, status }
 *  - sync:outbox-ack    { clientId, saleId } — confirms offline sale was synced
 *  - notification       { title, body, entityType, entityId }
 *
 * Clients join a room per storeId on connection.
 */
@WebSocketGateway({
  cors: { origin: CORS_ORIGINS, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });

      // Join the store room so broadcasts are scoped per store
      client.join(`store:${payload.storeId}`);
      client.data.storeId = payload.storeId;
      client.data.staffId = payload.sub;

      this.logger.log(`Client connected: ${client.id} → store:${payload.storeId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Broadcast helpers (called from services) ──────────────────────────────
  broadcastToStore(storeId: string, event: string, data: unknown) {
    this.server.to(`store:${storeId}`).emit(event, data);
  }

  broadcastStockAlert(storeId: string, alert: {
    alertId: string;
    productId: string;
    type: string;
    severity: string;
    message: string;
  }) {
    this.broadcastToStore(storeId, 'stock:alert', alert);
  }

  broadcastSyncAck(storeId: string, clientId: string, saleId: string) {
    this.broadcastToStore(storeId, 'sync:outbox-ack', { clientId, saleId });
  }

  // ── Client-initiated events ────────────────────────────────────────────────
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }

  @SubscribeMessage('sync:outbox')
  handleOutboxSync(
    @MessageBody() payload: { items: Array<{ clientId: string; type: string; data: unknown }> },
    @ConnectedSocket() client: Socket,
  ) {
    // Outbox items from offline Tauri client wanting to sync.
    // The actual write happens via the REST API — this WS event just triggers a re-fetch nudge.
    this.logger.log(`Outbox sync request: ${payload.items.length} items from ${client.id}`);
    client.emit('sync:outbox-received', { count: payload.items.length });
  }
}
