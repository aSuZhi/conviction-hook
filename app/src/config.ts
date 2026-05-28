const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

export const config = {
  chainName: 'X Layer mainnet',
  chainId: 196,
  rpcUrl: (env.VITE_XLAYER_MAINNET_RPC_URL || 'https://rpc.xlayer.tech') as string,
  poolManagerAddress: (env.VITE_XLAYER_MAINNET_V4_POOL_MANAGER || '0x360e68faccca8ca495c1b759fd9eee466db9fb32') as `0x${string}`,
  factoryAddress: (env.VITE_CONVICTION_FACTORY_ADDRESS || '0x9441f3e577b3d914e4563a8e5c3a6ca9c4421319') as `0x${string}`,
  managerAddress: (env.VITE_CONVICTION_MANAGER_ADDRESS || '0xd9397a0d9872ef7888c221b3758b833c43a656a1') as `0x${string}`,
  hookAddress: (env.VITE_CONVICTION_HOOK_ADDRESS || '0xcfa1e4f193b93b8822837f132828245f0ef314c0') as `0x${string}`,
  routerAddress: (env.VITE_CONVICTION_ROUTER_ADDRESS || '0x67aadd728b7774a5985e653fa2f4d9661dc5242a') as `0x${string}`,
  marketAddress: (env.VITE_CONVICTION_MARKET_ADDRESS || '0x3dA74Bd2319f1E17cA5C977D22960a3d0E13068c') as `0x${string}`,
  resolverAddress: (env.VITE_CONVICTION_RESOLVER_ADDRESS || '0xcfd6553812c2f489539f62a75a5787fe9b51f8aa') as `0x${string}`,
  collateralToken: (env.VITE_DEMO_COLLATERAL_TOKEN || '0x381734768da85de012ffec4f296f17d52899e32e') as `0x${string}`,
  demoPoolBootstrapper: (env.VITE_DEMO_POOL_BOOTSTRAPPER || '0x0aa068bf1bf5f8d0174558021e34097882ecae0e') as `0x${string}`,
  demoPoolCurrency0: (env.VITE_DEMO_POOL_CURRENCY0 || '0x4b9a2e4c384BD45bb224BD3cfd65Af54B121E012') as `0x${string}`,
  demoPoolCurrency1: (env.VITE_DEMO_POOL_CURRENCY1 || '0x5ff280C26bB357C8d547A26380bfefB0C187f241') as `0x${string}`,
  demoPoolFee: Number(env.VITE_DEMO_POOL_FEE || 3000),
  demoPoolTickSpacing: Number(env.VITE_DEMO_POOL_TICK_SPACING || 60),
  demoJourneyController: (env.VITE_DEMO_JOURNEY_CONTROLLER || '0x67123f7d2a03dd64397287a14dc5ffa88a89376d') as `0x${string}`,
  yesTokenAddress: (env.VITE_DEMO_YES_TOKEN || '0x99A93b24cCcd179173C54B81949a13dfD96FD9ee') as `0x${string}`,
  noTokenAddress: (env.VITE_DEMO_NO_TOKEN || '0xec8217a862BBBf6a81157F53663EabCAF6073de5') as `0x${string}`,
  explorerTxUrl: 'https://www.oklink.com/xlayer/tx/',
};
