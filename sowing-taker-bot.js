// Sowing Taker Autobot with Referral and Wallet Generation
// Made for Replit

// Import required modules
const { ethers } = require('ethers');
const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const readline = require('readline');

// Configuration
const API_BASE_URL = 'https://sowing-api.taker.xyz';
const CONTRACT_ADDRESS = '0xF929AB815E8BfB84Cdab8d1bb53F22eB1e455378';
const CONTRACT_ABI = [
    {
        "constant": false,
        "inputs": [],
        "name": "active",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Default referral code (will be overridden if user provides one)
let REFERRAL_CODE = '';
let REFERER_URL = '';

const HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'sec-ch-ua': '"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'Referer': REFERER_URL,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Files for storing data
const WALLETS_FILE = 'wallets.txt';
const PROXIES_FILE = 'proxies.txt';
const LOGS_FILE = 'logs.txt';

// Class for our Sowing Taker Bot
class SowingTakerBot {
    constructor(referralCode = '') {
        this.wallets = [];
        this.proxies = [];
        this.tokens = {};
        this.referralCode = referralCode;
        this.maxReferrals = 0; // 0 means unlimited
        this.completedReferrals = 0;
        this.isRunning = false;
    }
    
    // Update the referral code and URL
    setReferralCode(code) {
        this.referralCode = code;
        return `https://sowing.taker.xyz/?start=${code}`;
    }

    // Log messages to console and file
    log(message, type = 'info', walletAddress = '') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = walletAddress ? `[${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}] ` : '';
        let color;
        
        switch (type) {
            case 'error':
                color = colors.red;
                break;
            case 'success':
                color = colors.green;
                break;
            case 'warning':
                color = colors.yellow;
                break;
            default:
                color = colors.reset;
        }
        
        const logMessage = `[${timestamp}] ${prefix}${message}`;
        console.log(`${color}${logMessage}${colors.reset}`);
        
        // Also log to file
        fs.appendFileSync(LOGS_FILE, `${logMessage}\n`);
    }

    // Load proxies from file
    loadProxies() {
        try {
            if (fs.existsSync(PROXIES_FILE)) {
                this.proxies = fs.readFileSync(PROXIES_FILE, 'utf-8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                this.log(`Loaded ${this.proxies.length} proxies from ${PROXIES_FILE}`, 'success');
            } else {
                this.log(`No proxies file found. Will run without proxies.`, 'warning');
            }
        } catch (error) {
            this.log(`Error loading proxies: ${error.message}`, 'error');
        }
    }

    // Load existing wallets from file
    loadWallets() {
        try {
            if (fs.existsSync(WALLETS_FILE)) {
                const fileContent = fs.readFileSync(WALLETS_FILE, 'utf-8');
                const lines = fileContent.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        if (line.includes('|')) {
                            // Format: Address: 0x... | Private Key: 0x... | Mnemonic: ...
                            const addressMatch = line.match(/Address: (0x[a-fA-F0-9]{40})/);
                            const keyMatch = line.match(/Private Key: (0x[a-fA-F0-9]{64})/);
                            
                            if (addressMatch && keyMatch) {
                                const address = addressMatch[1];
                                const privateKey = keyMatch[1];
                                
                                this.wallets.push({
                                    address,
                                    privateKey,
                                    proxy: this.proxies.length > 0 ? 
                                        this.proxies[Math.floor(Math.random() * this.proxies.length)] : null
                                });
                            }
                        } else if (line.length === 66 && line.startsWith('0x')) {
                            // Format: just the private key
                            const privateKey = line.trim();
                            const wallet = new ethers.Wallet(privateKey);
                            const address = wallet.address;
                            
                            this.wallets.push({
                                address,
                                privateKey,
                                proxy: this.proxies.length > 0 ? 
                                    this.proxies[Math.floor(Math.random() * this.proxies.length)] : null
                            });
                        }
                    } catch (error) {
                        this.log(`Error processing wallet entry: ${line.substring(0, 20)}... - ${error.message}`, 'error');
                    }
                }
                
                this.log(`Loaded ${this.wallets.length} wallets from ${WALLETS_FILE}`, 'success');
            } else {
                this.log(`No wallets file found. Will create new wallets.`, 'warning');
            }
        } catch (error) {
            this.log(`Error loading wallets: ${error.message}`, 'error');
        }
    }

    // Generate new wallet and save to file
    generateWallet() {
        try {
            const wallet = ethers.Wallet.createRandom();
            const address = wallet.address;
            const privateKey = wallet.privateKey;
            const mnemonic = wallet.mnemonic.phrase;
            
            // Save to file
            fs.appendFileSync(WALLETS_FILE, 
                `Address: ${address} | Private Key: ${privateKey} | Mnemonic: ${mnemonic}\n`);
            
            this.log(`Generated new wallet: ${address}`, 'success');
            
            // Add to our wallets array with a random proxy if available
            this.wallets.push({
                address,
                privateKey,
                proxy: this.proxies.length > 0 ? 
                    this.proxies[Math.floor(Math.random() * this.proxies.length)] : null
            });
            
            return { address, privateKey };
        } catch (error) {
            this.log(`Error generating wallet: ${error.message}`, 'error');
            return null;
        }
    }

    // Normalize proxy format
    normalizeProxy(proxy) {
        if (!proxy) return null;
        if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
            proxy = `http://${proxy}`;
        }
        return proxy;
    }

    // Make API request
    async apiRequest(url, method = 'GET', data = null, authToken = null, proxy = null) {
        const config = {
            method,
            url,
            headers: { ...HEADERS },
        };
        
        if (data) config.data = data;
        if (authToken) config.headers['authorization'] = `Bearer ${authToken}`;
        if (proxy) {
            config.httpsAgent = new HttpsProxyAgent(this.normalizeProxy(proxy));
        }
        
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }

    // Generate nonce for wallet authentication
    async generateNonce(wallet) {
        try {
            const response = await this.apiRequest(
                `${API_BASE_URL}/wallet/generateNonce`,
                'POST',
                { walletAddress: wallet.address },
                null,
                wallet.proxy
            );
            
            this.log(`Nonce API response: ${JSON.stringify(response)}`, 'info', wallet.address);
            
            if (response.code === 200) {
                if (response.result?.nonce) {
                    return response.result.nonce;
                } else if (typeof response.result === 'string') {
                    const nonceMatch = response.result.match(/Nonce: (.*)$/m);
                    if (nonceMatch && nonceMatch[1]) {
                        return nonceMatch[1];
                    }
                }
            }
            throw new Error('Failed to generate nonce: ' + (response.message || 'Unknown error'));
        } catch (error) {
            this.log(`Error generating nonce: ${error.message}`, 'error', wallet.address);
            throw error;
        }
    }

    // Login to Sowing Taker with wallet
    async login(wallet, nonce) {
        try {
            const message = `Taker quest needs to verify your identity to prevent unauthorized access. Please confirm your sign-in details below:\n\naddress: ${wallet.address}\n\nNonce: ${nonce}`;
            
            this.log(`Message to sign: ${message}`, 'info', wallet.address);
            
            // Create ethers wallet instance
            const ethersWallet = new ethers.Wallet(wallet.privateKey);
            
            // Sign the message
            let signature;
            try {
                signature = await ethersWallet.signMessage(message);
                this.log(`Generated signature: ${signature}`, 'info', wallet.address);
            } catch (error) {
                this.log(`Signature generation failed: ${error.message}`, 'error', wallet.address);
                throw error;
            }
            
            // Try to login with signature
            const response = await this.apiRequest(
                `${API_BASE_URL}/wallet/login`,
                'POST',
                { address: wallet.address, signature, message },
                null,
                wallet.proxy
            );
            
            this.log(`Login API response: ${JSON.stringify(response)}`, 'info', wallet.address);
            
            // If successful, return the token
            if (response.code === 200) {
                return response.result.token;
            }
            
            // If standard signing fails, try EIP-712
            this.log('Standard signature failed. Attempting EIP-712 signing...', 'warning', wallet.address);
            const domain = {
                name: 'Taker',
                version: '1',
                chainId: 1125,
            };
            const types = {
                Login: [
                    { name: 'address', type: 'address' },
                    { name: 'nonce', type: 'string' },
                ],
            };
            const value = {
                address: wallet.address,
                nonce: nonce,
            };
            
            try {
                signature = await ethersWallet._signTypedData(domain, types, value);
                this.log(`Generated EIP-712 signature: ${signature}`, 'info', wallet.address);
            } catch (error) {
                this.log(`EIP-712 signature generation failed: ${error.message}`, 'error', wallet.address);
                throw error;
            }
            
            const eip712Response = await this.apiRequest(
                `${API_BASE_URL}/wallet/login`,
                'POST',
                { address: wallet.address, signature, message: JSON.stringify({ domain, types, value }) },
                null,
                wallet.proxy
            );
            
            this.log(`EIP-712 login API response: ${JSON.stringify(eip712Response)}`, 'info', wallet.address);
            
            if (eip712Response.code === 200) {
                return eip712Response.result.token;
            }
            
            throw new Error('Login failed: ' + (response.message || eip712Response.message || 'Signature mismatch'));
        } catch (error) {
            this.log(`Login error: ${error.message}`, 'error', wallet.address);
            throw error;
        }
    }

    // Get user info
    async getUserInfo(wallet, token) {
        try {
            const response = await this.apiRequest(
                `${API_BASE_URL}/user/info`,
                'GET',
                null,
                token,
                wallet.proxy
            );
            
            if (response.code === 200) {
                return response.result;
            }
            throw new Error('Failed to fetch user info: ' + response.message);
        } catch (error) {
            this.log(`Error fetching user info: ${error.message}`, 'error', wallet.address);
            throw error;
        }
    }

    // Perform sign-in
    async performSignIn(wallet, token) {
        try {
            const response = await this.apiRequest(
                `${API_BASE_URL}/task/signIn?status=true`,
                'GET',
                null,
                token,
                wallet.proxy
            );
            
            if (response.code === 200) {
                this.log('Sign-in successful! Started farming.', 'success', wallet.address);
                return true;
            }
            this.log('Sign-in failed: ' + response.message, 'error', wallet.address);
            return false;
        } catch (error) {
            this.log(`Sign-in error: ${error.message}`, 'error', wallet.address);
            return false;
        }
    }

    // Format time remaining
    formatTimeRemaining(timestamp) {
        const now = Date.now();
        const timeLeft = timestamp - now;
        
        if (timeLeft <= 0) return '00:00:00';
        
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Process a single wallet
    async processWallet(wallet) {
        try {
            // Check if we've reached the maximum referrals (if set)
            if (this.maxReferrals > 0 && this.completedReferrals >= this.maxReferrals) {
                this.log(`Reached maximum referrals limit (${this.maxReferrals}). Skipping remaining wallets.`, 'warning');
                return false;
            }
            
            this.log(`Processing wallet: ${wallet.address}`, 'info');
            this.log(`Using proxy: ${wallet.proxy || 'None'}`, 'info', wallet.address);
            this.log(`Using referral code: ${this.referralCode}`, 'info', wallet.address);
            
            // Generate nonce
            const nonce = await this.generateNonce(wallet);
            this.log('Nonce generated: ' + nonce, 'info', wallet.address);
            
            // Login
            const token = await this.login(wallet, nonce);
            this.tokens[wallet.address] = token;
            this.log('Login successful! Token received.', 'success', wallet.address);
            
            // Get user info
            const userInfo = await this.getUserInfo(wallet, token);
            this.log(`User Info: Taker Points: ${userInfo.takerPoints}, Consecutive Sign-Ins: ${userInfo.consecutiveSignInCount}`, 'info', wallet.address);
            
            // Check if farming is needed
            if (!userInfo.nextTimestamp || userInfo.nextTimestamp <= Date.now()) {
                this.log('Starting/continuing farming cycle...', 'info', wallet.address);
                await this.performSignIn(wallet, token);
                
                // Get updated user info
                const updatedInfo = await this.getUserInfo(wallet, token);
                
                if (updatedInfo.nextTimestamp) {
                    const nextTime = new Date(updatedInfo.nextTimestamp).toLocaleString();
                    const timeRemaining = this.formatTimeRemaining(updatedInfo.nextTimestamp);
                    this.log(`Farming started. Next reward available at: ${nextTime} (${timeRemaining})`, 'success', wallet.address);
                }
            } else {
                const nextTime = new Date(userInfo.nextTimestamp).toLocaleString();
                const timeRemaining = this.formatTimeRemaining(userInfo.nextTimestamp);
                this.log(`Farming already active. Next reward available at: ${nextTime} (${timeRemaining})`, 'info', wallet.address);
            }
            
            // Increment successful referrals counter
            this.completedReferrals++;
            this.log(`Referral ${this.completedReferrals}${this.maxReferrals > 0 ? '/' + this.maxReferrals : ''} completed`, 'success', wallet.address);
            
            return true;
        } catch (error) {
            this.log(`Error processing wallet: ${error.message}`, 'error', wallet.address);
            return false;
        }
    }

    // Run the bot
    async run(autoGenerate = false, walletCount = 0) {
        this.isRunning = true;
        this.log('Starting Sowing Taker Bot with referral code: ' + this.referralCode, 'info');
        
        // Load proxies
        this.loadProxies();
        
        // Load existing wallets
        this.loadWallets();
        
        // Generate new wallets if requested
        if (autoGenerate && walletCount > 0) {
            this.log(`Generating ${walletCount} new wallets...`, 'info');
            for (let i = 0; i < walletCount; i++) {
                await this.generateWallet();
            }
        }
        
        // Check if we have wallets
        if (this.wallets.length === 0) {
            this.log('No wallets available. Please generate wallets first.', 'error');
            this.isRunning = false;
            return;
        }
        
        // Process each wallet
        for (let i = 0; i < this.wallets.length; i++) {
            if (!this.isRunning) break;
            
            const wallet = this.wallets[i];
            this.log(`Processing wallet ${i + 1}/${this.wallets.length}: ${wallet.address}`, 'info');
            
            await this.processWallet(wallet);
            
            // Add a delay between wallets
            if (i < this.wallets.length - 1) {
                const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
                this.log(`Waiting ${delay/1000} seconds before next wallet...`, 'info');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        this.log('All wallets processed!', 'success');
        this.isRunning = false;
    }

    // Stop the bot
    stop() {
        this.isRunning = false;
        this.log('Stopping bot...', 'warning');
    }
}

// Main function
async function main() {
    console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║               SOWING TAKER AUTOBOT                    ║
║              =====================                    ║
║                                                       ║
║  🌱 Generates wallets                                 ║
║  🌱 Uses custom referral code                         ║
║  🌱 Automates farming                                 ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
${colors.reset}`);

    // Start by asking for referral code
    rl.question(`${colors.yellow}Enter your referral code (default is B81Z0GDR): ${colors.reset}`, async (refCode) => {
        // Create bot with referral code
        const bot = new SowingTakerBot(refCode || 'B81Z0GDR');
        
        // Set global referral URL for headers
        REFERER_URL = bot.setReferralCode(bot.referralCode);
        HEADERS.Referer = REFERER_URL;
        
        console.log(`${colors.green}Using referral code: ${bot.referralCode}${colors.reset}`);
        console.log(`${colors.green}Referral URL: ${REFERER_URL}${colors.reset}`);
        
        // Now ask for number of referrals to make (0 = unlimited)
        rl.question(`${colors.yellow}Maximum number of referrals to process (0 for unlimited): ${colors.reset}`, async (maxRefs) => {
            const maxReferrals = parseInt(maxRefs);
            if (isNaN(maxReferrals) || maxReferrals < 0) {
                console.log(`${colors.red}Invalid number. Using unlimited referrals.${colors.reset}`);
                bot.maxReferrals = 0;
            } else {
                bot.maxReferrals = maxReferrals;
                console.log(`${colors.green}Will process maximum ${maxReferrals} referrals.${colors.reset}`);
            }
            
            // Prompt for action
            rl.question(`${colors.yellow}What would you like to do?\n${colors.reset}` +
                `  ${colors.green}1${colors.reset} - Generate new wallets only\n` +
                `  ${colors.green}2${colors.reset} - Use existing wallets only\n` +
                `  ${colors.green}3${colors.reset} - Generate new wallets and use them\n` +
                `  ${colors.green}4${colors.reset} - Exit\n` +
                `${colors.yellow}Enter your choice (1-4): ${colors.reset}`, async (choice) => {
                
                switch (choice) {
                    case '1':
                        rl.question(`${colors.yellow}How many wallets do you want to generate? ${colors.reset}`, async (count) => {
                            const numCount = parseInt(count);
                            if (isNaN(numCount) || numCount <= 0) {
                                console.log(`${colors.red}Invalid number. Please enter a positive number.${colors.reset}`);
                                rl.close();
                                return;
                            }
                            
                            console.log(`${colors.green}Generating ${numCount} wallets...${colors.reset}`);
                            for (let i = 0; i < numCount; i++) {
                                await bot.generateWallet();
                            }
                            console.log(`${colors.green}Generated ${numCount} wallets successfully! Check ${WALLETS_FILE}${colors.reset}`);
                            rl.close();
                        });
                        break;
                        
                    case '2':
                        console.log(`${colors.green}Using existing wallets only...${colors.reset}`);
                        await bot.run(false);
                        rl.close();
                        break;
                        
                    case '3':
                        rl.question(`${colors.yellow}How many new wallets do you want to generate? ${colors.reset}`, async (count) => {
                            const numCount = parseInt(count);
                            if (isNaN(numCount) || numCount <= 0) {
                                console.log(`${colors.red}Invalid number. Please enter a positive number.${colors.reset}`);
                                rl.close();
                                return;
                            }
                            
                            console.log(`${colors.green}Generating ${numCount} wallets and using them...${colors.reset}`);
                            await bot.run(true, numCount);
                            rl.close();
                        });
                        break;
                        
                    case '4':
                        console.log(`${colors.yellow}Exiting program.${colors.reset}`);
                        rl.close();
                        break;
                        
                    default:
                        console.log(`${colors.red}Invalid choice. Exiting.${colors.reset}`);
                        rl.close();
                }
            });
        });
    });
}

// Run the program
main().catch(error => {
    console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
    process.exit(1);
});
