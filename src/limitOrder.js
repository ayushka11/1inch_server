require('dotenv').config();
const ethers = require("ethers");
const { Wallet, providers, Contract } = require("ethers");
const { getLimitOrderV4Domain } = require("@1inch/limit-order-sdk");
const fs = require("fs");
const axios = require("axios");

// Standard ERC-20 ABI fragment + WETH specific functions
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function deposit() external payable",
  "function withdraw(uint256 amount) external"
];

const privKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.RPC_URL;
const authKey = process.env["1INCH_API_KEY"];
const chainId = parseInt(process.env.CHAIN_ID) || 1;

const provider = new providers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privKey, provider);

const ETH_TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
};

const ETH_PRICE_USD = 5000;

// Function to get optimal gas price for Ethereum
async function getOptimalGasPrice() {
  try {
    const gasPrice = await provider.getGasPrice();
    console.log("Current Gas Price (gwei):", ethers.utils.formatUnits(gasPrice, "gwei"));
    
    // Ethereum typically has higher gas prices, but current is very low (0.4 gwei)
    const maxGasPrice = ethers.utils.parseUnits("10", "gwei"); // 10 gwei max for safety
    
    if (gasPrice.gt(maxGasPrice)) {
      console.log("⚠️ Gas price very high, using capped price for safety");
      return maxGasPrice;
    }
    
    return gasPrice;
  } catch (error) {
    console.log("Failed to get gas price, using default:", error.message);
    return ethers.utils.parseUnits("1", "gwei"); // 1 gwei default
  }
}

// Function to verify contract exists
async function verifyContract(address, name) {
  try {
    // Convert to proper checksum address
    const checksumAddress = ethers.utils.getAddress(address);
    const code = await provider.getCode(checksumAddress);
    const exists = code !== "0x";
    console.log(`${name} contract at ${checksumAddress}:`, exists ? "EXISTS" : "NOT FOUND");
    return exists;
  } catch (error) {
    console.log(`Failed to check ${name} contract:`, error.message);
    return false;
  }
}

