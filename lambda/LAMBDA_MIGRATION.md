# Lambda Migration Guide (Zip + Layer Approach)

This document explains the migration from the local Express server to an AWS Lambda function with **Response Streaming** enabled.

## Architecture Highlights

1. **Lambda Function URL**: We use a Function URL configured with `InvokeMode: RESPONSE_STREAM`. This is *required* to properly stream Server-Sent Events (SSE) from the `streamText` function to the client without buffering.
2. **Lambda Layer**: To keep the function code small and viewable in the AWS Console, all `node_modules` are packaged separately into a Lambda Layer.
3. **Zip Deployment**: We use a simple `package.sh` script to generate the deployable `.zip` files.

## Setup Steps

### 1. Build the Packages
Run the packaging script to generate your zip files:
```bash
./package.sh
```
This will create two files:
- `function.zip`: Contains only `lambda-handler.js`.
- `layer.zip`: Contains `node_modules` inside a `nodejs/` folder (the structure required by AWS).

### 2. Configure AWS Secrets Manager
Create the Anthropic API key secret in your AWS environment:
```bash
aws secretsmanager create-secret \
  --name anthropic-api-key \
  --secret-string "sk-ant-..." \
  --region us-east-1
```

### 3. Deploy the Layer
1. Go to the AWS Lambda Console > **Layers** > **Create layer**.
2. Name it (e.g., `keynes-kortex-dependencies`).
3. Upload `layer.zip`.
4. Select `Node.js 20.x` as the compatible runtime.
5. Click **Create**.

### 4. Deploy the Function
1. Go to the AWS Lambda Console > **Functions** > **Create function**.
2. Name it (e.g., `keynes-kortex-query-stream`).
3. Runtime: **Node.js 20.x**. Architecture: **arm64** (or x86_64, just be consistent).
4. Under **Advanced settings**, enable **Enable function URL**.
   - Auth type: `NONE`
   - **Invoke mode**: `RESPONSE_STREAM` (This is critical!)
   - Configure CORS (Allow Origin `*`, Allow Methods `*`).
5. Click **Create function**.

### 5. Configure the Function
1. **Upload Code**: In the Code source section, click "Upload from" > ".zip file" and upload `function.zip`.
2. **Add Layer**: Scroll down to the "Layers" section, click "Add a layer", select "Custom layers", and choose the layer you created in Step 3.
3. **Handler**: In "Runtime settings", ensure the Handler is set to `lambda-handler.handler`.
4. **Environment Variables**: Go to Configuration > Environment variables and add:
   - `HOSTED_MCP_URL`: `https://your-mcp.server.com`
   - `ANTHROPIC_API_KEY_SECRET_NAME`: `anthropic-api-key`
5. **Permissions**: Go to Configuration > Permissions > Execution role. Attach a policy that allows `secretsmanager:GetSecretValue` for your secret ARN.

### 6. Update the Frontend
Once deployed, grab the Function URL from the AWS Console (it looks like `https://<id>.lambda-url.<region>.on.aws/`).

Update your frontend client's environment variables:
```env
VITE_API_URL=https://<id>.lambda-url.<region>.on.aws
```

---

## Local Testing
Because Lambda Response Streaming relies on AWS Lambda's specific Node.js wrappers (`awslambda.streamifyResponse`), testing the exact streaming behavior locally via zip is not fully supported outside AWS.

For local development, continue using the Express server (`npm run server`) alongside your frontend. Only deploy the `.zip` files when pushing to staging/production.
