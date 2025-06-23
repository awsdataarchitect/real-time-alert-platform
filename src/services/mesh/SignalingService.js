/**
 * SignalingService - Handles WebRTC signaling for peer discovery and connection establishment
 */

import EventEmitter from 'events';

class SignalingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.deviceId = options.deviceId;
    this.signalServerUrl = options.signalServerUrl || 'ws://localhost:8080/signal';
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    
    this.pendingMessages = [];
    this.messageHandlers = new Map();
    
    this.setupMessageHandlers();
  }

  /**
   * Connect to signaling server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.signalServerUrl);
        
        this.websocket.onopen = () => {
          console.log('Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Register device with server
          this.send({
            type: 'register',
            deviceId: this.deviceId,
            timestamp: Date.now()
          });
          
          // Send any pending messages
          this.flushPendingMessages();
          
          this.emit('connected');
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.websocket.onclose = (event) => {
          console.log('Signaling server connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Attempt to reconnect if not intentionally closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
        
        this.websocket.onerror = (error) => {
          console.error('Signaling server error:', error);
          this.emit('error', error);
          reject(error);
        };
        
      } catch (error) {
        console.error('Failed to connect to signaling server:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from signaling server
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    this.isConnected = false;
  }

  /**
   * Attempt to reconnect to signaling server
   */
  async attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('reconnectFailed');
        }
      }
    }, delay);
  }

  /**
   * Send message to signaling server
   */
  send(message) {
    const messageWithId = {
      ...message,
      messageId: this.generateMessageId(),
      from: this.deviceId,
      timestamp: Date.now()
    };
    
    if (this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
      try {
        this.websocket.send(JSON.stringify(messageWithId));
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        this.pendingMessages.push(messageWithId);
        return false;
      }
    } else {
      // Queue message for later sending
      this.pendingMessages.push(messageWithId);
      return false;
    }
  }

  /**
   * Send message to specific peer
   */
  sendToPeer(peerId, message) {
    return this.send({
      ...message,
      to: peerId,
      type: 'peer-message'
    });
  }

  /**
   * Send offer to peer
   */
  sendOffer(peerId, offer) {
    return this.sendToPeer(peerId, {
      type: 'offer',
      offer: offer
    });
  }

  /**
   * Send answer to peer
   */
  sendAnswer(peerId, answer) {
    return this.sendToPeer(peerId, {
      type: 'answer',
      answer: answer
    });
  }

  /**
   * Send ICE candidate to peer
   */
  sendIceCandidate(peerId, candidate) {
    return this.sendToPeer(peerId, {
      type: 'ice-candidate',
      candidate: candidate
    });
  }

  /**
   * Request list of available peers
   */
  requestPeerList() {
    return this.send({
      type: 'get-peers'
    });
  }

  /**
   * Announce device presence
   */
  announcePresence(deviceInfo) {
    return this.send({
      type: 'announce',
      deviceInfo: deviceInfo
    });
  }

  /**
   * Handle incoming message from signaling server
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle different message types
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      } else {
        console.warn(`No handler for message type: ${message.type}`);
      }
      
      this.emit('message', message);
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Set up message handlers
   */
  setupMessageHandlers() {
    this.messageHandlers.set('peer-message', (message) => {
      this.handlePeerMessage(message);
    });
    
    this.messageHandlers.set('peer-list', (message) => {
      this.emit('peerList', message.peers);
    });
    
    this.messageHandlers.set('peer-joined', (message) => {
      this.emit('peerJoined', message.deviceInfo);
    });
    
    this.messageHandlers.set('peer-left', (message) => {
      this.emit('peerLeft', message.deviceId);
    });
    
    this.messageHandlers.set('error', (message) => {
      console.error('Signaling server error:', message.error);
      this.emit('signalingError', message.error);
    });
  }

  /**
   * Handle peer-to-peer message
   */
  handlePeerMessage(message) {
    const { from, type } = message;
    
    switch (type) {
      case 'offer':
        this.emit('offer', { peerId: from, offer: message.offer });
        break;
      case 'answer':
        this.emit('answer', { peerId: from, answer: message.answer });
        break;
      case 'ice-candidate':
        this.emit('iceCandidate', { peerId: from, candidate: message.candidate });
        break;
      default:
        this.emit('peerMessage', { peerId: from, message });
    }
  }

  /**
   * Flush pending messages
   */
  flushPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (!this.send(message)) {
        // If sending fails, put it back at the front
        this.pendingMessages.unshift(message);
        break;
      }
    }
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `${this.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      pendingMessages: this.pendingMessages.length,
      websocketState: this.websocket?.readyState || 'none'
    };
  }
}

export default SignalingService;