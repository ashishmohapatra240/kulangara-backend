
import express from 'express';

const app = express();
const port = 8000;
app.get('/', (req, res) => {
    res.send('Hello kulangara');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