// Function to submit order to 1inch API - CORRECT FORMAT
async function submitOrderTo1inch(orderHash, signature, orderData) {
  const url = `https://api.1inch.dev/orderbook/v4.1/${chainId}`;
  
  // Convert all addresses to lowercase strings as per API schema
  const body = {
    "orderHash": orderHash.toLowerCase(),
    "signature": signature.toLowerCase(), 
    "data": {
      "makerAsset": orderData.makerAsset.toLowerCase(),
      "takerAsset": orderData.takerAsset.toLowerCase(),
      "maker": orderData.maker.toLowerCase(),
      "receiver": "0x0000000000000000000000000000000000000000",
      "makingAmount": orderData.makingAmount,
      "takingAmount": orderData.takingAmount,
      "salt": orderData.salt,
      "extension": "0x",
      "makerTraits": "0"
    }
  };

  // DEBUG: Print exact request being sent
  console.log("=== DEBUG: API Request Body ===");
  console.log(JSON.stringify(body, null, 2));
  console.log("===============================");

  try {
<<<<<<< Updated upstream
    console.log("Submitting to 1inch API...");
    const response = await axios.post(url, body, config);
    console.log("Order submitted successfully to 1inch API!");
=======
    const response = await axios.post(url, body, {
      headers: {
        "Authorization": `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
    console.log("✅ Order submitted to 1inch API successfully!");
>>>>>>> Stashed changes
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
    } else {
      console.error("Network Error:", error.message);
    }
    throw error;
  }
}

async function checkBalance(tokenAddress, walletAddress) {
  const tokenContract = new Contract(tokenAddress, erc20AbiFragment, provider);
  try {
    const balance = await tokenContract.balanceOf(walletAddress);
    return {
      balance,
      formatted: ethers.utils.formatUnits(balance, tokenAddress === ETH_TOKENS.USDC ? 6 : 18)
    };
  } catch (error) {
    return null;
  }
}

<<<<<<< Updated upstream
/**
 * Create a PUBLIC limit order (no expiration) - tries SDK first, falls back to manual
 * @param {string} makerTokenSymbol - Symbol of token to sell
 * @param {string} takerTokenSymbol - Symbol of token to buy  
 * @param {string} makingAmount - Amount to sell (in token units)
 * @param {string} takingAmount - Amount to receive (in token units)
 */
async function createPublicLimitOrder(makerTokenSymbol, takerTokenSymbol, makingAmount, takingAmount) {
  console.log(`\n=== Creating PUBLIC ${makerTokenSymbol} -> ${takerTokenSymbol} Order ===`);
  console.log(" Public Order: No expiration, compatible with 1inch API");
  
  // Validate token symbols
  if (!VALID_TOKENS[makerTokenSymbol] || !VALID_TOKENS[takerTokenSymbol]) {
    throw new Error(`Invalid token symbols. Valid tokens: ${Object.keys(VALID_TOKENS).join(', ')}`);
  }
  
  const makerToken = VALID_TOKENS[makerTokenSymbol];
  const takerToken = VALID_TOKENS[takerTokenSymbol];
  
  // Convert amounts to wei/token units
  const makingAmountWei = ethers.utils.parseUnits(makingAmount, makerToken.decimals);
  const takingAmountWei = ethers.utils.parseUnits(takingAmount, takerToken.decimals);
  
  console.log(`Selling: ${makingAmount} ${makerToken.symbol}`);
  console.log(`For: ${takingAmount} ${takerToken.symbol}`);
  console.log(`Rate: ${(parseFloat(takingAmount) / parseFloat(makingAmount)).toFixed(6)} ${takerToken.symbol} per ${makerToken.symbol}`);
  
  // Check maker token balance
  const makerContract = new Contract(makerToken.address, erc20AbiFragment, wallet);
  const balance = await makerContract.balanceOf(wallet.address);
  const balanceFormatted = ethers.utils.formatUnits(balance, makerToken.decimals);
=======
async function createETHOrderManual(ethBalance, optimalGasPrice) {
  const domain = getLimitOrderV4Domain(chainId);
  const limitOrderContract = domain.verifyingContract;
>>>>>>> Stashed changes
  
  const makerAsset = ETH_TOKENS.WETH;
  const takerAsset = ETH_TOKENS.USDC;
  
  const wethBalance = await checkBalance(ETH_TOKENS.WETH, wallet.address);
  if (!wethBalance || wethBalance.balance.eq(0)) {
    console.log("❌ No WETH balance found");
    return;
  }
  
  const sellAmount = wethBalance.balance;
  const sellFormatted = ethers.utils.formatEther(sellAmount);
  const estimatedUsdValue = parseFloat(sellFormatted) * ETH_PRICE_USD;
  const takingAmount = ethers.utils.parseUnits(estimatedUsdValue.toFixed(2), 6);
  
  console.log(`Selling: ${sellFormatted} WETH for ${ethers.utils.formatUnits(takingAmount, 6)} USDC`);
  
  // Check allowance
  const wethContract = new Contract(makerAsset, erc20AbiFragment, wallet);
  const currentAllowance = await wethContract.allowance(wallet.address, limitOrderContract);
  
  if (currentAllowance.lt(sellAmount)) {
    console.log("Approving WETH...");
    const approveTx = await wethContract.approve(limitOrderContract, sellAmount, {
      gasPrice: optimalGasPrice,
      gasLimit: 50000
    });
    await approveTx.wait();
<<<<<<< Updated upstream
    console.log("Approval successful");
=======
    console.log("✅ WETH approved");
>>>>>>> Stashed changes
  }
  
  try {
<<<<<<< Updated upstream
    console.log("Attempting order creation with SDK...");
=======
    const salt = BigInt(Date.now()).toString();
>>>>>>> Stashed changes
    
    // Order structure - EXACT format for 1inch
    const publicOrder = {
      salt: salt,
      maker: wallet.address,
      receiver: "0x0000000000000000000000000000000000000000",
      makerAsset: makerAsset,
      takerAsset: takerAsset,
      makingAmount: sellAmount.toString(),
      takingAmount: takingAmount.toString(),
      extension: "0x",
      makerTraits: "0"
    };
    
    // EIP-712 signing
    const domain = {
      name: "1inch Limit Order Protocol",
      version: "4",
      chainId: chainId,
      verifyingContract: limitOrderContract
    };
    
<<<<<<< Updated upstream
    console.log("SDK order creation successful!");
=======
    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "receiver", type: "address" },
        { name: "makerAsset", type: "address" },
        { name: "takerAsset", type: "address" },
        { name: "makingAmount", type: "uint256" },
        { name: "takingAmount", type: "uint256" },
        { name: "extension", type: "bytes" },
        { name: "makerTraits", type: "uint256" }
      ]
    };
>>>>>>> Stashed changes
    
    const signature = await wallet._signTypedData(domain, types, publicOrder);
    const orderHash = ethers.utils._TypedDataEncoder.hash(domain, types, publicOrder);
    
    const signedOrder = {
      orderHash: orderHash,
      order: publicOrder,
      signature: signature,
      domain: domain,
      types: types
    };
    
<<<<<<< Updated upstream
    methodUsed = "SDK";
    console.log("Order signed with SDK method!");
    
  } catch (sdkError) {
    console.log("SDK failed:", sdkError.message);
    console.log("Falling back to manual method...");
    
    // FALLBACK TO MANUAL METHOD
    try {
      orderResult = await createOrderManual(
        makerToken.address,
        takerToken.address,
        makingAmountWei,
        takingAmountWei
      );
      methodUsed = "Manual";
      console.log("Manual order creation successful!");
      
    } catch (manualError) {
      console.error("Manual method also failed:", manualError.message);
      throw new Error("Both SDK and manual methods failed");
    }
  }
  
  // Save order locally
  const signedOrder = {
    ...orderResult,
    metadata: {
      makerToken: makerToken.symbol,
      takerToken: takerToken.symbol,
      makingAmount,
      takingAmount,
      rate: (parseFloat(takingAmount) / parseFloat(makingAmount)).toFixed(6),
      timestamp: new Date().toISOString(),
      method: methodUsed,
      chainId,
      isPublicOrder: true
    }
  };
  
  const filename = `public_order_${makerTokenSymbol}_to_${takerTokenSymbol}_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(signedOrder, null, 2));
  console.log(`Order saved to ${filename}`);
  
  // Submit to 1inch API
  let apiResult = null;
  try {
    apiResult = await submitTo1inchAPI(orderResult.orderHash, orderResult.signature, orderResult.order);
    signedOrder.apiResult = apiResult;
    
    // Update saved file with API result
    fs.writeFileSync(filename, JSON.stringify(signedOrder, null, 2));
    
  } catch (apiError) {
    console.log("Order created but API submission failed");
    console.log("Order is still valid and saved locally");
=======
    fs.writeFileSync('limit_order.json', JSON.stringify(signedOrder, null, 2));
    console.log("✅ Order saved locally");
    
    // Submit to 1inch API
    await submitOrderTo1inch(orderHash, signature, publicOrder);
    
    console.log("✅ Order complete!");
    console.log(`Order Hash: ${orderHash}`);
    
  } catch (orderError) {
    console.error("❌ Order creation failed:", orderError.message);
>>>>>>> Stashed changes
  }
}

async function main() {
  console.log("=== Creating WETH -> USDC Limit Order ===");
  console.log("Wallet:", wallet.address);
  
<<<<<<< Updated upstream
  console.log("\n=== PUBLIC Order Complete! ===");
  console.log(`Method Used: ${methodUsed}`);
  console.log(`Selling: ${makingAmount} ${makerToken.symbol}`);
  console.log(`For: ${takingAmount} ${takerToken.symbol}`);
  console.log(`Order Hash: ${orderResult.orderHash}`);
  console.log(`File: ${filename}`);
  console.log(`Expires: Never (public order)`);
  
  if (apiResult) {
    console.log(`API Status: Successfully submitted`);
  }
=======
  const network = await provider.getNetwork();
  console.log("Network:", network.name);
  
  const optimalGasPrice = await getOptimalGasPrice();
  const ethBalance = await provider.getBalance(wallet.address);
>>>>>>> Stashed changes
  
  console.log("ETH Balance:", ethers.utils.formatEther(ethBalance));
  
  // Verify contracts
  const domain = getLimitOrderV4Domain(chainId);
  await verifyContract(domain.verifyingContract, "1inch Contract");
  await verifyContract(ETH_TOKENS.WETH, "WETH");
  await verifyContract(ETH_TOKENS.USDC, "USDC");
  
<<<<<<< Updated upstream
  try {
    // Show current balances
    console.log("\n=== Current Balances ===");
    for (const symbol of Object.keys(VALID_TOKENS)) {
      try {
        const balance = await getTokenBalance(symbol);
        if (parseFloat(balance) > 0) {
          console.log(`${symbol}: ${balance}`);
        }
      } catch (error) {
        // Skip tokens we can't check
      }
    }
    
    // Test with your WETH balance
    const wethBalance = await getTokenBalance("WETH");
    if (parseFloat(wethBalance) > 0) {
      console.log(`\nTesting with WETH balance: ${wethBalance}`);
      
      // Create a small test order: sell 50% of WETH for USDC
      const sellAmount = (parseFloat(wethBalance) * 0.5).toFixed(6);
      const expectedUSDC = (parseFloat(sellAmount) * 2650).toFixed(2); // ~$2650/ETH
      
      console.log(`\nTest Order: ${sellAmount} WETH -> ${expectedUSDC} USDC`);
      
      // Uncomment to actually create the order:
      // await createPublicLimitOrder("WETH", "USDC", sellAmount, expectedUSDC);
      
    } else {
      console.log("\nNo WETH balance found for testing");
    }
    
  } catch (error) {
    console.error("Test Error:", error.message);
=======
  const wethBalance = await checkBalance(ETH_TOKENS.WETH, wallet.address);
  console.log("WETH Balance:", wethBalance ? wethBalance.formatted : '0');
  
  if (wethBalance && parseFloat(wethBalance.formatted) > 0) {
    await createETHOrderManual(ethBalance, optimalGasPrice);
  } else {
    console.log("❌ No WETH balance found");
>>>>>>> Stashed changes
  }
}

main().catch(console.error);