from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import paramiko
from datetime import datetime
import logging

load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client.pumpkin_control
config_collection = db.ssh_config
logs_collection = db.command_logs

# Connection state storage (in-memory for now)
connection_state = {"connected": False, "configured": False}

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models
class SSHConfig(BaseModel):
    host: str
    username: str
    password: str
    port: int = 22

class CommandRequest(BaseModel):
    command: str

class ControlRequest(BaseModel):
    action: str  # 'on' or 'off'

# SSH Execution Helper
async def execute_ssh_command(config: dict, command: str):
    """Execute SSH command on remote device"""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        ssh.connect(
            hostname=config['host'],
            port=config.get('port', 22),
            username=config['username'],
            password=config['password'],
            timeout=10
        )
        
        stdin, stdout, stderr = ssh.exec_command(command)
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        exit_status = stdout.channel.recv_exit_status()
        
        ssh.close()
        
        # Log the command
        await logs_collection.insert_one({
            "command": command,
            "output": output,
            "error": error,
            "exit_status": exit_status,
            "timestamp": datetime.utcnow()
        })
        
        return {
            "success": exit_status == 0,
            "output": output,
            "error": error
        }
    except Exception as e:
        logger.error(f"SSH execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SSH error: {str(e)}")

# Routes
@app.get("/api/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/config")
async def save_config(config: SSHConfig):
    """Save SSH configuration"""
    try:
        # Delete existing config
        await config_collection.delete_many({})
        
        # Insert new config
        config_dict = config.dict()
        await config_collection.insert_one(config_dict)
        
        # Update state
        connection_state["configured"] = True
        connection_state["connected"] = False
        
        return {"message": "Configuration saved successfully", "configured": True}
    except Exception as e:
        logger.error(f"Error saving config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/connect")
async def connect_to_device():
    """Test connection to the device"""
    try:
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        # Try to connect
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        ssh.connect(
            hostname=config['host'],
            port=config.get('port', 22),
            username=config['username'],
            password=config['password'],
            timeout=10
        )
        
        # Test with simple command
        stdin, stdout, stderr = ssh.exec_command('echo "Connected"')
        output = stdout.read().decode('utf-8')
        ssh.close()
        
        # Update state
        connection_state["connected"] = True
        connection_state["configured"] = True
        
        return {
            "success": True,
            "message": "Connected successfully",
            "output": output.strip()
        }
    except paramiko.AuthenticationException:
        connection_state["connected"] = False
        raise HTTPException(status_code=401, detail="Authentication failed. Check username/password.")
    except paramiko.SSHException as e:
        connection_state["connected"] = False
        raise HTTPException(status_code=500, detail=f"SSH error: {str(e)}")
    except Exception as e:
        connection_state["connected"] = False
        logger.error(f"Connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@app.get("/api/config")
async def get_config():
    """Get saved SSH configuration"""
    try:
        config = await config_collection.find_one({}, {"_id": 0})
        if not config:
            return {"configured": False}
        
        # Don't send password back
        return {
            "configured": True,
            "host": config.get('host'),
            "username": config.get('username'),
            "port": config.get('port', 22)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute")
async def execute_command(request: CommandRequest):
    """Execute custom SSH command"""
    try:
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        result = await execute_ssh_command(config, request.command)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fan")
async def control_fan(request: ControlRequest):
    """Control the fan"""
    try:
        if not connection_state.get("connected", False):
            raise HTTPException(status_code=400, detail="Not connected. Please connect first.")
        
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        # Assuming GPIO control or similar command
        if request.action == "on":
            command = "echo 1 > /sys/class/gpio/gpio_fan/value"  # Example command
        else:
            command = "echo 0 > /sys/class/gpio/gpio_fan/value"
        
        result = await execute_ssh_command(config, command)
        return {"status": "success", "action": request.action, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/camera")
async def control_camera(request: ControlRequest):
    """Control the camera - runs Python script"""
    try:
        if not connection_state.get("connected", False):
            raise HTTPException(status_code=400, detail="Not connected. Please connect first.")
        
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        if request.action == "on":
            # Run camera script in background
            command = "nohup python3 /home/camera_script.py > /dev/null 2>&1 &"
        else:
            # Kill camera process
            command = "pkill -f camera_script.py"
        
        result = await execute_ssh_command(config, command)
        return {"status": "success", "action": request.action, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/lights")
async def control_lights(request: ControlRequest):
    """Control the lights"""
    try:
        if not connection_state.get("connected", False):
            raise HTTPException(status_code=400, detail="Not connected. Please connect first.")
        
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        if request.action == "on":
            command = "echo 1 > /sys/class/gpio/gpio_lights/value"  # Example command
        else:
            command = "echo 0 > /sys/class/gpio/gpio_lights/value"
        
        result = await execute_ssh_command(config, command)
        return {"status": "success", "action": request.action, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/shutdown")
async def shutdown_device():
    """Shutdown the Jetson device"""
    try:
        if not connection_state.get("connected", False):
            raise HTTPException(status_code=400, detail="Not connected. Please connect first.")
        
        config = await config_collection.find_one({})
        if not config:
            raise HTTPException(status_code=400, detail="SSH not configured")
        
        command = "sudo shutdown -h now"
        result = await execute_ssh_command(config, command)
        
        # Mark as disconnected after shutdown
        connection_state["connected"] = False
        
        return {"status": "success", "message": "Shutdown command sent", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status")
async def get_status():
    """Get current status of all components"""
    try:
        config = await config_collection.find_one({})
        if not config:
            return {"connected": False, "configured": False}
        
        return {
            "connected": connection_state.get("connected", False),
            "configured": True,
            "host": config.get('host')
        }
    except Exception as e:
        return {"connected": False, "configured": False, "error": str(e)}

@app.get("/api/logs")
async def get_logs(limit: int = 20):
    """Get command execution logs"""
    try:
        logs = await logs_collection.find().sort("timestamp", -1).limit(limit).to_list(length=limit)
        for log in logs:
            log['_id'] = str(log['_id'])
            if 'timestamp' in log:
                log['timestamp'] = log['timestamp'].isoformat()
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)