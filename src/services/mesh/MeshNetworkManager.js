/**
 * MeshNetworkManager - Core mesh networking service for peer-to-peer communication
 * Handles device discovery, connection management, and alert sharing in mesh networks
 */

import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

class MeshNetworkManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.deviceId = options.deviceId || uuidv4();
    this.deviceInfo = {
      id: this.deviceId,
      name: options.deviceName || 'Unknown Device',
      type: options.deviceType || 'mobile',
      capabilities: options.capabilities || ['alerts', 'relay'],
      location: options.location || null,
      timestamp: Date.now()
    };
    
    this.peers = new Map(); // Connected peers
    this.discoveredDevices = new Map(); // Discovered but not connected devices
    this.connections = new Map(); // Active connections
    this.alertCache = new Map(); // Cached alerts for sharing
    this.messageQueue = []; // Queue for messages when offline
    
    this.isActive = false;
    this.discoveryInterval = null;
    this.heartbeatInterval = null;
    
    // Configuration
    this.config = {
      discoveryIntervalMs: options.discoveryInterval || 30000, // 30 seconds
      heartbeatIntervalMs: options.heartbeatInterval || 10000, // 10 seconds
      connectionTimeoutMs: options.connectionTimeout || 5000, // 5 seconds
      maxPeers: options.maxPeers || 10,
      maxAlertCacheSize: options.maxAlertCacheSize || 100,
      signalServerUrl: options.signalServerUrl || null
    };
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the mesh network manager
   */
  async initialize() {
    try {
      this.isActive = true;
      await this.startDiscovery();
      this.startHeartbeat();
      this.emit('initialized', { deviceId: this.deviceId });
      console.log(`Mesh network initialized for device: ${this.deviceId}`);
    } catch (error) {
      console.error('Failed to initialize mesh network:', error);
      throw error;
    }
  }

  /**
   * Shutdown the mesh network manager
   */
  async shutdown() {
    this.isActive = false;
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close all connections
    for (const [peerId, connection] of this.connections) {
      await this.disconnectPeer(peerId);
    }
    
    this.peers.clear();
    this.discoveredDevices.clear();
    this.connections.clear();
    
    this.emit('shutdown');
    console.log('Mesh network shutdown complete');
  }

  /**
   * Start device discovery process
   */
  async startDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    // Initial discovery
    await this.discoverDevices();
    
    // Set up periodic discovery
    this.discoveryInterval = setInterval(async () => {
      if (this.isActive) {
        await this.discoverDevices();
      }
    }, this.config.discoveryIntervalMs);
  }

  /**
   * Discover nearby devices using various methods
   */
  async discoverDevices() {
    try {
      // Broadcast discovery message
      await this.broadcastDiscovery();
      
      // Clean up old discovered devices
      this.cleanupDiscoveredDevices();
      
      this.emit('discoveryComplete', {
        discoveredCount: this.discoveredDevices.size,
        connectedCount: this.peers.size
      });
    } catch (error) {
      console.error('Device discovery failed:', error);
      this.emit('discoveryError', error);
    }
  }

  /**
   * Broadcast discovery message to find nearby devices
   */
  async broadcastDiscovery() {
    const discoveryMessage = {
      type: 'discovery',
      deviceInfo: this.deviceInfo,
      timestamp: Date.now()
    };
    
    // In a real implementation, this would use WebRTC, Bluetooth, or WiFi Direct
    // For now, we'll simulate the discovery process
    this.simulateDiscovery(discoveryMessage);
  }

  /**
   * Simulate device discovery (replace with actual implementation)
   */
  simulateDiscovery(message) {
    // This would be replaced with actual discovery mechanisms
    // such as WebRTC signaling, Bluetooth scanning, or WiFi Direct
    console.log('Broadcasting discovery message:', message);
  }

  /**
   * Handle discovered device
   */
  handleDiscoveredDevice(deviceInfo) {
    if (deviceInfo.id === this.deviceId) {
      return; // Ignore self
    }
    
    const existingDevice = this.discoveredDevices.get(deviceInfo.id);
    if (!existingDevice || existingDevice.timestamp < deviceInfo.timestamp) {
      this.discoveredDevices.set(deviceInfo.id, {
        ...deviceInfo,
        discoveredAt: Date.now()
      });
      
      this.emit('deviceDiscovered', deviceInfo);
      
      // Auto-connect if we have capacity and device is compatible
      if (this.shouldAutoConnect(deviceInfo)) {
        this.connectToPeer(deviceInfo.id);
      }
    }
  }

  /**
   * Determine if we should auto-connect to a discovered device
   */
  shouldAutoConnect(deviceInfo) {
    return (
      this.peers.size < this.config.maxPeers &&
      deviceInfo.capabilities.includes('alerts') &&
      !this.peers.has(deviceInfo.id) &&
      !this.connections.has(deviceInfo.id)
    );
  }

  /**
   * Connect to a peer device
   */
  async connectToPeer(peerId) {
    if (this.connections.has(peerId) || this.peers.has(peerId)) {
      return; // Already connected or connecting
    }
    
    try {
      this.connections.set(peerId, { status: 'connecting', timestamp: Date.now() });
      
      // In a real implementation, establish WebRTC connection
      const connection = await this.establishConnection(peerId);
      
      if (connection) {
        this.peers.set(peerId, {
          id: peerId,
          connection: connection,
          deviceInfo: this.discoveredDevices.get(peerId),
          connectedAt: Date.now(),
          lastHeartbeat: Date.now()
        });
        
        this.connections.delete(peerId);
        this.emit('peerConnected', { peerId, deviceInfo: this.discoveredDevices.get(peerId) });
        
        // Send initial handshake
        await this.sendHandshake(peerId);
      }
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      this.connections.delete(peerId);
      this.emit('connectionError', { peerId, error });
    }
  }

  /**
   * Establish connection to peer (placeholder for actual implementation)
   */
  async establishConnection(peerId) {
    // This would implement actual connection establishment
    // using WebRTC, WebSocket, or other P2P protocols
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: peerId,
          send: (data) => this.simulateSend(peerId, data),
          close: () => this.simulateClose(peerId)
        });
      }, 1000);
    });
  }

  /**
   * Simulate sending data to peer
   */
  simulateSend(peerId, data) {
    console.log(`Sending to ${peerId}:`, data);
    // In real implementation, this would send data through the connection
  }

  /**
   * Simulate closing connection
   */
  simulateClose(peerId) {
    console.log(`Closing connection to ${peerId}`);
  }

  /**
   * Disconnect from a peer
   */
  async disconnectPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        if (peer.connection && peer.connection.close) {
          peer.connection.close();
        }
        this.peers.delete(peerId);
        this.emit('peerDisconnected', { peerId });
      } catch (error) {
        console.error(`Error disconnecting from peer ${peerId}:`, error);
      }
    }
  }

  /**
   * Send handshake message to newly connected peer
   */
  async sendHandshake(peerId) {
    const handshakeMessage = {
      type: 'handshake',
      deviceInfo: this.deviceInfo,
      alertCount: this.alertCache.size,
      timestamp: Date.now()
    };
    
    await this.sendMessageToPeer(peerId, handshakeMessage);
  }

  /**
   * Send message to specific peer
   */
  async sendMessageToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.connection) {
      try {
        const serializedMessage = JSON.stringify({
          ...message,
          from: this.deviceId,
          to: peerId,
          messageId: uuidv4(),
          timestamp: Date.now()
        });
        
        peer.connection.send(serializedMessage);
        this.emit('messageSent', { peerId, message });
      } catch (error) {
        console.error(`Failed to send message to peer ${peerId}:`, error);
        this.emit('messageError', { peerId, error });
      }
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  async broadcastMessage(message) {
    const results = [];
    for (const peerId of this.peers.keys()) {
      try {
        await this.sendMessageToPeer(peerId, message);
        results.push({ peerId, success: true });
      } catch (error) {
        results.push({ peerId, success: false, error });
      }
    }
    return results;
  }

  /**
   * Share alert with mesh network
   */
  async shareAlert(alert) {
    // Cache the alert locally
    this.alertCache.set(alert.alertId, {
      ...alert,
      sharedAt: Date.now(),
      sharedBy: this.deviceId
    });
    
    // Limit cache size
    if (this.alertCache.size > this.config.maxAlertCacheSize) {
      const oldestKey = this.alertCache.keys().next().value;
      this.alertCache.delete(oldestKey);
    }
    
    // Broadcast alert to all peers
    const alertMessage = {
      type: 'alert',
      alert: alert,
      hops: 0,
      maxHops: 5,
      originDevice: this.deviceId
    };
    
    const results = await this.broadcastMessage(alertMessage);
    this.emit('alertShared', { alert, results });
    
    return results;
  }

  /**
   * Handle received message from peer
   */
  handleReceivedMessage(peerId, messageData) {
    try {
      const message = JSON.parse(messageData);
      
      switch (message.type) {
        case 'handshake':
          this.handleHandshake(peerId, message);
          break;
        case 'alert':
          this.handleReceivedAlert(peerId, message);
          break;
        case 'heartbeat':
          this.handleHeartbeat(peerId, message);
          break;
        case 'discovery':
          this.handleDiscoveredDevice(message.deviceInfo);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
      
      this.emit('messageReceived', { peerId, message });
    } catch (error) {
      console.error('Failed to handle received message:', error);
      this.emit('messageError', { peerId, error });
    }
  }

  /**
   * Handle handshake from peer
   */
  handleHandshake(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.deviceInfo = message.deviceInfo;
      peer.lastHeartbeat = Date.now();
    }
    
    this.emit('handshakeReceived', { peerId, deviceInfo: message.deviceInfo });
  }

  /**
   * Handle received alert from peer
   */
  handleReceivedAlert(peerId, message) {
    const { alert, hops, maxHops, originDevice } = message;
    
    // Avoid processing our own alerts or duplicates
    if (originDevice === this.deviceId || this.alertCache.has(alert.alertId)) {
      return;
    }
    
    // Cache the alert
    this.alertCache.set(alert.alertId, {
      ...alert,
      receivedAt: Date.now(),
      receivedFrom: peerId,
      hops: hops
    });
    
    this.emit('alertReceived', { alert, peerId, hops });
    
    // Relay alert to other peers if within hop limit
    if (hops < maxHops) {
      const relayMessage = {
        ...message,
        hops: hops + 1
      };
      
      // Relay to all peers except the sender
      for (const [otherPeerId] of this.peers) {
        if (otherPeerId !== peerId) {
          this.sendMessageToPeer(otherPeerId, relayMessage);
        }
      }
    }
  }

  /**
   * Handle heartbeat from peer
   */
  handleHeartbeat(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastHeartbeat = Date.now();
    }
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isActive) {
        this.sendHeartbeats();
        this.checkPeerHealth();
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Send heartbeat to all connected peers
   */
  async sendHeartbeats() {
    const heartbeatMessage = {
      type: 'heartbeat',
      deviceInfo: this.deviceInfo,
      timestamp: Date.now()
    };
    
    await this.broadcastMessage(heartbeatMessage);
  }

  /**
   * Check health of connected peers and disconnect stale ones
   */
  checkPeerHealth() {
    const now = Date.now();
    const staleThreshold = this.config.heartbeatIntervalMs * 3; // 3 missed heartbeats
    
    for (const [peerId, peer] of this.peers) {
      if (now - peer.lastHeartbeat > staleThreshold) {
        console.log(`Peer ${peerId} appears stale, disconnecting`);
        this.disconnectPeer(peerId);
      }
    }
  }

  /**
   * Clean up old discovered devices
   */
  cleanupDiscoveredDevices() {
    const now = Date.now();
    const staleThreshold = this.config.discoveryIntervalMs * 3;
    
    for (const [deviceId, device] of this.discoveredDevices) {
      if (now - device.discoveredAt > staleThreshold && !this.peers.has(deviceId)) {
        this.discoveredDevices.delete(deviceId);
      }
    }
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    this.on('error', (error) => {
      console.error('Mesh network error:', error);
    });
  }

  /**
   * Get network status
   */
  getNetworkStatus() {
    return {
      isActive: this.isActive,
      deviceId: this.deviceId,
      peersConnected: this.peers.size,
      devicesDiscovered: this.discoveredDevices.size,
      alertsCached: this.alertCache.size,
      peers: Array.from(this.peers.values()).map(peer => ({
        id: peer.id,
        deviceInfo: peer.deviceInfo,
        connectedAt: peer.connectedAt,
        lastHeartbeat: peer.lastHeartbeat
      }))
    };
  }

  /**
   * Get cached alerts
   */
  getCachedAlerts() {
    return Array.from(this.alertCache.values());
  }

  /**
   * Update device location
   */
  updateLocation(location) {
    this.deviceInfo.location = location;
    this.deviceInfo.timestamp = Date.now();
    
    // Broadcast updated device info
    const updateMessage = {
      type: 'deviceUpdate',
      deviceInfo: this.deviceInfo
    };
    
    this.broadcastMessage(updateMessage);
  }
}

export default MeshNetworkManager;