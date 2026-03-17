export default async function handler(req, res) {
  try {
    const module = await import('../server/server.js');
    const app = module.default;
    return app(req, res);
  } catch (error) {
    console.error("Vercel Serverless Boot Error:", error);
    res.status(500).json({
      error: "BOOT_FAILED",
      message: error.message,
      stack: error.stack
    });
  }
}
