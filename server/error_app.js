import express from 'express';

// Create the top level app wrapper first
const app = express();

app.use((req, res, next) => {
  res.status(500).json({
    error: 'BOOT_FAILED',
    message: global.SERVER_BOOT_ERROR ? global.SERVER_BOOT_ERROR.message : 'Unknown fatal error',
    stack: global.SERVER_BOOT_ERROR ? global.SERVER_BOOT_ERROR.stack : undefined
  });
});

export default app;
