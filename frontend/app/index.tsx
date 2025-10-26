import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function App() {
  const [configured, setConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(true); // Start with true, will be updated by checkConfiguration
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [connecting, setConnecting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  
  // SSH Config
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('22');
  
  // Component states
  const [fanOn, setFanOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);

  useEffect(() => {
    checkConfiguration();
    const interval = setInterval(() => {
      checkStatus();
    }, 5000); // Check status every 5 seconds
    
    return () => clearInterval(interval);
  }, [configured]);

  const checkConfiguration = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config`);
      const data = await response.json();
      
      if (data.configured) {
        setConfigured(true);
        setShowConfig(false); // Hide config screen when already configured
        setHost(data.host);
        setUsername(data.username);
        setPort(data.port?.toString() || '22');
        checkStatus();
      } else {
        setShowConfig(true);
      }
    } catch (error) {
      console.error('Error checking config:', error);
      setShowConfig(true); // Show config on error
    } finally {
      setLoading(false); // Done loading
    }
  };

  const checkStatus = async () => {
    if (!configured) return;
    
    try {
      setStatusLoading(true);
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();
      setConnected(data.connected);
    } catch (error) {
      console.error('Error checking status:', error);
      setConnected(false);
    } finally {
      setStatusLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!host || !username || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          username,
          password,
          port: parseInt(port),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConfigured(true);
        setShowConfig(false);
        Alert.alert('Success', 'Configuration saved! Now click Connect to establish connection.');
      } else {
        Alert.alert('Error', data.detail || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch(`${API_URL}/api/connect`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setConnected(true);
        Alert.alert('Success', 'Connected to Jetson device!');
      } else {
        setConnected(false);
        Alert.alert('Connection Failed', data.detail || 'Could not connect to device');
      }
    } catch (error) {
      console.error('Connect error:', error);
      setConnected(false);
      Alert.alert('Error', 'Failed to connect to device');
    } finally {
      setConnecting(false);
    }
  };

  const executeControl = async (endpoint: string, action: string, stateSetter: Function) => {
    if (!connected) {
      Alert.alert('Error', 'Device not connected');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      
      if (response.ok) {
        stateSetter(action === 'on');
        Alert.alert('Success', `${endpoint} turned ${action}`);
      } else {
        Alert.alert('Error', data.detail || 'Command failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute command');
    } finally {
      setLoading(false);
    }
  };

  const handleShutdown = () => {
    Alert.alert(
      'Confirm Shutdown',
      'Are you sure you want to shutdown the device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shutdown',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await fetch(`${API_URL}/api/shutdown`, {
                method: 'POST',
              });
              
              if (response.ok) {
                Alert.alert('Success', 'Shutdown command sent');
                setConnected(false);
              } else {
                Alert.alert('Error', 'Failed to shutdown');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to send shutdown command');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Configuration Screen
  if (showConfig || !configured) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.configContainer}>
          <View style={styles.header}>
            <Ionicons name="skull" size={80} color="#FF6B00" />
            <Text style={styles.title}>Pumpkin Control</Text>
            <Text style={styles.subtitle}>SSH Configuration</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Jetson IP Address</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="192.168.1.100"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="jetson"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#666"
              secureTextEntry
            />

            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="22"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveConfiguration}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>Save Configuration</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.dashboardContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="skull" size={60} color="#FF6B00" />
          <Text style={styles.title}>Pumpkin Control</Text>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>
              {connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowConfig(true)}>
            <Ionicons name="settings-outline" size={28} color="#FF6B00" />
          </TouchableOpacity>
        </View>

        {/* Connect Button (if not connected) */}
        {configured && !connected && (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="link" size={24} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.connectButtonText}>Connect to Device</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {/* Fan Control */}
          <TouchableOpacity
            style={[styles.controlButton, fanOn && styles.controlButtonActive]}
            onPress={() => executeControl('fan', fanOn ? 'off' : 'on', setFanOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="battery-charging" size={60} color={fanOn ? '#4CAF50' : '#999'} />
            <Text style={styles.controlButtonText}>Fan</Text>
            <Text style={styles.controlButtonStatus}>{fanOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          {/* Camera Control */}
          <TouchableOpacity
            style={[styles.controlButton, cameraOn && styles.controlButtonActive]}
            onPress={() => executeControl('camera', cameraOn ? 'off' : 'on', setCameraOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="camera" size={60} color={cameraOn ? '#4CAF50' : '#999'} />
            <Text style={styles.controlButtonText}>Camera</Text>
            <Text style={styles.controlButtonStatus}>{cameraOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          {/* Lights Control */}
          <TouchableOpacity
            style={[styles.controlButton, lightsOn && styles.controlButtonActive]}
            onPress={() => executeControl('lights', lightsOn ? 'off' : 'on', setLightsOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="bulb" size={60} color={lightsOn ? '#FFD700' : '#999'} />
            <Text style={styles.controlButtonText}>Lights</Text>
            <Text style={styles.controlButtonStatus}>{lightsOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          {/* Shutdown Button */}
          <TouchableOpacity
            style={[styles.controlButton, styles.shutdownButton]}
            onPress={handleShutdown}
            disabled={loading || !connected}
          >
            <Ionicons name="power" size={60} color="#F44336" />
            <Text style={styles.controlButtonText}>Shutdown</Text>
            <Text style={styles.controlButtonStatus}>Power Off</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FF6B00" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  configContainer: {
    padding: 24,
  },
  dashboardContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#999',
    marginTop: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlsContainer: {
    gap: 16,
  },
  controlButton: {
    backgroundColor: '#2a2a2a',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
    minHeight: 160,
    justifyContent: 'center',
  },
  controlButtonActive: {
    borderColor: '#FF6B00',
    backgroundColor: '#2a2a2a',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  controlButtonStatus: {
    color: '#999',
    fontSize: 16,
    marginTop: 4,
  },
  shutdownButton: {
    borderColor: '#F44336',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});