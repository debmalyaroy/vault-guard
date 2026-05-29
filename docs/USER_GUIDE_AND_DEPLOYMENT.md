# User Guide and Deployment

## Local Setup & Execution

### Prerequisites
- Go 1.22+
- Node.js v18+

### AWS Credentials (Optional)
By default, the application runs using a **Mock Bedrock** client so you do not incur charges. To use real AWS Bedrock:
1. Export your keys:
   ```bash
   export AWS_ACCESS_KEY_ID="your_key"
   export AWS_SECRET_ACCESS_KEY="your_secret"
   export AWS_REGION="us-east-1"
   ```
2. Modify `backend/cmd/server/main.go` to use `bedrock.NewAWSBedrockClient(ctx)` instead of `bedrock.NewMockClient()`.

### Starting the Backend
```bash
cd backend
go build -o vaultguard ./cmd/server
./vaultguard
```
The server will start on `http://localhost:8080`.

### Starting the Frontend
```bash
cd frontend
npm install
npm run dev
```
The UI will be accessible at `http://localhost:5173`.

---

## How to use the App
1. Open `http://localhost:5173`.
2. Notice the UI has 3 columns: **Attack Console**, **Agent Arena**, and **VaultGuard Shield**.
3. **Fire an Attack:** Select an attack from the Attack Console, select sophistication, and click "FIRE".
4. **Observe the Arena:** Agent A (unprotected) will execute without filtering and become compromised. Agent B (protected) runs through the pipeline and survives.
5. **Change Policy:** In the Shield panel, change the Active Policy from "Research Assistant" to "Financial Analyst" and fire attacks to see the deterministic Stage 4 Enforcer in action.