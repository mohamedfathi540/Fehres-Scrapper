import subprocess
import json
import time
import uuid

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

print("Waiting for backend to be ready...")
for _ in range(30):
    health = run_cmd("curl -s http://localhost:8000/api/v1/base/health")
    if "healthy" in health.lower() or "ok" in health.lower() or "status" in health.lower():
        break
    time.sleep(2)
else:
    print("Backend did not start in time. Exiting.")
    exit(1)

email = f"test_{uuid.uuid4().hex[:8]}@example.com"
password = "TestPassword123!"

print("\n--- 1. Register ---")
reg = run_cmd(f"curl -s -X POST http://localhost:8000/api/v1/auth/register -H 'Content-Type: application/json' -d '{{\"email\": \"{email}\", \"password\": \"{password}\"}}'")
print(reg)

print("\n--- 2. Login ---")
login = run_cmd(f"curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{{\"email\": \"{email}\", \"password\": \"{password}\"}}'")
print(login[:100] + "...") 
try:
    token = json.loads(login).get('access_token')
except:
    token = None

if token:
    print("\n--- 3. Quota Status (Initial) ---")
    quota = run_cmd(f"curl -s -H 'Authorization: Bearer {token}' http://localhost:8000/api/v1/auth/quota-status")
    print(quota)
else:
    print("Failed to get token")
