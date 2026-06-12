const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Server is working' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Health check passed' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
