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

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function App() {
  const [configured, setConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [showCommands, setShowCommands] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // SSH Config
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('22');
  
  // Component states
  const [fanOn, setFanOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [lightsOn, setLightsOn] = useState(false);
  
  // Custom commands
  const [commands, setCommands] = useState({
    fan_on: 'echo 1 > /sys/class/gpio/gpio_fan/value',
    fan_off: 'echo 0 > /sys/class/gpio/gpio_fan/value',
    camera_on: 'nohup python3 /home/camera_script.py > /dev/null 2>&1 &',
    camera_off: 'pkill -f camera_script.py',
    lights_on: 'echo 1 > /sys/class/gpio/gpio_lights/value',
    lights_off: 'echo 0 > /sys/class/gpio/gpio_lights/value',
    shutdown_cmd: 'sudo shutdown -h now',
  });
  
  // Terminal logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  useEffect(() => {
    checkConfiguration();
    loadCommands();
    const interval = setInterval(() => {
      if (configured) {
        checkStatus();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [configured]);

  const addLog = (log: string) => {
    setTerminalLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  const checkConfiguration = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config`);
      const data = await response.json();
      
      if (data.configured) {
        setConfigured(true);
        setShowConfig(false);
        setHost(data.host);
        setUsername(data.username);
        setPort(data.port?.toString() || '22');
        checkStatus();
      } else {
        setShowConfig(true);
      }
    } catch (error) {
      console.error('Error checking config:', error);
      setShowConfig(true);
    } finally {
      setLoading(false);
    }
  };

  const loadCommands = async () => {
    try {
      const response = await fetch(`${API_URL}/api/commands`);
      const data = await response.json();
      setCommands(data);
    } catch (error) {
      console.error('Error loading commands:', error);
    }
  };

  const saveCommands = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
      });

      if (response.ok) {
        Alert.alert('Success', 'Commands saved!');
        setShowCommands(false);
      } else {
        Alert.alert('Error', 'Failed to save commands');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save commands');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();
      setConnected(data.connected);
    } catch (error) {
      console.error('Error checking status:', error);
      setConnected(false);
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
        addLog('✅ Configuration saved');
        Alert.alert('Success', 'Configuration saved! Now click Connect.');
      } else {
        Alert.alert('Error', data.detail || 'Failed to save configuration');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    addLog('🔄 Connecting to device...');
    try {
      const response = await fetch(`${API_URL}/api/connect`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setConnected(true);
        addLog('✅ Connected to device');
        Alert.alert('Success', 'Connected to Jetson device!');
      } else {
        setConnected(false);
        addLog('❌ Connection failed: ' + data.detail);
        Alert.alert('Connection Failed', data.detail || 'Could not connect');
      }
    } catch (error) {
      setConnected(false);
      addLog('❌ Connection error');
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
    addLog(`🔄 ${endpoint} ${action}...`);
    try {
      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      
      if (response.ok) {
        stateSetter(action === 'on');
        addLog(`✅ ${endpoint} ${action}: ${data.command}`);
        Alert.alert('Success', `${endpoint} turned ${action}`);
      } else {
        addLog(`❌ ${endpoint} failed: ${data.detail}`);
        Alert.alert('Error', data.detail || 'Command failed');
      }
    } catch (error) {
      addLog(`❌ ${endpoint} error`);
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
            addLog('🔄 Sending shutdown command...');
            try {
              const response = await fetch(`${API_URL}/api/shutdown`, {
                method: 'POST',
              });
              
              if (response.ok) {
                const data = await response.json();
                addLog(`✅ Shutdown: ${data.command}`);
                Alert.alert('Success', 'Shutdown command sent');
                setConnected(false);
              } else {
                addLog('❌ Shutdown failed');
                Alert.alert('Error', 'Failed to shutdown');
              }
            } catch (error) {
              addLog('❌ Shutdown error');
              Alert.alert('Error', 'Failed to send shutdown command');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Commands Configuration Screen
  if (showCommands) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.configContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowCommands(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color="#FF6B00" />
            </TouchableOpacity>
            <Text style={styles.title}>Custom Commands</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Fan ON Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.fan_on}
              onChangeText={(val) => setCommands({...commands, fan_on: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Fan OFF Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.fan_off}
              onChangeText={(val) => setCommands({...commands, fan_off: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Camera ON Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.camera_on}
              onChangeText={(val) => setCommands({...commands, camera_on: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Camera OFF Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.camera_off}
              onChangeText={(val) => setCommands({...commands, camera_off: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Lights ON Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.lights_on}
              onChangeText={(val) => setCommands({...commands, lights_on: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Lights OFF Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.lights_off}
              onChangeText={(val) => setCommands({...commands, lights_off: val})}
              placeholderTextColor="#666"
              multiline
            />

            <Text style={styles.label}>Shutdown Command</Text>
            <TextInput
              style={styles.commandInput}
              value={commands.shutdown_cmd}
              onChangeText={(val) => setCommands({...commands, shutdown_cmd: val})}
              placeholderTextColor="#666"
              multiline
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={saveCommands} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Commands</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Configuration Screen
  if (showConfig || !configured) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.configContainer}>
          <View style={styles.header}>
            {configured && (
              <TouchableOpacity onPress={() => setShowConfig(false)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color="#FF6B00" />
              </TouchableOpacity>
            )}
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
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#FF6B00" />
              </TouchableOpacity>
            </View>

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

          <TouchableOpacity style={styles.saveButton} onPress={saveConfiguration} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Configuration</Text>}
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
        <View style={styles.header}>
          <Ionicons name="skull" size={60} color="#FF6B00" />
          <Text style={styles.title}>Pumpkin Control</Text>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>{connected ? 'Connected' : 'Disconnected'}</Text>
          </View>
          <View style={styles.statusButtons}>
            <TouchableOpacity onPress={() => setShowCommands(true)} style={styles.iconButton}>
              <Ionicons name="terminal-outline" size={24} color="#FF6B00" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowConfig(true)} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={24} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>

        {configured && !connected && (
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={connecting}>
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

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, fanOn && styles.controlButtonActive]}
            onPress={() => executeControl('fan', fanOn ? 'off' : 'on', setFanOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="battery-charging" size={60} color={fanOn ? '#4CAF50' : '#999'} />
            <Text style={styles.controlButtonText}>Fan</Text>
            <Text style={styles.controlButtonStatus}>{fanOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, cameraOn && styles.controlButtonActive]}
            onPress={() => executeControl('camera', cameraOn ? 'off' : 'on', setCameraOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="camera" size={60} color={cameraOn ? '#4CAF50' : '#999'} />
            <Text style={styles.controlButtonText}>Camera</Text>
            <Text style={styles.controlButtonStatus}>{cameraOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, lightsOn && styles.controlButtonActive]}
            onPress={() => executeControl('lights', lightsOn ? 'off' : 'on', setLightsOn)}
            disabled={loading || !connected}
          >
            <Ionicons name="bulb" size={60} color={lightsOn ? '#FFD700' : '#999'} />
            <Text style={styles.controlButtonText}>Lights</Text>
            <Text style={styles.controlButtonStatus}>{lightsOn ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

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

        {terminalLogs.length > 0 && (
          <View style={styles.terminalContainer}>
            <View style={styles.terminalHeader}>
              <Ionicons name="terminal" size={16} color="#4CAF50" />
              <Text style={styles.terminalTitle}>Terminal</Text>
            </View>
            <View style={styles.terminalContent}>
              {terminalLogs.map((log, idx) => (
                <Text key={idx} style={styles.terminalLog}>{log}</Text>
              ))}
            </View>
          </View>
        )}

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
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
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
  statusButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
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
  commandInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
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
  terminalContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4CAF50',
    gap: 8,
  },
  terminalTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  terminalContent: {
    padding: 12,
  },
  terminalLog: {
    color: '#4CAF50',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
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
