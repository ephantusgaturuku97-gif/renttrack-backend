const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Root works' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Health check works' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
