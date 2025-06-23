/**
 * Unit tests for MeshNetworkManager
 */

import { jest } from '@jest/globals';
import MeshNetworkManager from '../../../../src/services/mesh/MeshNetworkManager.js';

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

describe('MeshNetworkManager', () => {
  let meshManager;
  let mockOptions;

  beforeEach(() => {
    mockOptions = {
      deviceId: 'test-device-1',
      deviceName: 'Test Device',
      deviceType: 'mobile',
      capabilities: ['alerts', 'relay'],
      discoveryInterval: 1000,
      heartbeatInterval: 500,
      maxPeers: 5
    };
    
    meshManager = new MeshNetworkManager(mockOptions);
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (meshManager) {
      meshManager.removeAllListeners();
    }
  });

  describe('Constructor', () => {
    test('should initialize with provided options', () => {
      expect(meshManager.deviceId).toBe('test-device-1');
      expect(meshManager.deviceInfo.name).toBe('Test Device');
      expect(meshManager.deviceInfo.type).toBe('mobile');
      expect(meshManager.config.maxPeers).toBe(5);
    });

    test('should generate device ID if not provided', () => {
      const manager = new MeshNetworkManager();
      expect(manager.deviceId).toBe('mock-uuid-1234');
    });

    test('should set default configuration values', () => {
      const manager = new MeshNetworkManager();
      expect(manager.config.discoveryIntervalMs).toBe(30000);
      expect(manager.config.heartbeatIntervalMs).toBe(10000);
      expect(manager.config.maxPeers).toBe(10);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const initSpy = jest.spyOn(meshManager, 'startDiscovery').mockResolvedValue();
      const heartbeatSpy = jest.spyOn(meshManager, 'startHeartbeat').mockImplementation();
      
      const initPromise = meshManager.initialize();
      
      expect(meshManager.isActive).toBe(true);
      await initPromise;
      
      expect(initSpy).toHaveBeenCalled();
      expect(heartbeatSpy).toHaveBeenCalled();
    });

    test('should emit initialized event', async () => {
      jest.spyOn(meshManager, 'startDiscovery').mockResolvedValue();
      jest.spyOn(meshManager, 'startHeartbeat').mockImplementation();
      
      const eventSpy = jest.fn();
      meshManager.on('initialized', eventSpy);
      
      await meshManager.initialize();
      
      expect(eventSpy).toHaveBeenCalledWith({ deviceId: 'test-device-1' });
    });
  });

  describe('Device Discovery', () => {
    test('should handle discovered device', () => {
      const deviceInfo = {
        id: 'peer-device-1',
        name: 'Peer Device',
        type: 'mobile',
        capabilities: ['alerts'],
        timestamp: Date.now()
      };
      
      const eventSpy = jest.fn();
      meshManager.on('deviceDiscovered', eventSpy);
      
      meshManager.handleDiscoveredDevice(deviceInfo);
      
      expect(meshManager.discoveredDevices.has('peer-device-1')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(deviceInfo);
    });

    test('should ignore self discovery', () => {
      const deviceInfo = {
        id: 'test-device-1', // Same as meshManager.deviceId
        name: 'Self Device',
        type: 'mobile',
        capabilities: ['alerts'],
        timestamp: Date.now()
      };
      
      meshManager.handleDiscoveredDevice(deviceInfo);
      
      expect(meshManager.discoveredDevices.has('test-device-1')).toBe(false);
    });

    test('should auto-connect to compatible devices', () => {
      const connectSpy = jest.spyOn(meshManager, 'connectToPeer').mockImplementation();
      
      const deviceInfo = {
        id: 'peer-device-1',
        name: 'Peer Device',
        type: 'mobile',
        capabilities: ['alerts'],
        timestamp: Date.now()
      };
      
      meshManager.handleDiscoveredDevice(deviceInfo);
      
      expect(connectSpy).toHaveBeenCalledWith('peer-device-1');
    });

    test('should not auto-connect when at max peers', () => {
      // Fill up peers to max capacity
      for (let i = 0; i < mockOptions.maxPeers; i++) {
        meshManager.peers.set(`peer-${i}`, { id: `peer-${i}` });
      }
      
      const connectSpy = jest.spyOn(meshManager, 'connectToPeer').mockImplementation();
      
      const deviceInfo = {
        id: 'peer-device-new',
        name: 'New Peer Device',
        type: 'mobile',
        capabilities: ['alerts'],
        timestamp: Date.now()
      };
      
      meshManager.handleDiscoveredDevice(deviceInfo);
      
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Peer Connection', () => {
    test('should establish connection to peer', async () => {
      const mockConnection = {
        id: 'peer-device-1',
        send: jest.fn(),
        close: jest.fn()
      };
      
      jest.spyOn(meshManager, 'establishConnection').mockResolvedValue(mockConnection);
      jest.spyOn(meshManager, 'sendHandshake').mockResolvedValue();
      
      const eventSpy = jest.fn();
      meshManager.on('peerConnected', eventSpy);
      
      // Add device to discovered devices first
      meshManager.discoveredDevices.set('peer-device-1', {
        id: 'peer-device-1',
        name: 'Peer Device'
      });
      
      await meshManager.connectToPeer('peer-device-1');
      
      expect(meshManager.peers.has('peer-device-1')).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should not connect to already connected peer', async () => {
      meshManager.peers.set('peer-device-1', { id: 'peer-device-1' });
      
      const establishSpy = jest.spyOn(meshManager, 'establishConnection');
      
      await meshManager.connectToPeer('peer-device-1');
      
      expect(establishSpy).not.toHaveBeenCalled();
    });

    test('should handle connection failure', async () => {
      const error = new Error('Connection failed');
      jest.spyOn(meshManager, 'establishConnection').mockRejectedValue(error);
      
      const eventSpy = jest.fn();
      meshManager.on('connectionError', eventSpy);
      
      await meshManager.connectToPeer('peer-device-1');
      
      expect(eventSpy).toHaveBeenCalledWith({
        peerId: 'peer-device-1',
        error
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      // Set up a mock peer
      meshManager.peers.set('peer-device-1', {
        id: 'peer-device-1',
        connection: { send: jest.fn() },
        lastHeartbeat: Date.now()
      });
    });

    test('should send message to peer', async () => {
      const message = { type: 'test', data: 'hello' };
      const mockSend = jest.fn();
      
      meshManager.peers.get('peer-device-1').connection.send = mockSend;
      
      await meshManager.sendMessageToPeer('peer-device-1', message);
      
      expect(mockSend).toHaveBeenCalled();
      const sentData = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentData.type).toBe('test');
      expect(sentData.data).toBe('hello');
      expect(sentData.from).toBe('test-device-1');
    });

    test('should broadcast message to all peers', async () => {
      // Add another peer
      meshManager.peers.set('peer-device-2', {
        id: 'peer-device-2',
        connection: { send: jest.fn() },
        lastHeartbeat: Date.now()
      });
      
      const message = { type: 'broadcast', data: 'hello all' };
      
      const results = await meshManager.broadcastMessage(message);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle received handshake message', () => {
      const message = {
        type: 'handshake',
        deviceInfo: { id: 'peer-device-1', name: 'Peer' }
      };
      
      const eventSpy = jest.fn();
      meshManager.on('handshakeReceived', eventSpy);
      
      meshManager.handleReceivedMessage('peer-device-1', JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith({
        peerId: 'peer-device-1',
        deviceInfo: message.deviceInfo
      });
    });

    test('should handle received alert message', () => {
      const alert = {
        alertId: 'alert-123',
        type: 'emergency',
        message: 'Test alert'
      };
      
      const message = {
        type: 'alert',
        alert: alert,
        hops: 1,
        maxHops: 5,
        originDevice: 'origin-device'
      };
      
      const eventSpy = jest.fn();
      meshManager.on('alertReceived', eventSpy);
      
      meshManager.handleReceivedMessage('peer-device-1', JSON.stringify(message));
      
      expect(meshManager.alertCache.has('alert-123')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({
        alert,
        peerId: 'peer-device-1',
        hops: 1
      });
    });

    test('should not process duplicate alerts', () => {
      const alert = {
        alertId: 'alert-123',
        type: 'emergency',
        message: 'Test alert'
      };
      
      // Add alert to cache first
      meshManager.alertCache.set('alert-123', alert);
      
      const message = {
        type: 'alert',
        alert: alert,
        hops: 1,
        maxHops: 5,
        originDevice: 'origin-device'
      };
      
      const eventSpy = jest.fn();
      meshManager.on('alertReceived', eventSpy);
      
      meshManager.handleReceivedMessage('peer-device-1', JSON.stringify(message));
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('Alert Sharing', () => {
    beforeEach(() => {
      meshManager.peers.set('peer-device-1', {
        id: 'peer-device-1',
        connection: { send: jest.fn() },
        lastHeartbeat: Date.now()
      });
    });

    test('should share alert with mesh network', async () => {
      const alert = {
        alertId: 'alert-123',
        type: 'emergency',
        message: 'Test alert',
        severity: 'high'
      };
      
      const broadcastSpy = jest.spyOn(meshManager, 'broadcastMessage').mockResolvedValue([]);
      const eventSpy = jest.fn();
      meshManager.on('alertShared', eventSpy);
      
      await meshManager.shareAlert(alert);
      
      expect(meshManager.alertCache.has('alert-123')).toBe(true);
      expect(broadcastSpy).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should limit alert cache size', async () => {
      // Set small cache size for testing
      meshManager.config.maxAlertCacheSize = 2;
      
      // Add alerts to fill cache
      await meshManager.shareAlert({ alertId: 'alert-1', message: 'Alert 1' });
      await meshManager.shareAlert({ alertId: 'alert-2', message: 'Alert 2' });
      await meshManager.shareAlert({ alertId: 'alert-3', message: 'Alert 3' });
      
      expect(meshManager.alertCache.size).toBe(2);
      expect(meshManager.alertCache.has('alert-1')).toBe(false); // Should be evicted
      expect(meshManager.alertCache.has('alert-3')).toBe(true);
    });
  });

  describe('Heartbeat Mechanism', () => {
    test('should send heartbeats to all peers', async () => {
      meshManager.peers.set('peer-device-1', {
        id: 'peer-device-1',
        connection: { send: jest.fn() },
        lastHeartbeat: Date.now()
      });
      
      const broadcastSpy = jest.spyOn(meshManager, 'broadcastMessage').mockResolvedValue([]);
      
      await meshManager.sendHeartbeats();
      
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat' })
      );
    });

    test('should disconnect stale peers', () => {
      const staleTime = Date.now() - (mockOptions.heartbeatInterval * 4);
      
      meshManager.peers.set('stale-peer', {
        id: 'stale-peer',
        connection: { close: jest.fn() },
        lastHeartbeat: staleTime
      });
      
      const disconnectSpy = jest.spyOn(meshManager, 'disconnectPeer');
      
      meshManager.checkPeerHealth();
      
      expect(disconnectSpy).toHaveBeenCalledWith('stale-peer');
    });
  });

  describe('Network Status', () => {
    test('should return current network status', () => {
      meshManager.peers.set('peer-1', {
        id: 'peer-1',
        deviceInfo: { name: 'Peer 1' },
        connectedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      
      meshManager.alertCache.set('alert-1', { alertId: 'alert-1' });
      
      const status = meshManager.getNetworkStatus();
      
      expect(status.isActive).toBe(false); // Not initialized yet
      expect(status.deviceId).toBe('test-device-1');
      expect(status.peersConnected).toBe(1);
      expect(status.alertsCached).toBe(1);
      expect(status.peers).toHaveLength(1);
    });

    test('should return cached alerts', () => {
      const alert1 = { alertId: 'alert-1', message: 'Alert 1' };
      const alert2 = { alertId: 'alert-2', message: 'Alert 2' };
      
      meshManager.alertCache.set('alert-1', alert1);
      meshManager.alertCache.set('alert-2', alert2);
      
      const alerts = meshManager.getCachedAlerts();
      
      expect(alerts).toHaveLength(2);
      expect(alerts).toContain(alert1);
      expect(alerts).toContain(alert2);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      meshManager.isActive = true;
      meshManager.discoveryInterval = setInterval(() => {}, 1000);
      meshManager.heartbeatInterval = setInterval(() => {}, 1000);
      
      meshManager.peers.set('peer-1', {
        id: 'peer-1',
        connection: { close: jest.fn() }
      });
      
      const disconnectSpy = jest.spyOn(meshManager, 'disconnectPeer');
      const eventSpy = jest.fn();
      meshManager.on('shutdown', eventSpy);
      
      await meshManager.shutdown();
      
      expect(meshManager.isActive).toBe(false);
      expect(meshManager.discoveryInterval).toBeNull();
      expect(meshManager.heartbeatInterval).toBeNull();
      expect(disconnectSpy).toHaveBeenCalledWith('peer-1');
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});