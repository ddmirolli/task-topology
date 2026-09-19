// Assign one permitted loopback port to sequential visible HTTP tests.
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (port, ...args) {
  return listen.call(this, port === 0 ? Number(process.env.PORT) : port, ...args);
};
