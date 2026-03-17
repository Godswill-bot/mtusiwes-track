export default async function handler(req, res) {
  try {
    const fn = new Function("return import('../server/server.js')");
    const module = await fn();
    const app = module.default;
    return app(req, res);
  } catch (error) {
    console.error("BOOT FAILURE", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
