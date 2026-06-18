function showSignup() {
  document.getElementById('login-form').classList.add('is-hidden');
  document.getElementById('signup-form').classList.remove('is-hidden');
}

function showLogin() {
  document.getElementById('signup-form').classList.add('is-hidden');
  document.getElementById('login-form').classList.remove('is-hidden');
}

function setButtonLoading(button, isLoading, label, loadingLabel) {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingLabel : label;
}

function cacheUser(user) {
  DB.setCurrentUser(user);
}

document.addEventListener('DOMContentLoaded', () => {
  const wantsSignup = new URLSearchParams(location.search).has('signup');

  if (APIService.getCurrentUser() && APIService.getToken() && !wantsSignup) {
    location.href = 'index.html';
    return;
  }

  if (wantsSignup) showSignup();

  document.querySelectorAll('[data-auth-view]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (link.dataset.authView === 'signup') showSignup();
      if (link.dataset.authView === 'login') showLogin();
    });
  });

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  [loginForm, signupForm].forEach((form) => {
    form?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('input')) {
        event.preventDefault();
        form.querySelector('.btn-submit')?.click();
      }
    });
  });

  loginForm?.querySelector('.btn-submit')?.addEventListener('click', async (event) => {
    event.preventDefault();

    const email = loginForm.querySelector('input[type="email"]').value.trim();
    const password = loginForm.querySelector('input[type="password"]').value;
    const button = event.currentTarget;

    if (!email || !password) {
      alert('Vui lòng nhập email và mật khẩu');
      return;
    }

    setButtonLoading(button, true, 'Đăng nhập', 'Đang đăng nhập...');
    const result = await APIService.login(email, password);
    setButtonLoading(button, false, 'Đăng nhập', 'Đang đăng nhập...');

    if (!result.success) {
      alert(result.message || 'Email hoặc mật khẩu không chính xác');
      return;
    }

    cacheUser(result.user);
    location.href = 'index.html';
  });

  signupForm?.querySelector('.btn-submit')?.addEventListener('click', async (event) => {
    event.preventDefault();

    const inputs = signupForm.querySelectorAll('input');
    const [firstInput, lastInput, emailInput, phoneInput, birthdateInput, passwordInput, confirmInput] = inputs;
    const button = event.currentTarget;

    if (!emailInput.value.trim() || !passwordInput.value) {
      alert('Vui lòng nhập email và mật khẩu');
      return;
    }

    if (passwordInput.value !== confirmInput.value) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }

    const userData = {
      first_name: firstInput.value.trim(),
      last_name: lastInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      birthdate: birthdateInput.value,
      password: passwordInput.value,
      username: emailInput.value.split('@')[0].trim().toLowerCase()
    };

    setButtonLoading(button, true, 'Tạo tài khoản', 'Đang tạo tài khoản...');
    const result = await APIService.signup(userData);
    setButtonLoading(button, false, 'Tạo tài khoản', 'Đang tạo tài khoản...');

    if (!result.success) {
      alert(result.message || 'Không thể tạo tài khoản');
      return;
    }

    cacheUser(result.user);
    location.href = 'index.html';
  });
});

window.showSignup = showSignup;
window.showLogin = showLogin;
