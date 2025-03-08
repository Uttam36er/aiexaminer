require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');
const User = require('./models/User');
const Question = require('./models/Question');
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection and Sync
sequelize.authenticate()
    .then(async () => {
        console.log('Connected to MySQL database');
        
        // Force sync all defined models to the DB
        await sequelize.sync({ force: true });
        console.log('Database tables synchronized');

        // Create default teacher account if it doesn't exist
        try {
            const [teacher, created] = await User.findOrCreate({
                where: { username: 'teacher' },
                defaults: {
                    username: 'teacher',
                    password: 'teacher123',
                    email: 'teacher@example.com',
                    role: 'teacher'
                }
            });
            if (created) {
                console.log('Default teacher account created');
            }
        } catch (err) {
            console.error('Error creating default teacher:', err);
        }
    })
    .catch(err => {
        console.error('Database connection error:', err);
        process.exit(1);
    });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});