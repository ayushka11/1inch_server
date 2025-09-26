import 'dotenv/config';
import { Wallet, JsonRpcProvider, Contract } from "ethers";

// Standard ERC-20 ABI fragment
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

// Environment variables
const privKey = process.env.PRIVATE_KEY;
const authKey = process.env.ONEINCH_API_KEY;
const chainId = 11155111; // Sepolia testnet

// Sepolia testnet RPC endpoint
const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const wallet = new Wallet(privKey, provider);

// Real Sepolia testnet token addresses
const makerAsset = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const takerAsset = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";

// 1inch Limit Order Protocol V4 contract address on Sepolia
const LIMIT_ORDER_CONTRACT = "0x111111125421cA6dc452d289314280a0f8842A65";

const makingAmount = 10_000_000_000_000_000n; // 0.01 LINK (18 decimals)
const takingAmount = 5_000_000_000_000_000n;

async function checkTokenExists(tokenAddress, tokenName) {
  try {
    const contract = new Contract(tokenAddress, erc20AbiFragment, provider);
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    console.log(`${tokenName} (${symbol}) found with ${decimals} decimals`);
    return true;
  } catch (error) {
    console.log(`${tokenName} at ${tokenAddress} not found or not a valid ERC20 token`);
    return false;
  }
}

