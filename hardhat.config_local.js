require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 10,
        accountsBalance: "100000000000000000000000" // 100,000 ETH per account (was 10,000)
      },
      blockGasLimit: 30000000, // 30M gas per block
      gasPrice: 1000000000 // 1 gwei (much lower than default)
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: "remote"
    }
  }
};
