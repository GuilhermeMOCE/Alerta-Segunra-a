// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sistema Alerta Comunitário iniciado');
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // ===== PÁGINA INDEX =====
    if (currentPage === 'index.html' || currentPage === '') {
        
        const tabButtons = document.querySelectorAll('.tab-btn');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (tab === 'login') {
                    loginForm.classList.remove('hidden');
                    registerForm.classList.add('hidden');
                } else {
                    loginForm.classList.add('hidden');
                    registerForm.classList.remove('hidden');
                }
                
                hideError('login-error');
                hideError('register-error');
            });
        });
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError('login-error');
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const result = await loginUser(email, password);
            
            if (result.success) {
                redirectBasedOnRole(result.role);
            } else {
                showError('login-error', result.error);
            }
        });
        
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError('register-error');
            
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const role = document.getElementById('register-role').value;
            
            if (!role) {
                showError('register-error', 'Selecione o tipo de conta.');
                return;
            }
            
            const result = await registerUser(email, password, name, role);
            
            if (result.success) {
                redirectBasedOnRole(result.role);
            } else {
                showError('register-error', result.error);
            }
        });
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logoutUser);
        }
        
        const fabBtn = document.getElementById('fab-btn');
        if (fabBtn) {
            fabBtn.addEventListener('click', openReportModal);
        }
        
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', closeReportModal);
        }
        
        const modalCancel = document.getElementById('modal-cancel');
        if (modalCancel) {
            modalCancel.addEventListener('click', closeReportModal);
        }
        
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', closeReportModal);
        }
        
        const reportForm = document.getElementById('report-form');
        if (reportForm) {
            reportForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const type = document.getElementById('report-type').value;
                const description = document.getElementById('report-description').value;
                
                if (!type || !description) {
                    alert('Preencha todos os campos.');
                    return;
                }
                
                await submitReport(type, description);
            });
        }
    }
    
    // ===== PÁGINA DO OPERADOR =====
    if (currentPage === 'operador.html') {
        
        const operatorLogoutBtn = document.getElementById('operator-logout-btn');
        if (operatorLogoutBtn) {
            operatorLogoutBtn.addEventListener('click', logoutUser);
        }
        
        const backToHomeBtn = document.getElementById('back-to-home');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                updateOperatorUI();
            });
        }
    }
});