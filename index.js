import express from 'express';
import mongoose from 'mongoose';
import allRoutes from './routes/index.js';

const app = express();

function connectDB() {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('MongoDB connected'))
        .catch(err => {
            console.log(err);
            process.exit(1);
        });
}

connectDB();

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello, World!");
});

app.use('/api', allRoutes);

const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})