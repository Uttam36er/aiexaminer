// Utility function to get auth header
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Teacher: Handle PDF upload and question generation
document.getElementById('pdf-upload-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Generating Questions...';
        
        const response = await fetch('/api/exam/generate-questions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            displayQuestionsForReview(data.questions, formData.get('subject'));
        } else {
            let errorMessage = data.message || 'Failed to generate questions';
            if (data.error) {
                errorMessage += `: ${data.error}`;
            }
            alert(errorMessage);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate questions. Please check the console for details.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});

// Teacher: Handle Gemini AI integration
document.getElementById('open-gemini')?.addEventListener('click', () => {
    window.open('https://gemini.google.com/app?hl=en-IN', '_blank');
});

// Handle questions input form
document.getElementById('questions-input-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const subject = formData.get('subject');
    const questionsText = formData.get('questions');
    
    try {
        let questions;
        try {
            questions = JSON.parse(questionsText);
            
            // Validate array format
            if (!Array.isArray(questions)) {
                throw new Error('Questions must be an array of question objects');
            }

            // Validate each question object
            questions.forEach((q, index) => {
                if (!q.question || typeof q.question !== 'string') {
                    throw new Error(`Question ${index + 1}: Missing or invalid question text`);
                }
                if (!q.options || typeof q.options !== 'object') {
                    throw new Error(`Question ${index + 1}: Must have options object`);
                }
                if (!['a', 'b', 'c', 'd'].every(key => typeof q.options[key] === 'string')) {
                    throw new Error(`Question ${index + 1}: Options must have keys a, b, c, d with string values`);
                }
                if (!q.answer || !['a', 'b', 'c', 'd'].includes(q.answer)) {
                    throw new Error(`Question ${index + 1}: answer must be 'a', 'b', 'c', or 'd'`);
                }
            });

        } catch (error) {
            alert(`Invalid question format: ${error.message}\n\nExpected format:\n[
    {
        "question": "Question text?",
        "options": {
            "a": "Option A text",
            "b": "Option B text",
            "c": "Option C text",
            "d": "Option D text"
        },
        "answer": "a"
    }
]`);
            return;
        }

        displayQuestionsForReview(questions, subject);
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to process questions: ' + error.message);
    }
});

// Show JSON format example
document.getElementById('show-format')?.addEventListener('click', () => {
    const sampleQuestions = [
        {
            "question": "According to the provided document, what is the primary purpose of Role Based Certifications (RBCs) introduced in the bank?",
            "options": {
                "a": "To increase the number of bank branches",
                "b": "To equip staff with knowledge and skills for banking challenges",
                "c": "To promote international banking partnerships",
                "d": "To introduce new financial products to customers"
            },
            "answer": "b"
        }
    ];
    
    alert('Copy this sample format:\n\n' + JSON.stringify(sampleQuestions, null, 2));
});

