import dotenv from "dotenv";
import { createPublicClient, createWalletClient, Hex, http } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const config = {
  apiKey: process.env.API_KEY!,
  rpcUrl: process.env.RPC_URL!,
  chainId: 1, // Ethereum mainnet
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

type SwapParams = {
  srcToken: string;
  dstToken: string;
  amount: string;
  slippage: number;
  privateKey: string;
  walletAddress: string;
};

const baseUrl = `https://api.1inch.dev/swap/v6.1/${config.chainId}`;

function createClients(privateKey: string) {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(config.rpcUrl),
  });

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(config.rpcUrl),
  });

  return { publicClient, walletClient, account };
}

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

async function signAndSendTransaction(
  tx: TransactionPayload,
  publicClient: any,
  walletClient: any,
  account: any
): Promise<string> {
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
      chain: mainnet,
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

async function checkAllowance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  console.log("Checking token allowance...");

  const allowanceRes = await call1inchAPI<AllowanceResponse>(
    "/approve/allowance",
    {
      tokenAddress: tokenAddress,
      walletAddress: walletAddress.toLowerCase(),
    },
  );

  const allowance = BigInt(allowanceRes.allowance);
  console.log("Allowance:", allowance.toString());

  return allowance;
}

async function approveIfNeeded(
  tokenAddress: string, 
  requiredAmount: bigint,
  publicClient: any,
  walletClient: any,
  account: any
): Promise<void> {
  const allowance = await checkAllowance(tokenAddress, account.address);

  if (allowance >= requiredAmount) {
    console.log("Allowance is sufficient for the swap.");
    return;
  }

  console.log("Insufficient allowance. Creating approval transaction...");

  const approveTx = await call1inchAPI<ApproveTransactionResponse>(
    "/approve/transaction",
    {
      tokenAddress: tokenAddress,
      amount: requiredAmount.toString(),
    },
  );

  console.log("Approval transaction details:", approveTx);

  const txHash = await signAndSendTransaction({
    to: approveTx.to,
    data: approveTx.data,
    value: approveTx.value,
  }, publicClient, walletClient, account);

  console.log("Approval transaction sent. Hash:", txHash);
  console.log("Waiting 10 seconds for confirmation...");
  await new Promise((res) => setTimeout(res, 10000));
}

// Main swap function that can be called from API
export async function performTokenSwap({
  srcToken,
  dstToken,
  amount,
  slippage,
  privateKey,
  walletAddress
}: SwapParams) {
  try {
    // Validate inputs
    if (!srcToken || !dstToken || !amount || !privateKey || !walletAddress) {
      throw new Error("Missing required parameters");
    }

    if (slippage < 0 || slippage > 50) {
      throw new Error("Slippage must be between 0 and 50");
    }

    // Validate API key
    if (!config.apiKey) {
      throw new Error("Missing 1INCH_API_KEY in environment variables");
    }

    console.log("Starting token swap...");
    console.log(`From: ${srcToken}`);
    console.log(`To: ${dstToken}`);
    console.log(`Amount: ${amount}`);
    console.log(`Slippage: ${slippage}%`);
    console.log(`Wallet: ${walletAddress}`);

    // Create clients
    const { publicClient, walletClient, account } = createClients(privateKey);

    // Approve token if needed (skip for ETH)
    const isETH = srcToken.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" || 
                  srcToken.toLowerCase() === "eth";
    
    if (!isETH) {
      await approveIfNeeded(srcToken, BigInt(amount), publicClient, walletClient, account);
    }

    // Prepare swap parameters
    const swapParams = {
      src: srcToken,
      dst: dstToken,
      amount: amount.toString(),
      from: walletAddress.toLowerCase(),
      slippage: slippage.toString(),
      disableEstimate: "false",
      allowPartialFill: "false",
    };

    console.log("Fetching swap transaction...");
    
    const swapTx = await call1inchAPI<TxResponse>("/swap", swapParams);

    console.log("Swap transaction details:", swapTx.tx);

    const txHash = await signAndSendTransaction(swapTx.tx, publicClient, walletClient, account);
    
    console.log("Swap transaction sent successfully!");

    return {
      success: true,
      transactionHash: txHash,
      srcToken,
      dstToken,
      amount,
      slippage,
      walletAddress
    };

  } catch (error) {
    console.error("Swap failed:", error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Function to get swap quote without executing
export async function getSwapQuote({
  srcToken,
  dstToken,
  amount,
  walletAddress
}: Omit<SwapParams, 'slippage' | 'privateKey'>) {
  try {
    if (!srcToken || !dstToken || !amount || !walletAddress) {
      throw new Error("Missing required parameters");
    }

    const quoteParams = {
      src: srcToken,
      dst: dstToken,
      amount: amount.toString(),
      from: walletAddress.toLowerCase(),
    };

    console.log("Fetching swap quote...");
    
    const quote = await call1inchAPI("/quote", quoteParams);

    return {
      success: true,
      quote
    };

  } catch (error) {
    console.error("Failed to get quote:", error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Function to get supported tokens
export async function getSupportedTokens() {
  try {
    const tokens = await call1inchAPI("/tokens", {});
    
    return {
      success: true,
      tokens
    };

  } catch (error) {
    console.error("Failed to get supported tokens:", error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Function to check token allowance
export async function checkTokenAllowance(tokenAddress: string, walletAddress: string) {
  try {
    const allowance = await checkAllowance(tokenAddress, walletAddress);
    
    return {
      success: true,
      allowance: allowance.toString(),
      allowanceFormatted: (Number(allowance) / 1e18).toString() // Assuming 18 decimals
    };

  } catch (error) {
    console.error("Failed to check allowance:", error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

export default {
  performTokenSwap,
  getSwapQuote,
  getSupportedTokens,
  checkTokenAllowance
};