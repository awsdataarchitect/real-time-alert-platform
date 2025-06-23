/**
 * Unit tests for WebRTCConnection
 */

import { jest } from '@jest/globals';
import WebRTCConnection from '../../../../src/services/mesh/WebRTCConnection.js';

// Mock WebRTC APIs
const mockRTCPeerConnection = {
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  addIceCandidate: jest.fn(),
  createDataChannel: jest.fn(),
  close: jest.fn(),
  getStats: jest.fn(),
  connectionState: 'new',
  onicecandidate: null,
  onconnectionstatechange: null,
  ondatachannel: null
};

const mockDataChannel = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 'open',
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null
};

// Mock global RTCPeerConnection
global.RTCPeerConnection = jest.fn(() => mockRTCPeerConnection);

describe('WebRTCConnection', () => {
  let connection;
  const peerId = 'test-peer-1';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock objects
    Object.assign(mockRTCPeerConnection, {
      createOffer: jest.fn(),
      createAnswer: jest.fn(),
      setLocalDescription: jest.fn(),
      setRemoteDescription: jest.fn(),
      addIceCandidate: jest.fn(),
      createDataChannel: jest.fn().mockReturnValue(mockDataChannel),
      close: jest.fn(),
      getStats: jest.fn(),
      connectionState: 'new'
    });
    
    Object.assign(mockDataChannel, {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 'open'
    });
    
    connection = new WebRTCConnection(peerId, true);
  });

  afterEach(() => {
    if (connection) {
      connection.removeAllListeners();
    }
  });

  describe('Constructor', () => {
    test('should initialize with peer ID and initiator flag', () => {
      expect(connection.peerId).toBe(peerId);
      expect(connection.isInitiator).toBe(true);
      expect(connection.isConnected).toBe(false);
      expect(connection.connectionState).toBe('new');
    });

    test('should create peer connection with proper configuration', () => {
      expect(global.RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      });
    });

    test('should create data channel if initiator', () => {
      expect(mockRTCPeerConnection.createDataChannel).toHaveBeenCalledWith('alerts', {
        ordered: true,
        maxRetransmits: 3
      });
    });

    test('should not create data channel if not initiator', () => {
      jest.clearAllMocks();
      const nonInitiatorConnection = new WebRTCConnection(peerId, false);
      
      expect(mockRTCPeerConnection.createDataChannel).not.toHaveBeenCalled();
    });
  });

  describe('Offer/Answer Exchange', () => {
    test('should create and send offer', async () => {
      const mockOffer = { type: 'offer', sdp: 'mock-offer-sdp' };
      mockRTCPeerConnection.createOffer.mockResolvedValue(mockOffer);
      mockRTCPeerConnection.setLocalDescription.mockResolvedValue();
      
      const eventSpy = jest.fn();
      connection.on('offer', eventSpy);
      
      const result = await connection.createOffer();
      
      expect(mockRTCPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
      expect(result).toBe(mockOffer);
      expect(eventSpy).toHaveBeenCalledWith({
        peerId,
        offer: mockOffer
      });
    });

    test('should create and send answer', async () => {
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' };
      mockRTCPeerConnection.createAnswer.mockResolvedValue(mockAnswer);
      mockRTCPeerConnection.setLocalDescription.mockResolvedValue();
      
      const eventSpy = jest.fn();
      connection.on('answer', eventSpy);
      
      const result = await connection.createAnswer();
      
      expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(mockAnswer);
      expect(result).toBe(mockAnswer);
      expect(eventSpy).toHaveBeenCalledWith({
        peerId,
        answer: mockAnswer
      });
    });

    test('should handle received offer', async () => {
      const mockOffer = { type: 'offer', sdp: 'received-offer-sdp' };
      const mockAnswer = { type: 'answer', sdp: 'response-answer-sdp' };
      
      mockRTCPeerConnection.setRemoteDescription.mockResolvedValue();
      mockRTCPeerConnection.createAnswer.mockResolvedValue(mockAnswer);
      mockRTCPeerConnection.setLocalDescription.mockResolvedValue();
      
      const result = await connection.handleOffer(mockOffer);
      
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(mockOffer);
      expect(result).toBe(mockAnswer);
    });

    test('should handle received answer', async () => {
      const mockAnswer = { type: 'answer', sdp: 'received-answer-sdp' };
      mockRTCPeerConnection.setRemoteDescription.mockResolvedValue();
      
      await connection.handleAnswer(mockAnswer);
      
      expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(mockAnswer);
    });
  });

  describe('ICE Candidate Handling', () => {
    test('should handle ICE candidate events', () => {
      const mockCandidate = { candidate: 'mock-ice-candidate' };
      const eventSpy = jest.fn();
      connection.on('iceCandidate', eventSpy);
      
      // Simulate ICE candidate event
      mockRTCPeerConnection.onicecandidate({ candidate: mockCandidate });
      
      expect(eventSpy).toHaveBeenCalledWith({
        peerId,
        candidate: mockCandidate
      });
    });

    test('should add received ICE candidate', async () => {
      const mockCandidate = { candidate: 'received-ice-candidate' };
      mockRTCPeerConnection.addIceCandidate.mockResolvedValue();
      
      await connection.addIceCandidate(mockCandidate);
      
      expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(mockCandidate);
    });

    test('should handle ICE candidate errors gracefully', async () => {
      const mockCandidate = { candidate: 'invalid-candidate' };
      const error = new Error('Invalid ICE candidate');
      mockRTCPeerConnection.addIceCandidate.mockRejectedValue(error);
      
      const errorSpy = jest.fn();
      connection.on('error', errorSpy);
      
      await connection.addIceCandidate(mockCandidate);
      
      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('Connection State Management', () => {
    test('should handle connection state changes', () => {
      const connectedSpy = jest.fn();
      const disconnectedSpy = jest.fn();
      const stateChangeSpy = jest.fn();
      
      connection.on('connected', connectedSpy);
      connection.on('disconnected', disconnectedSpy);
      connection.on('connectionStateChange', stateChangeSpy);
      
      // Simulate connection established
      mockRTCPeerConnection.connectionState = 'connected';
      mockRTCPeerConnection.onconnectionstatechange();
      
      expect(connection.isConnected).toBe(true);
      expect(connection.connectionState).toBe('connected');
      expect(connectedSpy).toHaveBeenCalledWith({ peerId });
      expect(stateChangeSpy).toHaveBeenCalledWith({ peerId, state: 'connected' });
      
      // Simulate disconnection
      mockRTCPeerConnection.connectionState = 'disconnected';
      mockRTCPeerConnection.onconnectionstatechange();
      
      expect(connection.isConnected).toBe(false);
      expect(disconnectedSpy).toHaveBeenCalledWith({ peerId });
    });
  });

  describe('Data Channel Operations', () => {
    test('should set up data channel event handlers', () => {
      expect(mockDataChannel.onopen).toBeDefined();
      expect(mockDataChannel.onclose).toBeDefined();
      expect(mockDataChannel.onmessage).toBeDefined();
      expect(mockDataChannel.onerror).toBeDefined();
    });

    test('should handle data channel open event', () => {
      const eventSpy = jest.fn();
      connection.on('dataChannelOpen', eventSpy);
      
      mockDataChannel.onopen();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });

    test('should handle data channel close event', () => {
      const eventSpy = jest.fn();
      connection.on('dataChannelClose', eventSpy);
      
      mockDataChannel.onclose();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });

    test('should handle received messages', () => {
      const testData = { type: 'test', message: 'hello' };
      const eventSpy = jest.fn();
      connection.on('message', eventSpy);
      
      mockDataChannel.onmessage({ data: JSON.stringify(testData) });
      
      expect(eventSpy).toHaveBeenCalledWith({
        peerId,
        data: testData
      });
    });

    test('should handle malformed messages gracefully', () => {
      const errorSpy = jest.fn();
      connection.on('error', errorSpy);
      
      mockDataChannel.onmessage({ data: 'invalid-json' });
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should send data through data channel', () => {
      const testData = { type: 'alert', message: 'emergency' };
      
      const result = connection.send(testData);
      
      expect(result).toBe(true);
      expect(mockDataChannel.send).toHaveBeenCalledWith(JSON.stringify(testData));
    });

    test('should handle send failures when channel is not open', () => {
      mockDataChannel.readyState = 'closed';
      
      const result = connection.send({ test: 'data' });
      
      expect(result).toBe(false);
      expect(mockDataChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    test('should close connection properly', () => {
      connection.close();
      
      expect(mockDataChannel.close).toHaveBeenCalled();
      expect(mockRTCPeerConnection.close).toHaveBeenCalled();
      expect(connection.isConnected).toBe(false);
      expect(connection.connectionState).toBe('closed');
    });

    test('should emit closed event on close', () => {
      const eventSpy = jest.fn();
      connection.on('closed', eventSpy);
      
      connection.close();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });

    test('should check if connection is ready', () => {
      // Initially not ready
      expect(connection.isReady()).toBe(false);
      
      // Simulate connected state
      connection.isConnected = true;
      connection.dataChannel = mockDataChannel;
      mockDataChannel.readyState = 'open';
      
      expect(connection.isReady()).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should get connection statistics', async () => {
      const mockStats = new Map([
        ['data-channel-1', {
          type: 'data-channel',
          bytesReceived: 1024,
          bytesSent: 2048,
          messagesReceived: 10,
          messagesSent: 15
        }],
        ['candidate-pair-1', {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05,
          availableOutgoingBitrate: 1000000,
          availableIncomingBitrate: 1000000
        }]
      ]);
      
      mockRTCPeerConnection.getStats.mockResolvedValue(mockStats);
      connection.isConnected = true;
      
      const stats = await connection.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.peerId).toBe(peerId);
      expect(stats.isConnected).toBe(true);
      expect(stats.stats.dataChannel).toBeDefined();
      expect(stats.stats.connection).toBeDefined();
    });

    test('should return null stats when no peer connection', async () => {
      connection.peerConnection = null;
      
      const stats = await connection.getStats();
      
      expect(stats).toBeNull();
    });
  });

  describe('Connection Info', () => {
    test('should return connection information', () => {
      connection.isConnected = true;
      connection.connectionState = 'connected';
      mockDataChannel.readyState = 'open';
      
      const info = connection.getConnectionInfo();
      
      expect(info).toEqual({
        peerId,
        isInitiator: true,
        isConnected: true,
        connectionState: 'connected',
        dataChannelState: 'open',
        isReady: true
      });
    });
  });
});