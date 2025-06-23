/**
 * WebRTCConnection - Handles WebRTC peer-to-peer connections for mesh networking
 */

import EventEmitter from 'events';

class WebRTCConnection extends EventEmitter {
  constructor(peerId, isInitiator = false, signalServerUrl = null) {
    super();
    
    this.peerId = peerId;
    this.isInitiator = isInitiator;
    this.signalServerUrl = signalServerUrl;
    
    this.peerConnection = null;
    this.dataChannel = null;
    this.isConnected = false;
    this.connectionState = 'new';
    
    // WebRTC configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
    
    this.setupPeerConnection();
  }

  /**
   * Set up WebRTC peer connection
   */
  setupPeerConnection() {
    try {
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.emit('iceCandidate', {
            peerId: this.peerId,
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        this.connectionState = this.peerConnection.connectionState;
        this.emit('connectionStateChange', {
          peerId: this.peerId,
          state: this.connectionState
        });
        
        if (this.connectionState === 'connected') {
          this.isConnected = true;
          this.emit('connected', { peerId: this.peerId });
        } else if (this.connectionState === 'disconnected' || 
                   this.connectionState === 'failed' || 
                   this.connectionState === 'closed') {
          this.isConnected = false;
          this.emit('disconnected', { peerId: this.peerId });
        }
      };
      
      // Handle data channel from remote peer
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        this.setupDataChannel(channel);
      };
      
      // Create data channel if we're the initiator
      if (this.isInitiator) {
        this.dataChannel = this.peerConnection.createDataChannel('alerts', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannel(this.dataChannel);
      }
      
    } catch (error) {
      console.error('Failed to setup peer connection:', error);
      this.emit('error', error);
    }
  }

  /**
   * Set up data channel event handlers
   */
  setupDataChannel(channel) {
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log(`Data channel opened with peer ${this.peerId}`);
      this.emit('dataChannelOpen', { peerId: this.peerId });
    };
    
    channel.onclose = () => {
      console.log(`Data channel closed with peer ${this.peerId}`);
      this.emit('dataChannelClose', { peerId: this.peerId });
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', {
          peerId: this.peerId,
          data: data
        });
      } catch (error) {
        console.error('Failed to parse received message:', error);
        this.emit('error', error);
      }
    };
    
    channel.onerror = (error) => {
      console.error(`Data channel error with peer ${this.peerId}:`, error);
      this.emit('error', error);
    };
  }

  /**
   * Create and send offer to remote peer
   */
  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.emit('offer', {
        peerId: this.peerId,
        offer: offer
      });
      
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create and send answer to remote peer
   */
  async createAnswer() {
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.emit('answer', {
        peerId: this.peerId,
        answer: answer
      });
      
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle received offer from remote peer
   */
  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      return await this.createAnswer();
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle received answer from remote peer
   */
  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      this.emit('error', error);
    }
  }

  /**
   * Send data through the data channel
   */
  send(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        const serializedData = JSON.stringify(data);
        this.dataChannel.send(serializedData);
        return true;
      } catch (error) {
        console.error('Failed to send data:', error);
        this.emit('error', error);
        return false;
      }
    } else {
      console.warn(`Cannot send data - channel not open. State: ${this.dataChannel?.readyState}`);
      return false;
    }
  }

  /**
   * Close the connection
   */
  close() {
    try {
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
      
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      this.isConnected = false;
      this.connectionState = 'closed';
      
      this.emit('closed', { peerId: this.peerId });
    } catch (error) {
      console.error('Error closing connection:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get connection statistics
   */
  async getStats() {
    if (!this.peerConnection) {
      return null;
    }
    
    try {
      const stats = await this.peerConnection.getStats();
      const result = {
        peerId: this.peerId,
        connectionState: this.connectionState,
        isConnected: this.isConnected,
        stats: {}
      };
      
      stats.forEach((report) => {
        if (report.type === 'data-channel') {
          result.stats.dataChannel = {
            bytesReceived: report.bytesReceived,
            bytesSent: report.bytesSent,
            messagesReceived: report.messagesReceived,
            messagesSent: report.messagesSent
          };
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.stats.connection = {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            availableIncomingBitrate: report.availableIncomingBitrate
          };
        }
      });
      
      return result;
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return null;
    }
  }

  /**
   * Check if connection is ready for data transfer
   */
  isReady() {
    return this.isConnected && 
           this.dataChannel && 
           this.dataChannel.readyState === 'open';
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      peerId: this.peerId,
      isInitiator: this.isInitiator,
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      dataChannelState: this.dataChannel?.readyState || 'none',
      isReady: this.isReady()
    };
  }
}

export default WebRTCConnection;