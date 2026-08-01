module.exports = {
  apps: [{
    name: "maddy-cassy-rentals",
    script: ".next/standalone/server.js",
    cwd: __dirname,
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "750M",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      HOSTNAME: "127.0.0.1",
    },
  }],
};
