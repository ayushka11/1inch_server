import dotenv from "dotenv";
import { createPublicClient, createWalletClient, Hex, http } from "viem";
import { mainnet } from "viem/chains"; // Changed from base
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const requiredEnvVars = ["WALLET_ADDRESS", "PRIVATE_KEY", "API_KEY", "RPC_URL"];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config = {
  walletAddress: process.env.WALLET_ADDRESS!.toLowerCase(),
  privateKey: process.env.PRIVATE_KEY! as Hex,
  apiKey: process.env.API_KEY!,
  rpcUrl: process.env.RPC_URL!,
  tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on mainnet
  amountToSwap: "200000000000000", // 0.0002 WETH
  dstToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on mainnet
  slippage: 3,
};

type AllowanceResponse = { allowance: string };
type TransactionPayload = { to: Hex; data: Hex; value: bigint };
type TxResponse = { tx: TransactionPayload };
type ApproveTransactionResponse = {
  to: Hex;
  data: Hex;
  value: bigint;
  gasPrice: string;
};

const baseUrl = `https://api.1inch.dev/swap/v6.1/${mainnet.id}`; // Changed to mainnet

const publicClient = createPublicClient({
  chain: mainnet, // Changed from base
  transport: http(config.rpcUrl),
});

const account = privateKeyToAccount(config.privateKey);
const walletClient = createWalletClient({
  account,
  chain: mainnet, // Changed from base
  transport: http(config.rpcUrl),
});

function buildQueryURL(path: string, params: Record<string, string>): string {
  const url = new URL(baseUrl + path);
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}

async function call1inchAPI<T>(
  endpointPath: string,
  queryParams: Record<string, string>,
): Promise<T> {
  const url = buildQueryURL(endpointPath, queryParams);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`1inch API returned status ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function signAndSendTransaction(tx: TransactionPayload): Promise<string> {
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: "pending",
  });

  console.log("Nonce:", nonce.toString());

  try {
    return await walletClient.sendTransaction({
      account,
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value),
      chain: mainnet, // Changed from base
      nonce,
      kzg: undefined,
    });
  } catch (err) {
    console.error("Transaction signing or broadcasting failed");
    console.error("Transaction data:", tx);
    console.error("Nonce:", nonce.toString());
    throw err;
  }
}

async function checkAllowance(): Promise<bigint> {
  console.log("Checking token allowance...");

  const allowanceRes = await call1inchAPI<AllowanceResponse>(
    "/approve/allowance",
    {
      tokenAddress: config.tokenAddress,
      walletAddress: config.walletAddress,
    },
  );

  const allowance = BigInt(allowanceRes.allowance);
  console.log("Allowance:", allowance.toString());

  return allowance;
}

async function approveIfNeeded(requiredAmount: bigint): Promise<void> {
  const allowance = await checkAllowance();

  if (allowance >= requiredAmount) {
    console.log("Allowance is sufficient for the swap.");
    return;
  }

  console.log("Insufficient allowance. Creating approval transaction...");

  const approveTx = await call1inchAPI<ApproveTransactionResponse>(
    "/approve/transaction",
    {
      tokenAddress: config.tokenAddress,
      amount: requiredAmount.toString(),
    },
  );

  console.log("Approval transaction details:", approveTx);

  const txHash = await signAndSendTransaction({
    to: approveTx.to,
    data: approveTx.data,
    value: approveTx.value,
  });

  console.log("Approval transaction sent. Hash:", txHash);
  console.log("Waiting 10 seconds for confirmation...");
  await new Promise((res) => setTimeout(res, 10000));
}

async function performSwap(): Promise<void> {
  const swapParams = {
    src: config.tokenAddress,
    dst: config.dstToken,
    amount: config.amountToSwap.toString(),
    from: config.walletAddress,
    slippage: config.slippage.toString(),
    disableEstimate: "false",
    allowPartialFill: "false",
  };

  console.log("Fetching swap transaction...");
  console.log("Swapping 0.0002 WETH to USDC on Ethereum mainnet...");
  
  const swapTx = await call1inchAPI<TxResponse>("/swap", swapParams);

  console.log("Swap transaction:", swapTx.tx);

  const txHash = await signAndSendTransaction(swapTx.tx);
  console.log("Swap transaction sent. Hash:", txHash);
}

async function main() {
  try {
    console.log("Starting minimal WETH to USDC swap...");
    console.log(`Wallet: ${config.walletAddress}`);
    console.log(`Amount: 0.0002 WETH`);
    
    await approveIfNeeded(BigInt(config.amountToSwap));
    await performSwap();
  } catch (err) {
    console.error("Error:", (err as Error).message);
  }
}

main().catch((err) => {
  console.error("Unhandled error in main:", err);
  process.exit(1);
});