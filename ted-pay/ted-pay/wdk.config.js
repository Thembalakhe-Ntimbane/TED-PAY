// Bundles only the chain modules we need into the Bare worklet (npm run wdk:bundle -> ./.wdk)
module.exports = {
  networks: { ethereum: { package: '@tetherto/wdk-wallet-evm-erc-4337' } },
  transport: 'hrpc'
};
