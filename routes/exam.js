const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const jwt = require('jsonwebtoken');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/database');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Middleware to check if user is a teacher
const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Access denied: Teachers only' });
    }
    next();
};

// Submit reviewed questions to database
router.post('/submit-questions', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { questions, subject } = req.body;
        console.log('Received request to save questions:', { subject, questionCount: questions?.length });
        
        if (!Array.isArray(questions) || questions.length === 0) {
            console.error('Invalid questions array:', questions);
            return res.status(400).json({ message: 'Questions must be a non-empty array' });
        }

        if (!subject) {
            return res.status(400).json({ message: 'Subject is required' });
        }

        // Validate each question before saving
        for (const [index, q] of questions.entries()) {
            console.log(`Validating question ${index + 1}`);
            
            if (!q.question || typeof q.question !== 'string') {
                return res.status(400).json({ 
                    message: `Invalid question ${index + 1}: Missing or invalid question text`
                });
            }
            if (!q.options || typeof q.options !== 'object') {
                console.error(`Invalid options for question ${index + 1}:`, q.options);
                return res.status(400).json({ 
                    message: `Invalid question ${index + 1}: Must have options object`
                });
            }
            if (!['a', 'b', 'c', 'd'].every(key => typeof q.options[key] === 'string')) {
                console.error(`Invalid option values for question ${index + 1}:`, q.options);
                return res.status(400).json({ 
                    message: `Invalid question ${index + 1}: Options must have keys a, b, c, d with string values`
                });
            }
            if (!q.answer || !['a', 'b', 'c', 'd'].includes(q.answer)) {
                console.error(`Invalid answer for question ${index + 1}:`, q.answer);
                return res.status(400).json({ 
                    message: `Invalid question ${index + 1}: answer must be 'a', 'b', 'c', or 'd'`
                });
            }
        }

        const results = [];
        const errors = [];

        // Save questions one by one to better handle partial failures
        for (let i = 0; i < questions.length; i++) {
            try {
                const q = questions[i];
                console.log(`Attempting to save question ${i + 1}`, {
                    question: q.question.substring(0, 50) + '...',
                    subject,
                    userId: req.user.userId
                });

                // Ensure options is a plain object
                const questionData = {
                    question: q.question,
                    options: q.options,  // Model will handle JSON stringification
                    answer: q.answer,
                    subject,
                    userId: req.user.userId,
                    approved: true
                };

                console.log('Received question data:', questionData);
                const created = await Question.create(questionData);
                console.log('Saved question data:', created);
                console.log(`Successfully saved question ${i + 1} with ID:`, created.id);
                results.push(created);
            } catch (err) {
                console.error(`Error saving question ${i + 1}:`, err);
                errors.push({ index: i + 1, error: err.message });
            }
        }

        // If some questions were saved but others failed
        if (results.length > 0 && errors.length > 0) {
            return res.status(207).json({
                message: 'Some questions were saved successfully',
                savedCount: results.length,
                totalCount: questions.length,
                errors
            });
        }
        
        // If all questions failed
        if (results.length === 0) {
            return res.status(500).json({
                message: 'Failed to save any questions',
                errors
            });
        }

        // All questions saved successfully
        res.status(200).json({
            message: 'All questions saved successfully',
            count: results.length
        });

    } catch (error) {
        console.error('Error in submit-questions:', error);
        res.status(500).json({ 
            message: 'Error saving questions', 
            error: error.message
        });
    }
});

// Get available exams/subjects
router.get('/subjects', authenticateToken, async (req, res) => {
    try {
        const subjects = await Question.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('subject')), 'subject']],
            raw: true
        });
        res.json({ subjects: subjects.map(s => s.subject) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subjects' });
    }
});

// Get questions for an exam
router.get('/questions/:subject', authenticateToken, async (req, res) => {
    try {
        const questions = await Question.findAll({
            where: {
                subject: req.params.subject,
                approved: true
            },
            attributes: {
                exclude: ['answer'],
                include: ['id', 'question', 'options', 'subject']
            }
        });

        const formattedQuestions = questions.map(q => {
            try {
                const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                console.log(`Parsed options for question ID ${q.id}:`, options);
                return {
                    id: q.id,
                    question: q.question,
                    options: options,
                    subject: q.subject
                };
            } catch (error) {
                console.error(`Error parsing options for question ID ${q.id}:`, error);
                return {
                    id: q.id,
                    question: q.question,
                    options: {},
                    subject: q.subject
                };
            }
        });

        res.json({ questions: formattedQuestions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({
            message: 'Error fetching questions',
            error: error.message
        });
    }
});

// Submit exam answers
router.post('/submit-exam', authenticateToken, async (req, res) => {
    try {
        const { subject, answers } = req.body;
        const questions = await Question.findAll({
            where: { subject, approved: true }
        });

        let score = 0;
        const results = questions.map((question, index) => {
            try {
                const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
                const userAnswer = answers[index] || '';
                const correct = question.answer === userAnswer;
                if (correct) score++;

                return {
                    question: question.question,
                    yourAnswer: options[userAnswer] || '',
                    correctAnswer: options[question.answer],
                    correct,
                    options: options
                };
            } catch (error) {
                console.error('Error parsing options in submit-exam:', error);
                return {
                    question: question.question,
                    yourAnswer: options[userAnswer] || '',
                    correctAnswer: options[question.answer],
                    correct: false,
                    options: {}
                };
            }
        });

        res.json({
            score,
            totalQuestions: questions.length,
            percentage: (score / questions.length) * 100,
            results
        });
    } catch (error) {
        console.error('Error submitting exam:', error);
        res.status(500).json({ message: 'Error submitting exam' });
    }
});

module.exports = router;