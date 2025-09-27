require('dotenv').config();
const ethers = require("ethers");
const { Wallet, providers, Contract } = require("ethers");
const { LimitOrder, getLimitOrderV4Domain, Address, MakerTraits, Sdk, randBigInt, FetchProviderConnector } = require("@1inch/limit-order-sdk");
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

// Configure this as needed
const ORDER_EXPIRATION_HOURS = 24; 

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

async function createETHOrderWithSDK(ethBalance, optimalGasPrice) {
  const domain = getLimitOrderV4Domain(chainId);
  const limitOrderContract = domain.verifyingContract;
  
  const wethBalance = await checkBalance(ETH_TOKENS.WETH, wallet.address);
  if (!wethBalance || wethBalance.balance.eq(0)) {
    console.log("No WETH balance found");
    return;
  }
  
  const sellAmount = wethBalance.balance.div(20);
  const sellFormatted = ethers.utils.formatEther(sellAmount);
  const estimatedUsdValue = parseFloat(sellFormatted) * ETH_PRICE_USD;
  const takingAmount = ethers.utils.parseUnits(estimatedUsdValue.toFixed(2), 6);
  
  console.log(`Selling: ${sellFormatted} WETH for ${ethers.utils.formatUnits(takingAmount, 6)} USDC`);
  
  // Check allowance
  const wethContract = new Contract(ETH_TOKENS.WETH, erc20AbiFragment, wallet);
  const currentAllowance = await wethContract.allowance(wallet.address, limitOrderContract);
  
  if (currentAllowance.lt(sellAmount)) {
    console.log("Approving WETH...");
    const approveTx = await wethContract.approve(limitOrderContract, sellAmount, {
      gasPrice: optimalGasPrice,
      gasLimit: 50000
    });
    await approveTx.wait();
    console.log("WETH approved");
  }
  
  try {
    // Create SDK instance
    const sdk = new Sdk({ 
      authKey, 
      networkId: chainId, 
      httpConnector: new FetchProviderConnector() 
    });

    // Set up order expiration (2 minutes from now)
    const expiresIn = BigInt(ORDER_EXPIRATION_HOURS * 60 * 60); // Convert hours to seconds
    const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
    const UINT_40_MAX = (1n << 40n) - 1n;

    // Create maker traits for NORMAL limit order with correct methods
    const makerTraits = MakerTraits.default()
      .withExpiration(expiration)
      .withNonce(randBigInt(UINT_40_MAX))
      .allowPartialFills()    // Enable partial fills for normal orders
      .allowMultipleFills();  // Enable multiple fills for normal orders

    console.log("Creating order with SDK...");

    // Create the order using SDK's createOrder method
    const order = await sdk.createOrder({
      makerAsset: new Address(ETH_TOKENS.WETH),
      takerAsset: new Address(ETH_TOKENS.USDC),
      makingAmount: BigInt(sellAmount.toString()),
      takingAmount: BigInt(takingAmount.toString()),
      maker: new Address(wallet.address),
    }, makerTraits);

    console.log("Order created with SDK");

    // Get typed data for signing using SDK method
    const typedData = order.getTypedData();
    console.log("Typed data generated");

    // Fix the domain to ensure chainId is properly set
    const cleanDomain = {
      name: typedData.domain.name,
      version: typedData.domain.version,
      chainId: chainId, // Explicitly set chainId as number
      verifyingContract: typedData.domain.verifyingContract
    };

    console.log("Clean domain:", cleanDomain);
    console.log("Message:", typedData.message);

    // Use only Order type for signing with clean domain
    const signature = await wallet._signTypedData(
      cleanDomain, // Use clean domain
      { Order: typedData.types.Order }, // Only pass Order type
      typedData.message
    );

    console.log("Order signed successfully");

    // Submit order using SDK's submitOrder method
    await sdk.submitOrder(order, signature);

    console.log("Order submitted to 1inch API successfully!");

    // Get order hash using SDK method
    const orderHash = order.getOrderHash(chainId);
    
    // Save order details locally
    const signedOrder = {
      orderHash: orderHash,
      order: order.build(),
      signature: signature,
      typedData: { ...typedData, domain: cleanDomain },
      expiration: expiration.toString()
    };
    
    fs.writeFileSync('limit_order.json', JSON.stringify(signedOrder, null, 2));
    console.log("Order saved locally");

    console.log("Order complete!");
    console.log(`Order Hash: ${orderHash}`);
    console.log(`Expires at: ${new Date(Number(expiration) * 1000).toISOString()}`);
    
  } catch (orderError) {
    console.error("Order creation failed:", orderError.message);
    console.error("Stack:", orderError.stack);
  }
}

async function main() {
  console.log("=== Creating WETH -> USDC Limit Order with SDK ===");
  console.log("Wallet:", wallet.address);
  
  const network = await provider.getNetwork();
  console.log("Network:", network.name);
  
  const optimalGasPrice = await getOptimalGasPrice();
  const ethBalance = await provider.getBalance(wallet.address);
  
  console.log("ETH Balance:", ethers.utils.formatEther(ethBalance));
  
  // Verify contracts
  const domain = getLimitOrderV4Domain(chainId);
  await verifyContract(domain.verifyingContract, "1inch Contract");
  await verifyContract(ETH_TOKENS.WETH, "WETH");
  await verifyContract(ETH_TOKENS.USDC, "USDC");
  
  const wethBalance = await checkBalance(ETH_TOKENS.WETH, wallet.address);
  console.log("WETH Balance:", wethBalance ? wethBalance.formatted : '0');
  
  if (wethBalance && parseFloat(wethBalance.formatted) > 0) {
    await createETHOrderWithSDK(ethBalance, optimalGasPrice);
  } else {
    console.log("No WETH balance found");
  }
}

main().catch(console.error);