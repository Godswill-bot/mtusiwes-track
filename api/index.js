export default async function handler(req, res) {
  try {
    const module = await import('../server/server.js');
    const app = module.default;
    return app(req, res);
  } catch (error) {
    console.error("BOOT FAILURE", error);
    res.status(500).json({ error: error.message, stack: error.stack, type: error.name });
  }
}
