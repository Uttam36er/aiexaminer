const API_URL = '/api';

// Handle user login
async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            showDashboard(data.role);
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// Handle user registration
async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role')
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registration successful! Please login.');
            showLoginForm();
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// Show appropriate dashboard based on user role
function showDashboard(role) {
    document.getElementById('auth-forms').style.display = 'none';
    document.getElementById('login-link').style.display = 'none';
    document.getElementById('register-link').style.display = 'none';
    document.getElementById('logout-link').style.display = 'block';

    if (role === 'teacher') {
        document.getElementById('teacher-dashboard').style.display = 'block';
        document.getElementById('student-dashboard').style.display = 'none';
    } else {
        document.getElementById('student-dashboard').style.display = 'block';
        document.getElementById('teacher-dashboard').style.display = 'none';
        loadAvailableExams();
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.reload();
}

// Show login form
function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
}

// Show registration form
function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
        showDashboard(role);
    }

    document.getElementById('login-link').addEventListener('click', showLoginForm);
    document.getElementById('register-link').addEventListener('click', showRegisterForm);
    document.getElementById('logout-link').addEventListener('click', handleLogout);
    document.getElementById('home-link').addEventListener('click', () => {
        window.location.href = '/';
    });
    // Remove the event listener for the Contact Us link
    // document.getElementById('contact-link').addEventListener('click', () => {
    //     alert('Feel free to Give Your feedback at uttam.36er@gmail.com, If this site is helpful in your preparation please donate at 8602961558@upi');
    // });
});