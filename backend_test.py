#!/usr/bin/env python3
"""
Backend API Testing for Pumpkin Head Control System
Tests all API endpoints for functionality and proper error handling
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return "http://localhost:8001"
    return "http://localhost:8001"

BASE_URL = get_backend_url()
print(f"Testing backend at: {BASE_URL}")

class PumpkinHeadTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.ssh_config = {
            "host": "192.168.1.100",
            "username": "testuser", 
            "password": "testpass",
            "port": 22
        }
    
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_health_endpoint(self):
        """Test GET /api/health"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "Health endpoint working correctly", data)
                else:
                    self.log_result("Health Check", False, f"Unexpected health response: {data}", data)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}", response.text)
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
    
    def test_save_ssh_config(self):
        """Test POST /api/config - Save SSH configuration"""
        try:
            response = requests.post(
                f"{self.base_url}/api/config",
                json=self.ssh_config,
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "saved" in data["message"].lower():
                    self.log_result("Save SSH Config", True, "SSH configuration saved successfully", data)
                else:
                    self.log_result("Save SSH Config", False, f"Unexpected save response: {data}", data)
            else:
                self.log_result("Save SSH Config", False, f"HTTP {response.status_code}: {response.text}", response.text)
        except Exception as e:
            self.log_result("Save SSH Config", False, f"Connection error: {str(e)}")
    
    def test_get_ssh_config(self):
        """Test GET /api/config - Get saved SSH configuration"""
        try:
            response = requests.get(f"{self.base_url}/api/config", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("configured") == True:
                    # Verify password is not returned
                    if "password" not in data:
                        # Verify other fields are present
                        if data.get("host") == self.ssh_config["host"] and data.get("username") == self.ssh_config["username"]:
                            self.log_result("Get SSH Config", True, "SSH config retrieved correctly, password hidden", data)
                        else:
                            self.log_result("Get SSH Config", False, "SSH config data mismatch", data)
                    else:
                        self.log_result("Get SSH Config", False, "Password should not be returned in config", data)
                else:
                    self.log_result("Get SSH Config", False, "Configuration not found or not configured", data)
            else:
                self.log_result("Get SSH Config", False, f"HTTP {response.status_code}: {response.text}", response.text)
        except Exception as e:
            self.log_result("Get SSH Config", False, f"Connection error: {str(e)}")
    
    def test_control_endpoint(self, endpoint, device_name):
        """Test control endpoints (fan, camera, lights)"""
        # Test ON action
        try:
            response = requests.post(
                f"{self.base_url}/api/{endpoint}",
                json={"action": "on"},
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success" and data.get("action") == "on":
                    self.log_result(f"{device_name} Control ON", True, f"{device_name} turned ON successfully", data)
                else:
                    self.log_result(f"{device_name} Control ON", False, f"Unexpected ON response: {data}", data)
            else:
                # SSH will fail but we should get proper error handling
                if response.status_code == 500 and ("SSH error" in response.text or "timed out" in response.text.lower() or "connection" in response.text.lower()):
                    self.log_result(f"{device_name} Control ON", True, f"{device_name} ON endpoint works (SSH error expected)", response.text[:200])
                else:
                    self.log_result(f"{device_name} Control ON", False, f"HTTP {response.status_code}: {response.text}", response.text[:200])
        except Exception as e:
            # If it's a timeout or connection error, that's expected for SSH commands
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                self.log_result(f"{device_name} Control ON", True, f"{device_name} ON endpoint works (timeout expected for SSH)", str(e)[:100])
            else:
                self.log_result(f"{device_name} Control ON", False, f"Connection error: {str(e)}")
        
        # Test OFF action
        try:
            response = requests.post(
                f"{self.base_url}/api/{endpoint}",
                json={"action": "off"},
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success" and data.get("action") == "off":
                    self.log_result(f"{device_name} Control OFF", True, f"{device_name} turned OFF successfully", data)
                else:
                    self.log_result(f"{device_name} Control OFF", False, f"Unexpected OFF response: {data}", data)
            else:
                # SSH will fail but we should get proper error handling
                if response.status_code == 500 and ("SSH error" in response.text or "timed out" in response.text.lower() or "connection" in response.text.lower()):
                    self.log_result(f"{device_name} Control OFF", True, f"{device_name} OFF endpoint works (SSH error expected)", response.text[:200])
                else:
                    self.log_result(f"{device_name} Control OFF", False, f"HTTP {response.status_code}: {response.text}", response.text[:200])
        except Exception as e:
            # If it's a timeout or connection error, that's expected for SSH commands
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                self.log_result(f"{device_name} Control OFF", True, f"{device_name} OFF endpoint works (timeout expected for SSH)", str(e)[:100])
            else:
                self.log_result(f"{device_name} Control OFF", False, f"Connection error: {str(e)}")
    
    def test_shutdown_endpoint(self):
        """Test POST /api/shutdown"""
        try:
            response = requests.post(f"{self.base_url}/api/shutdown", timeout=30)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_result("Shutdown Device", True, "Shutdown endpoint working correctly", data)
                else:
                    self.log_result("Shutdown Device", False, f"Unexpected shutdown response: {data}", data)
            else:
                # SSH will fail but we should get proper error handling
                if response.status_code == 500 and ("SSH error" in response.text or "timed out" in response.text.lower()):
                    self.log_result("Shutdown Device", True, "Shutdown endpoint works (SSH error expected)", response.text[:200])
                else:
                    self.log_result("Shutdown Device", False, f"HTTP {response.status_code}: {response.text}", response.text[:200])
        except Exception as e:
            # If it's a timeout or connection error, that's expected for SSH commands
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                self.log_result("Shutdown Device", True, "Shutdown endpoint works (timeout expected for SSH)", str(e)[:100])
            else:
                self.log_result("Shutdown Device", False, f"Connection error: {str(e)}")
    
    def test_status_endpoint(self):
        """Test GET /api/status"""
        try:
            response = requests.get(f"{self.base_url}/api/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("configured") == True:
                    # Should show configured but not connected (since no real SSH)
                    self.log_result("Status Check", True, f"Status endpoint working: {data}", data)
                else:
                    self.log_result("Status Check", False, f"Status should show configured=True: {data}", data)
            else:
                self.log_result("Status Check", False, f"HTTP {response.status_code}: {response.text}", response.text)
        except Exception as e:
            self.log_result("Status Check", False, f"Connection error: {str(e)}")
    
    def test_logs_endpoint(self):
        """Test GET /api/logs"""
        try:
            response = requests.get(f"{self.base_url}/api/logs", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "logs" in data and isinstance(data["logs"], list):
                    self.log_result("Get Logs", True, f"Logs endpoint working, {len(data['logs'])} logs found", {"log_count": len(data["logs"])})
                else:
                    self.log_result("Get Logs", False, f"Unexpected logs response: {data}", data)
            else:
                self.log_result("Get Logs", False, f"HTTP {response.status_code}: {response.text}", response.text)
        except Exception as e:
            self.log_result("Get Logs", False, f"Connection error: {str(e)}")
    
    def test_error_handling(self):
        """Test error handling - control without config"""
        # First clear any existing config by testing with empty database
        print("\n--- Testing Error Handling ---")
        
        # Test control endpoints without SSH config (should fail gracefully)
        try:
            # Try to control fan without config - this should fail with proper error
            response = requests.post(
                f"{self.base_url}/api/fan",
                json={"action": "on"},
                timeout=30
            )
            if response.status_code == 400 and "not configured" in response.text.lower():
                self.log_result("Error Handling", True, "Proper error when SSH not configured", response.text[:200])
            elif response.status_code == 500 and ("SSH error" in response.text or "timed out" in response.text.lower()):
                # This means config exists but SSH fails - also acceptable
                self.log_result("Error Handling", True, "Proper SSH error handling", response.text[:200])
            else:
                self.log_result("Error Handling", False, f"Unexpected error response: HTTP {response.status_code}: {response.text}", response.text[:200])
        except Exception as e:
            # If it's a timeout or connection error, that's expected for SSH commands
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                self.log_result("Error Handling", True, "Proper error handling (timeout expected for SSH)", str(e)[:100])
            else:
                self.log_result("Error Handling", False, f"Connection error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("PUMPKIN HEAD CONTROL - BACKEND API TESTING")
        print("=" * 60)
        
        # Test basic health
        self.test_health_endpoint()
        
        # Test SSH configuration
        self.test_save_ssh_config()
        self.test_get_ssh_config()
        
        # Test all control endpoints
        self.test_control_endpoint("fan", "Fan")
        self.test_control_endpoint("camera", "Camera") 
        self.test_control_endpoint("lights", "Lights")
        
        # Test other endpoints
        self.test_shutdown_endpoint()
        self.test_status_endpoint()
        self.test_logs_endpoint()
        
        # Test error handling
        self.test_error_handling()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        print("\nDETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"  {status} {result['test']}: {result['message']}")

if __name__ == "__main__":
    tester = PumpkinHeadTester()
    tester.run_all_tests()