// Display generated questions for teacher review
function displayQuestionsForReview(questions, subject) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <h4>Question ${index + 1}</h4>
            <input type="text" value="${q.question}" class="question-text" style="width: 100%">
            <div class="options">
                ${Object.entries(q.options).map(([key, value]) => `
                    <div class="option">
                        <input type="radio" name="correct-${index}" value="${key}" ${key === q.answer ? 'checked' : ''}>
                        <input type="text" value="${value}" class="option-text" data-key="${key}">
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(questionDiv);
    });

    document.getElementById('question-review').style.display = 'block';
    container.dataset.subject = subject;
}

// Submit reviewed questions
document.getElementById('submit-questions')?.addEventListener('click', async () => {
    const container = document.getElementById('questions-container');
    const questions = [];
    const subject = container.dataset.subject;

    try {
        container.querySelectorAll('.question-item').forEach((item, index) => {
            const questionText = item.querySelector('.question-text').value.trim();
            if (!questionText) {
                throw new Error(`Question ${index + 1}: Question text cannot be empty`);
            }

            const options = {};
            let hasAllOptions = true;
            item.querySelectorAll('.option-text').forEach(opt => {
                const value = opt.value.trim();
                const key = opt.dataset.key;
                if (!value) {
                    hasAllOptions = false;
                }
                options[key] = value;
            });

            if (!hasAllOptions) {
                throw new Error(`Question ${index + 1}: All options must have values`);
            }

            const answerInput = item.querySelector('input[type="radio"]:checked');
            if (!answerInput) {
                throw new Error(`Question ${index + 1}: Must select a correct answer`);
            }

            questions.push({
                question: questionText,
                options,
                answer: answerInput.value
            });
        });

        const response = await fetch('/api/exam/submit-questions', {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ questions, subject })
        });

        const data = await response.json();

        // Handle different response scenarios
        if (response.status === 200) {
            // All questions saved successfully
            alert(`Success! All ${data.count} questions were saved.`);
            document.getElementById('question-review').style.display = 'none';
            document.getElementById('questions-input-form').reset();
        } else if (response.status === 207) {
            // Partial success
            alert(`Partial success: ${data.savedCount} out of ${data.totalCount} questions were saved.\n\nErrors:\n${data.errors.map(e => `Question ${e.index}: ${e.error}`).join('\n')}`);
            document.getElementById('question-review').style.display = 'none';
            document.getElementById('questions-input-form').reset();
        } else {
            // Error cases
            throw new Error(data.message || 'Failed to save questions');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
});

// Student: Load available exams
async function loadAvailableExams() {
    try {
        const response = await fetch('/api/exam/subjects', {
            headers: getAuthHeader()
        });

        const data = await response.json();
        if (response.ok) {
            displayAvailableExams(data.subjects);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load available exams');
    }
}

// Display available exams for students
function displayAvailableExams(subjects) {
    const container = document.getElementById('subjects-list');
    container.innerHTML = subjects.map(subject => `
        <div class="subject-card" onclick="startExam('${subject}')">
            <h3>${subject}</h3>
            <p>Click to start exam</p>
        </div>
    `).join('');
}

// Start an exam
async function startExam(subject) {
    try {
        const container = document.getElementById('exam-questions');
        container.innerHTML = '<p>Loading questions...</p>';
        
        const response = await fetch(`/api/exam/questions/${subject}`, {
            headers: getAuthHeader()
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to load exam questions');
        }

        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error('No questions available for this subject');
        }

        displayExam(data.questions, subject);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('exam-questions').innerHTML = `
            <div class="error-message">
                ${error.message}
                <br>
                <button onclick="loadAvailableExams()" class="btn-secondary">Back to Subjects</button>
            </div>
        `;
        document.getElementById('exam-container').style.display = 'block';
        document.getElementById('subjects-list').style.display = 'none';
    }
}

// Display exam questions for students
function displayExam(questions, subject) {
    const container = document.getElementById('exam-questions');
    document.getElementById('exam-subject').textContent = subject;
    
    container.innerHTML = questions.map((q, index) => `
        <div class="question-item">
            <h4>Question ${index + 1}</h4>
            <p>${q.question}</p>
            <div class="options">
                ${Object.entries(q.options).map(([key, value]) => `
                    <div class="option">
                        <input type="radio" name="answer-${index}" value="${key}" required>
                        <label>${value}</label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.getElementById('exam-container').style.display = 'block';
    document.getElementById('subjects-list').style.display = 'none';
}

// Submit exam answers
document.getElementById('submit-exam')?.addEventListener('click', async () => {
    const subject = document.getElementById('exam-subject').textContent;
    const answers = [];
    
    document.querySelectorAll('.question-item').forEach((item, index) => {
        const selected = item.querySelector(`input[name="answer-${index}"]:checked`);
        if (selected) {
            answers.push(selected.value);
        } else {
            answers.push(''); // Unanswered
        }
    });

    try {
        const response = await fetch('/api/exam/submit-exam', {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ subject, answers })
        });

        const data = await response.json();
        if (response.ok) {
            displayResults(data);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to submit exam');
    }
});

// Display exam results
function displayResults(results) {
    document.getElementById('exam-container').style.display = 'none';
    document.getElementById('results-container').style.display = 'block';

    document.getElementById('score-display').innerHTML = `
        Score: ${results.score}/${results.totalQuestions}<br>
        Percentage: ${results.percentage.toFixed(2)}%
    `;

    document.getElementById('detailed-results').innerHTML = results.results.map((result, index) => `
        <div class="result-item ${result.correct ? 'correct' : 'incorrect'}">
            <h4>Question ${index + 1}</h4>
            <p>${result.question}</p>
            <p>Your answer: ${result.yourAnswer}</p>
            <p>Correct answer: ${result.correctAnswer}</p>
        </div>
    `).join('');
}