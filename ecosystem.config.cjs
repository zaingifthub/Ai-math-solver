/**
 * PM2 process file for VPS deployments (Hostinger VPS, any Ubuntu server).
 * Start:   pm2 start ecosystem.config.cjs
 * Reload:  pm2 reload ai-math-solver
 */
module.exports = {
  apps: [
    {
      name: "ai-math-solver",
      cwd: __dirname + "/.next/standalone",
      script: "server.js",
      instances: 1, // the in-memory rate limiter and CAS worker are per-process; set RATE_LIMIT_STORE=database before scaling out
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      out_file: "/var/log/ai-math-solver/out.log",
      error_file: "/var/log/ai-math-solver/error.log",
      time: true,
    },
  ],
};