async function testSetupAndApprove() {
  try {
    console.log("Testing setup...");
    console.log(`Wallet Address: ${wallet.address}`);
    console.log(`Chain ID: ${chainId}`);
    
    const ethBalance = await provider.getBalance(wallet.address);
    console.log(`ETH Balance: ${ethBalance} wei (${Number(ethBalance) / 10**18} ETH)`);
    
    console.log("\n Checking token contracts...");
    const makerExists = await checkTokenExists(makerAsset, "Maker Asset");
    const takerExists = await checkTokenExists(takerAsset, "Taker Asset");
    
    if (!makerExists || !takerExists) {
      console.log("\n One or more token contracts don't exist on Sepolia.");
      console.log("You need to:");
      console.log("1. Find valid Sepolia testnet token addresses");
      console.log("2. Or deploy your own test tokens");
      console.log("3. Or get tokens from Sepolia faucets");
      return;
    }
    
    console.log("\n Checking token balances...");
    const makerContract = new Contract(makerAsset, erc20AbiFragment, provider);
    const takerContract = new Contract(takerAsset, erc20AbiFragment, provider);
    
    const makerBalance = await makerContract.balanceOf(wallet.address);
    const takerBalance = await takerContract.balanceOf(wallet.address);
    
    const makerSymbol = await makerContract.symbol();
    const takerSymbol = await takerContract.symbol();
    
    console.log(`${makerSymbol} Balance: ${makerBalance}`);
    console.log(`${takerSymbol} Balance: ${takerBalance}`);
    
    if (makerBalance === 0n) {
      console.log(`\n You don't have any ${makerSymbol} tokens!`);
      console.log("Get some from:");
      console.log("- Chainlink faucet: https://faucets.chain.link/sepolia");
      console.log("- Uniswap on Sepolia (swap ETH for tokens)");
      return;
    }
    
    console.log("\nChecking token allowance...");
    const makerContractWithSigner = new Contract(makerAsset, erc20AbiFragment, wallet);
    const currentAllowance = await makerContractWithSigner.allowance(
      wallet.address,
      LIMIT_ORDER_CONTRACT
    );
    
    console.log(`Current allowance for ${makerSymbol}: ${currentAllowance}`);
    console.log(`Required amount: ${makingAmount}`);
    
    if (currentAllowance < makingAmount) {
      console.log("Insufficient allowance. Need to approve tokens...");
      
      if (makerBalance >= makingAmount) {
        console.log(" You have sufficient token balance. Ready to approve!");
        console.log("Uncomment the approval code to proceed.");
        const approveTx = await makerContractWithSigner.approve(LIMIT_ORDER_CONTRACT, makingAmount);
        console.log(`Approval transaction sent: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("Approval confirmed!");
      } else {
        console.log(` Insufficient ${makerSymbol} balance.`);
        console.log(`Current: ${makerBalance}, Need: ${makingAmount}`);
      }
    } else {
      console.log(" Sufficient allowance already exists!");
    }
    
    console.log("\nSetup test complete!");
    
  } catch (error) {
    console.error(" Error in setup test:", error);
  }
}

async function createSimpleLimitOrder() {
  console.log("\n Creating limit order (manual approach)...");
  
  // Basic limit order parameters
  const orderParams = {
    makerAsset,
    takerAsset,
    makingAmount: makingAmount.toString(),
    takingAmount: takingAmount.toString(),
    maker: wallet.address,
    expiration: Math.floor(Date.now() / 1000) + 3600
  };
  
  console.log("Order parameters:", orderParams);
  console.log("Ready for limit order creation!");
}

// EIP-712 domain and types for 1inch Limit Orders
const EIP712_DOMAIN = {
  name: "1inch Limit Order Protocol",
  version: "4",
  chainId: chainId,
  verifyingContract: LIMIT_ORDER_CONTRACT
};

const ORDER_TYPE = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "makerAsset", type: "address" },
    { name: "takerAsset", type: "address" },
    { name: "maker", type: "address" },
    { name: "receiver", type: "address" },
    { name: "allowedSender", type: "address" },
    { name: "makingAmount", type: "uint256" },
    { name: "takingAmount", type: "uint256" },
    { name: "offsets", type: "uint256" },
    { name: "interactions", type: "bytes" }
  ]
};

async function createAndSignLimitOrder() {
  console.log("\n📝 Creating and signing limit order...");
  
  try {
    const salt = BigInt(Math.floor(Math.random() * 1000000000));
    
    // Create the order object
    const order = {
      salt: salt.toString(),
      makerAsset: makerAsset,
      takerAsset: takerAsset,
      maker: wallet.address,
      receiver: "0x0000000000000000000000000000000000000000", // Zero address means maker receives
      allowedSender: "0x0000000000000000000000000000000000000000", // Zero address means anyone can fill
      makingAmount: makingAmount.toString(),
      takingAmount: takingAmount.toString(),
      offsets: "0",
      interactions: "0x"
    };
    
    console.log("Order to sign:", order);
    
    const typedData = {
      domain: EIP712_DOMAIN,
      types: ORDER_TYPE,
      primaryType: "Order",
      message: order
    };
    
    console.log("\n Signing order with EIP-712...");
    
    const signature = await wallet.signTypedData(
      typedData.domain,
      { Order: typedData.types.Order },
      typedData.message
    );
    
    console.log(` Order signed! Signature: ${signature}`);
    
    // Create the final limit order object
    const signedOrder = {
      order,
      signature,
      orderHash: null //TODO: Would need to calculate this for submission
    };
    
    console.log("\n Limit order created and signed successfully!");
    console.log("Next steps:");
    console.log("1. Submit to 1inch API");
    console.log("2. Or share off-chain for others to fill");
    
    return signedOrder;
    
  } catch (error) {
    console.error(" Error creating/signing order:", error);
    return null;
  }
}

async function submitOrderToAPI(signedOrder) {
  console.log("\n Submitting order to 1inch API...");
  
  try {
    // 1inch API endpoint for Sepolia testnet
    const apiUrl = `https://api.1inch.dev/orderbook/v4.0/${chainId}/order`;
    
    // Prepare the order data for submission
    const orderData = {
      ...signedOrder.order,
      signature: signedOrder.signature
    };
    
    console.log("Submitting order data:", orderData);
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(` API Error ${response.status}:`, errorText);
      return null;
    }
    
    const result = await response.json();
    console.log(" Order submitted successfully:", result);
    
    return result;
    
  } catch (error) {
    console.error(" Failed to submit order:", error);
    
    // Handle specific error cases
    if (error.message.includes('fetch')) {
      console.log(" Tip: Make sure you're connected to the internet and the API key is valid.");
    }
    
    return null;
  }
}

// Alternative function to check if the order can be submitted
async function validateOrderForSubmission(signedOrder) {
  console.log("\n Validating order before submission...");
  
  try {
    // Check if we have all required fields
    const requiredFields = ['salt', 'makerAsset', 'takerAsset', 'maker', 'makingAmount', 'takingAmount'];
    const missingFields = requiredFields.filter(field => !signedOrder.order[field]);
    
    if (missingFields.length > 0) {
      console.error(" Missing required fields:", missingFields);
      return false;
    }
    
    // Check if signature exists
    if (!signedOrder.signature) {
      console.error(" Missing signature");
      return false;
    }
    
    // Check token balances again
    const makerContract = new Contract(makerAsset, erc20AbiFragment, provider);
    const balance = await makerContract.balanceOf(wallet.address);
    
    if (balance < BigInt(signedOrder.order.makingAmount)) {
      console.error(" Insufficient token balance for order");
      return false;
    }
    
    // Check allowance
    const allowance = await makerContract.allowance(wallet.address, LIMIT_ORDER_CONTRACT);
    
    if (allowance < BigInt(signedOrder.order.makingAmount)) {
      console.error(" Insufficient token allowance for order");
      return false;
    }
    
    console.log(" Order validation passed!");
    return true;
    
  } catch (error) {
    console.error("Error validating order:", error);
    return false;
  }
}

async function main() {
  console.log("=== 1inch Limit Order Setup ===");
  
  // Step 1: Test setup and approve tokens
  await testSetupAndApprove();
  
  // Step 2: Create and sign the limit order
  const signedOrder = await createAndSignLimitOrder();
  
  if (signedOrder) {
    // Step 3: Validate the order
    const isValid = await validateOrderForSubmission(signedOrder);
    
    if (isValid) {
      // Step 4: Submit to 1inch API
      console.log("\n Ready to submit order to 1inch API?");
      console.log(" This will create a real limit order on Sepolia testnet!");
      console.log("Uncomment the next line to proceed with submission:");
      
      // Uncomment the next line to actually submit the order
      const result = await submitOrderToAPI(signedOrder);
      
      console.log("\n All steps completed successfully!");
      console.log("Your signed limit order is ready for submission.");
      console.log("\nTo submit:");
      console.log("1. Uncomment the submitOrderToAPI call above");
      console.log("2. Run the script again");
    } else {
      console.log("Order validation failed. Please fix the issues above.");
    }
  }
}

main();