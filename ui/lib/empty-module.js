/** Empty stub for optional wallet SDK modules that break Next bundling. */
module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === "__esModule") return true;
      if (prop === "default") return {};
      return () => ({});
    },
  },
);
