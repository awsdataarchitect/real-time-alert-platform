/**
 * Unit tests for SignalingService
 */

import { jest } from '@jest/globals';
import SignalingService from '../../../../src/services/mesh/SignalingService.js';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null
};

global.WebSocket = jest.fn(() => mockWebSocket);
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSED = 3;

describe('SignalingService', () => {
  let signalingService;
  const deviceId = 'test-device-1';
  const signalServerUrl = 'ws://localhost:8080/signal';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset mock WebSocket
    Object.assign(mockWebSocket, {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1
    });
    
    signalingService = new SignalingService({
      deviceId,
      signalServerUrl,
      maxReconnectAttempts: 3,
      reconnectDelay: 100
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (signalingService) {
      signalingService.removeAllListeners();
    }
  });

  describe('Constructor', () => {
    test('should initialize with provided options', () => {
      expect(signalingService.deviceId).toBe(deviceId);
      expect(signalingService.signalServerUrl).toBe(signalServerUrl);
      expect(signalingService.maxReconnectAttempts).toBe(3);
      expect(signalingService.isConnected).toBe(false);
    });

    test('should use default values when options not provided', () => {
      const service = new SignalingService({ deviceId });
      expect(service.signalServerUrl).toBe('ws://localhost:8080/signal');
      expect(service.maxReconnectAttempts).toBe(5);
      expect(service.reconnectDelay).toBe(1000);
    });
  });

  describe('Connection Management', () => {
    test('should connect to signaling server successfully', async () => {
      const connectPromise = signalingService.connect();
      
      expect(global.WebSocket).toHaveBeenCalledWith(signalServerUrl);
      
      // Simulate successful connection
      mockWebSocket.onopen();
      
      await connectPromise;
      
      expect(signalingService.isConnected).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"register"')
      );
    });

    test('should emit connected event on successful connection', async () => {
      const eventSpy = jest.fn();
      signalingService.on('connected', eventSpy);
      
      const connectPromise = signalingService.connect();
      mockWebSocket.onopen();
      
      await connectPromise;
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      const eventSpy = jest.fn();
      signalingService.on('error', eventSpy);
      
      const connectPromise = signalingService.connect();
      
      // Simulate connection error
      mockWebSocket.onerror(error);
      
      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(eventSpy).toHaveBeenCalledWith(error);
    });

    test('should disconnect gracefully', () => {
      signalingService.websocket = mockWebSocket;
      signalingService.isConnected = true;
      
      signalingService.disconnect();
      
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(signalingService.isConnected).toBe(false);
    });

    test('should handle connection close and attempt reconnect', async () => {
      signalingService.isConnected = true;
      signalingService.websocket = mockWebSocket;
      
      const reconnectSpy = jest.spyOn(signalingService, 'attemptReconnect');
      const eventSpy = jest.fn();
      signalingService.on('disconnected', eventSpy);
      
      // Simulate unexpected close (not code 1000)
      mockWebSocket.onclose({ code: 1006, reason: 'Connection lost' });
      
      expect(signalingService.isConnected).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({ code: 1006, reason: 'Connection lost' });
      expect(reconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      signalingService.isConnected = true;
      signalingService.websocket = mockWebSocket;
    });

    test('should send message when connected', () => {
      const message = { type: 'test', data: 'hello' };
      
      const result = signalingService.send(message);
      
      expect(result).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalled();
      
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('test');
      expect(sentData.data).toBe('hello');
      expect(sentData.from).toBe(deviceId);
      expect(sentData.messageId).toBeDefined();
    });

    test('should queue message when not connected', () => {
      signalingService.isConnected = false;
      const message = { type: 'test', data: 'hello' };
      
      const result = signalingService.send(message);
      
      expect(result).toBe(false);
      expect(signalingService.pendingMessages).toHaveLength(1);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should send offer to peer', () => {
      const peerId = 'peer-1';
      const offer = { type: 'offer', sdp: 'mock-sdp' };
      
      signalingService.sendOffer(peerId, offer);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.to).toBe(peerId);
      expect(sentData.type).toBe('peer-message');
      expect(sentData.offer).toBe(offer);
    });

    test('should send answer to peer', () => {
      const peerId = 'peer-1';
      const answer = { type: 'answer', sdp: 'mock-sdp' };
      
      signalingService.sendAnswer(peerId, answer);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.to).toBe(peerId);
      expect(sentData.answer).toBe(answer);
    });

    test('should send ICE candidate to peer', () => {
      const peerId = 'peer-1';
      const candidate = { candidate: 'mock-candidate' };
      
      signalingService.sendIceCandidate(peerId, candidate);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.to).toBe(peerId);
      expect(sentData.candidate).toBe(candidate);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      signalingService.isConnected = true;
      signalingService.websocket = mockWebSocket;
    });

    test('should handle peer list message', () => {
      const peers = [
        { id: 'peer-1', name: 'Peer 1' },
        { id: 'peer-2', name: 'Peer 2' }
      ];
      
      const eventSpy = jest.fn();
      signalingService.on('peerList', eventSpy);
      
      const message = { type: 'peer-list', peers };
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith(peers);
    });

    test('should handle peer joined message', () => {
      const deviceInfo = { id: 'new-peer', name: 'New Peer' };
      
      const eventSpy = jest.fn();
      signalingService.on('peerJoined', eventSpy);
      
      const message = { type: 'peer-joined', deviceInfo };
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith(deviceInfo);
    });

    test('should handle peer left message', () => {
      const deviceId = 'leaving-peer';
      
      const eventSpy = jest.fn();
      signalingService.on('peerLeft', eventSpy);
      
      const message = { type: 'peer-left', deviceId };
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith(deviceId);
    });

    test('should handle offer from peer', () => {
      const offer = { type: 'offer', sdp: 'peer-offer-sdp' };
      const fromPeer = 'peer-1';
      
      const eventSpy = jest.fn();
      signalingService.on('offer', eventSpy);
      
      const message = {
        type: 'peer-message',
        from: fromPeer,
        offer
      };
      
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId: fromPeer, offer });
    });

    test('should handle answer from peer', () => {
      const answer = { type: 'answer', sdp: 'peer-answer-sdp' };
      const fromPeer = 'peer-1';
      
      const eventSpy = jest.fn();
      signalingService.on('answer', eventSpy);
      
      const message = {
        type: 'peer-message',
        from: fromPeer,
        answer
      };
      
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId: fromPeer, answer });
    });

    test('should handle ICE candidate from peer', () => {
      const candidate = { candidate: 'peer-ice-candidate' };
      const fromPeer = 'peer-1';
      
      const eventSpy = jest.fn();
      signalingService.on('iceCandidate', eventSpy);
      
      const message = {
        type: 'peer-message',
        from: fromPeer,
        candidate
      };
      
      signalingService.handleMessage(JSON.stringify(message));
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId: fromPeer, candidate });
    });

    test('should handle malformed messages gracefully', () => {
      const errorSpy = jest.fn();
      signalingService.on('error', errorSpy);
      
      signalingService.handleMessage('invalid-json');
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle unknown message types', () => {
      const message = { type: 'unknown-type', data: 'test' };
      
      // Should not throw error
      expect(() => {
        signalingService.handleMessage(JSON.stringify(message));
      }).not.toThrow();
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection with exponential backoff', async () => {
      const connectSpy = jest.spyOn(signalingService, 'connect').mockResolvedValue();
      
      signalingService.attemptReconnect();
      
      expect(signalingService.reconnectAttempts).toBe(1);
      
      // Fast forward timer
      jest.advanceTimersByTime(100); // Initial delay
      
      await Promise.resolve(); // Allow async operations to complete
      
      expect(connectSpy).toHaveBeenCalled();
    });

    test('should stop reconnecting after max attempts', async () => {
      const connectSpy = jest.spyOn(signalingService, 'connect').mockRejectedValue(new Error('Failed'));
      const eventSpy = jest.fn();
      signalingService.on('reconnectFailed', eventSpy);
      
      // Simulate max reconnect attempts
      signalingService.reconnectAttempts = signalingService.maxReconnectAttempts;
      
      signalingService.attemptReconnect();
      
      jest.advanceTimersByTime(800); // 100 * 2^3 = 800ms delay for 4th attempt
      
      await Promise.resolve();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should flush pending messages on connection', () => {
      signalingService.pendingMessages = [
        { type: 'test1', data: 'message1' },
        { type: 'test2', data: 'message2' }
      ];
      
      signalingService.isConnected = true;
      signalingService.websocket = mockWebSocket;
      
      signalingService.flushPendingMessages();
      
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(signalingService.pendingMessages).toHaveLength(0);
    });

    test('should generate unique message IDs', () => {
      const id1 = signalingService.generateMessageId();
      const id2 = signalingService.generateMessageId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toContain(deviceId);
    });

    test('should return connection status', () => {
      signalingService.isConnected = true;
      signalingService.reconnectAttempts = 2;
      signalingService.pendingMessages = [{ type: 'test' }];
      signalingService.websocket = mockWebSocket;
      
      const status = signalingService.getStatus();
      
      expect(status).toEqual({
        isConnected: true,
        reconnectAttempts: 2,
        pendingMessages: 1,
        websocketState: 1
      });
    });
  });

  describe('API Methods', () => {
    beforeEach(() => {
      signalingService.isConnected = true;
      signalingService.websocket = mockWebSocket;
    });

    test('should request peer list', () => {
      signalingService.requestPeerList();
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('get-peers');
    });

    test('should announce device presence', () => {
      const deviceInfo = { id: deviceId, name: 'Test Device' };
      
      signalingService.announcePresence(deviceInfo);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentData.type).toBe('announce');
      expect(sentData.deviceInfo).toBe(deviceInfo);
    });
  });
});