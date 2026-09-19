const { createApp } = require('./app');

const port = Number(process.env.PORT || 3000);
createApp({ dbFile: process.env.DB_FILE || 'data.sqlite' }).listen(port, '127.0.0.1', () => {
  console.log(`Invoicing app listening on http://localhost:${port}`);
});
