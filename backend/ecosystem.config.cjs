module.exports = {
  apps: [
    {
      name: "server",
      script: "server.js",
      autorestart: true,
      exp_backoff_restart_delay: 1000,
      kill_timeout: 30000
    },
    {
      name: "worker",
      script: "worker.js",
      autorestart: true,
      exp_backoff_restart_delay: 1000,
      kill_timeout: 30000
    }
  ]
};
